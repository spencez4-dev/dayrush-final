export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/calendar") {
      return handleCalendar(request);
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "dayrush-canvas-proxy" });
    }

    return json({ error: "Not found" }, 404);
  }
};

async function handleCalendar(request) {
  const feed = request.headers.get("X-Canvas-Feed");
  if (!feed) return json({ error: "Missing Canvas feed URL" }, 400);

  let parsed;
  try {
    parsed = new URL(feed);
  } catch {
    return json({ error: "Invalid feed URL" }, 400);
  }

  if (parsed.origin !== "https://miamioh.instructure.com") {
    return json({ error: "Feed origin not allowed" }, 403);
  }

  if (!parsed.pathname.startsWith("/feeds/calendars/") || !parsed.pathname.endsWith(".ics")) {
    return json({ error: "Only Miami Canvas calendar feeds are allowed" }, 403);
  }

  // Mimic a normal calendar/subscription client more closely.
  // Some Canvas installations reject bare server-to-server requests.
  const upstream = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "follow",
    headers: {
      "Accept": "text/calendar,application/ics;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/18.6",
      "Referer": "https://miamioh.instructure.com/calendar",
      "Origin": "https://miamioh.instructure.com",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });

  const body = await upstream.arrayBuffer();

  const headers = new Headers(corsHeaders());
  headers.set("content-type", upstream.headers.get("content-type") || "text/calendar; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-dayrush-upstream-status", String(upstream.status));

  // Preserve a little upstream context for debugging without leaking the feed URL.
  const via = upstream.headers.get("via");
  if (via) headers.set("x-dayrush-upstream-via", via);

  return new Response(body, {
    status: upstream.status,
    headers
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "X-Canvas-Feed, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "X-DayRush-Upstream-Status, X-DayRush-Upstream-Via"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json"
    }
  });
}
