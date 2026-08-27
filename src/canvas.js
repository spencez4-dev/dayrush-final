import { getState, getCanvasToken, patchSettings, save } from "./store.js";

function linkNext(header){
  if(!header) return null;
  for(const part of header.split(",")){
    if(/rel="?next"?/.test(part)){
      const m = part.match(/<([^>]+)>/);
      if(m) return m[1];
    }
  }
  return null;
}

function normalizeBase(value){
  const raw = String(value || "").trim().replace(/\/+$/,"");
  if(!/^https?:\/\//i.test(raw)) throw new Error("Canvas URL must start with https://");
  return raw;
}

function buildTarget(path){
  const { canvasBase } = getState().settings;
  return new URL(path, `${normalizeBase(canvasBase)}/`).toString();
}

function proxyUrlFor(target){
  const proxy = String(getState().settings.canvasProxy || "").trim().replace(/\/+$/,"");
  if(!proxy) return target;
  return `${proxy}/canvas?target=${encodeURIComponent(target)}`;
}

async function request(target){
  const token = getCanvasToken();
  if(!token) throw new Error("No Canvas token set.");

  const proxy = String(getState().settings.canvasProxy || "").trim();
  const url = proxyUrlFor(target);

  let response;
  try{
    response = await fetch(url,{
      method:"GET",
      headers: proxy
        ? {"X-Canvas-Token": token, "Accept":"application/json"}
        : {"Authorization":`Bearer ${token}`, "Accept":"application/json"}
    });
  }catch(err){
    if(!proxy){
      throw new Error("Direct browser connection to Canvas failed. Use the included Canvas Proxy URL in Day Rush settings.");
    }
    throw new Error(`Canvas proxy could not be reached: ${err?.message || "network error"}`);
  }

  if(response.status===401 || response.status===403){
    throw new Error("Canvas rejected the token. Check that it is current and copied exactly.");
  }
  if(!response.ok){
    let detail="";
    try{
      const text=await response.text();
      if(text) detail=` ${text.slice(0,140)}`;
    }catch{}
    throw new Error(`Canvas returned HTTP ${response.status}.${detail}`);
  }
  return response;
}

async function paged(firstUrl,maxPages=10){
  const out=[];
  let next=firstUrl;
  let count=0;
  while(next && count<maxPages){
    const response=await request(next);
    const data=await response.json();
    if(Array.isArray(data)) out.push(...data);
    else return data;
    next=linkNext(response.headers.get("Link"));
    count++;
  }
  return out;
}

function deriveCompleted(item){
  if(item?.planner_override?.marked_complete===true) return true;
  const sub=item?.submissions;
  if(Array.isArray(sub)){
    return sub.some(x=>x?.submitted_at || ["submitted","graded","pending_review","complete"].includes(x?.workflow_state));
  }
  return Boolean(sub?.submitted_at || ["submitted","graded","pending_review","complete"].includes(sub?.workflow_state));
}

function taskFromPlanner(item){
  const p=item.plannable||{};
  const due=p.due_at||p.todo_date||p.start_at||item.plannable_date;
  if(!due) return null;
  const type=item.plannable_type||"item";
  const pid=item.plannable_id??p.id??`${p.title}-${due}`;
  return {
    id:`canvas-${type}-${pid}`,
    course:item.context_name||"Canvas",
    title:p.title||p.name||"Canvas item",
    due,
    points:p.points_possible??null,
    completed:deriveCompleted(item),
    source:"canvas",
    canvasUrl:p.html_url||item.html_url||null,
    submissionState:Array.isArray(item.submissions)
      ? item.submissions?.[0]?.workflow_state||null
      : item.submissions?.workflow_state||null,
    plannableType:type
  };
}

export async function canvasProfile(){
  const response=await request(buildTarget("/api/v1/users/self/profile"));
  return response.json();
}

export async function fetchPlanner({pastDays=14,futureDays=240}={}){
  const start=new Date(Date.now()-pastDays*86400000).toISOString();
  const end=new Date(Date.now()+futureDays*86400000).toISOString();
  const u=new URL(buildTarget("/api/v1/planner/items"));
  u.searchParams.set("start_date",start);
  u.searchParams.set("end_date",end);
  u.searchParams.set("per_page","100");
  const items=await paged(u.toString());
  return items.map(taskFromPlanner).filter(Boolean);
}

export async function syncCanvas(){
  const profile=await canvasProfile();
  const incoming=await fetchPlanner();
  const state=getState();

  const existing=new Map(state.tasks.map(t=>[t.id,t]));
  incoming.forEach(task=>{
    const old=existing.get(task.id);
    existing.set(task.id,old?{...old,...task}:task);
  });

  state.tasks=[...existing.values()]
    .filter(t=>t.source!=="canvas-preview")
    .sort((a,b)=>new Date(a.due)-new Date(b.due));

  patchSettings({
    canvasUser:{id:profile.id,name:profile.name,primary_email:profile.primary_email||null},
    lastCanvasSync:new Date().toISOString()
  });
  save();
  return {profile,count:incoming.length};
}
