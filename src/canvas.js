import { getState, patchSettings, save } from "./store.js";

function normalizeProxy(value){
  const raw=String(value||"").trim().replace(/\/+$/,"");
  if(!raw) throw new Error("Canvas Proxy URL is required.");
  if(!/^https?:\/\//i.test(raw)) throw new Error("Canvas Proxy URL must start with https://");
  return raw;
}
function normalizeFeed(value){
  const raw=String(value||"").trim();
  if(!raw) throw new Error("Canvas Calendar Feed URL is required.");
  let u;
  try{u=new URL(raw)}catch{throw new Error("Canvas Calendar Feed URL is invalid.")}
  if(u.origin!=="https://miamioh.instructure.com") throw new Error("Feed must come from Miami Canvas.");
  if(!u.pathname.startsWith("/feeds/calendars/")||!u.pathname.endsWith(".ics")) throw new Error("That is not a Canvas calendar feed.");
  return u.toString();
}
function unfold(text){return text.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"")}
function unesc(v=""){return v.replace(/\\n/gi,"\n").replace(/\\,/g,",").replace(/\\;/g,";").replace(/\\\\/g,"\\")}
function prop(line){
  const i=line.indexOf(":"); if(i<0)return null;
  const left=line.slice(0,i),value=line.slice(i+1);
  const [name,...params]=left.split(";");
  return {name:name.toUpperCase(),params:params.join(";"),value};
}
function dt(raw){
  if(!raw)return null; const v=raw.trim();
  if(/^\d{8}$/.test(v)) return new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8),23,59);
  if(/^\d{8}T\d{6}Z$/.test(v)) return new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z`);
  if(/^\d{8}T\d{6}$/.test(v)) return new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8),+v.slice(9,11),+v.slice(11,13),+v.slice(13,15));
  return new Date(v);
}
function parseICS(text){
  const blocks=unfold(text).split("BEGIN:VEVENT").slice(1).map(x=>x.split("END:VEVENT")[0]);
  const out=[];
  for(const block of blocks){
    const p={};
    for(const line of block.split(/\r?\n/)){const x=prop(line);if(x&&!p[x.name])p[x.name]=x}
    const start=dt(p.DTSTART?.value),end=dt(p.DTEND?.value)||start;
    if(!start)continue;
    const title=unesc(p.SUMMARY?.value||"Canvas item");
    const desc=unesc(p.DESCRIPTION?.value||"");
    const url=unesc(p.URL?.value||"");
    const uid=unesc(p.UID?.value||`${title}-${start.toISOString()}`);
    const duration=end?Math.max(0,(end-start)/60000):0;
    const isTask=start.getHours()===23||duration<=5||/assignment|quiz|discussion|homework|exam|module|due/i.test(`${title} ${desc}`);
    const match=title.match(/^\[([^\]]+)\]\s*(.*)$/);
    out.push({uid,title:match?match[2]:title,course:match?match[1]:"Canvas",start,end,url,isTask});
  }
  return out;
}
async function getFeed(){
  const s=getState().settings,proxy=normalizeProxy(s.canvasProxy),feed=normalizeFeed(s.canvasFeedUrl);
  let r;
  try{
    r=await fetch(`${proxy}/calendar`,{headers:{"X-Canvas-Feed":feed,"Accept":"text/calendar,text/plain,*/*"}});
  }catch{throw new Error("Could not reach the Canvas calendar proxy.")}
  if(!r.ok) throw new Error(`Canvas feed returned HTTP ${r.status}: ${(await r.text()).slice(0,100)}`);
  return r.text();
}
export async function syncCanvas(){
  const items=parseICS(await getFeed()),state=getState();
  const tasks=state.tasks.filter(t=>t.source!=="canvas-preview"&&t.source!=="canvas-feed");
  const events=state.events.filter(e=>e.source!=="canvas-feed");
  let taskCount=0,eventCount=0;
  for(const item of items){
    if(item.isTask){
      tasks.push({id:`canvas-feed-task-${item.uid}`,course:item.course,title:item.title,due:item.start.toISOString(),points:null,completed:false,source:"canvas-feed",canvasUrl:item.url||null});
      taskCount++;
    }else{
      events.push({id:`canvas-feed-event-${item.uid}`,title:item.title,start:item.start.toISOString(),end:(item.end||item.start).toISOString(),type:"school",location:"",source:"canvas-feed",canvasUrl:item.url||null});
      eventCount++;
    }
  }
  state.tasks=tasks.sort((a,b)=>new Date(a.due)-new Date(b.due));
  state.events=events.sort((a,b)=>new Date(a.start)-new Date(b.start));
  patchSettings({canvasUser:{id:"calendar-feed",name:"Miami Canvas",primary_email:null},lastCanvasSync:new Date().toISOString()});
  save();
  return {profile:{name:"Miami Canvas"},count:taskCount+eventCount,taskCount,eventCount};
}
