export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname !== "/canvas") {
      return json({ error: "Not found" }, 404);
    }

    const token = request.headers.get("X-Canvas-Token");
    const target = url.searchParams.get("target");

    if (!token || !target) {
      return json({ error: "Missing token or target" }, 400);
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json({ error: "Invalid target URL" }, 400);
    }

    // Hard-lock this proxy to Miami Canvas only.
    if (parsed.origin !== "https://miamioh.instructure.com") {
      return json({ error: "Target origin not allowed" }, 403);
    }

    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const headers = new Headers(corsHeaders());
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const link = upstream.headers.get("link");
    if (link) headers.set("link", link);

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "X-Canvas-Token, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "Link"
  };
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json"
    }
  });
}
