export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==="OPTIONS") return new Response(null,{headers:corsHeaders()});
    if(url.pathname==="/calendar") return handleCalendar(request);
    if(url.pathname==="/canvas") return handleCanvasApi(request,url);
    return json({error:"Not found"},404);
  }
};
async function handleCalendar(request){
  const feed=request.headers.get("X-Canvas-Feed");
  if(!feed)return json({error:"Missing Canvas feed URL"},400);
  let u; try{u=new URL(feed)}catch{return json({error:"Invalid feed URL"},400)}
  if(u.origin!=="https://miamioh.instructure.com")return json({error:"Feed origin not allowed"},403);
  if(!u.pathname.startsWith("/feeds/calendars/")||!u.pathname.endsWith(".ics"))return json({error:"Only Miami Canvas calendar feeds are allowed"},403);
  const upstream=await fetch(u.toString(),{headers:{"Accept":"text/calendar,text/plain,*/*"}});
  const h=new Headers(corsHeaders());
  h.set("content-type",upstream.headers.get("content-type")||"text/calendar; charset=utf-8");
  h.set("cache-control","no-store");
  return new Response(upstream.body,{status:upstream.status,headers:h});
}
async function handleCanvasApi(request,url){
  const token=request.headers.get("X-Canvas-Token"),target=url.searchParams.get("target");
  if(!token||!target)return json({error:"Missing token or target"},400);
  let u;try{u=new URL(target)}catch{return json({error:"Invalid target URL"},400)}
  if(u.origin!=="https://miamioh.instructure.com")return json({error:"Target origin not allowed"},403);
  const upstream=await fetch(u.toString(),{headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json"}});
  const h=new Headers(corsHeaders());
  const ct=upstream.headers.get("content-type");if(ct)h.set("content-type",ct);
  const link=upstream.headers.get("link");if(link)h.set("link",link);
  return new Response(upstream.body,{status:upstream.status,headers:h});
}
function corsHeaders(){return{
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"X-Canvas-Token, X-Canvas-Feed, Content-Type",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Access-Control-Expose-Headers":"Link"
}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders(),"content-type":"application/json"}})}
