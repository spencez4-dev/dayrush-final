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

function looksLikeCoursework({title,desc,url}){
  const blob=`${title} ${desc} ${url}`.toLowerCase();

  // Strong Canvas route signals.
  if(/\/assignments\/\d+/.test(blob)) return true;
  if(/\/quizzes\/\d+/.test(blob)) return true;
  if(/\/discussion_topics\/\d+/.test(blob)) return true;

  // Common coursework wording.
  if(/\b(homework|assignment|quiz|exam|test|discussion|project|paper|case study|worksheet|problem set|lab|module quiz|reflection)\b/.test(blob)) return true;

  return false;
}

// JS doesn't support /x regex, so use explicit list.
const adminPhrases=[
  "last possible day","last day to","first day of","term begins","term ends","v term",
  "register","registration","withdraw","withdrawal","drop course","add course",
  "holiday","break","reading day","classes begin","classes end","final grades",
  "commencement","convocation","orientation","academic calendar","deadline to apply",
  "no classes","university closed","campus closed"
];

function isAdministrative(item){
  const blob=`${item.title} ${item.desc}`.toLowerCase();
  return adminPhrases.some(p=>blob.includes(p));
}

function parseICS(text){
  const blocks=unfold(text).split("BEGIN:VEVENT").slice(1).map(x=>x.split("END:VEVENT")[0]);
  const out=[];
  for(const block of blocks){
    const p={};
    for(const line of block.split(/\r?\n/)){const x=prop(line);if(x&&!p[x.name])p[x.name]=x}
    const start=dt(p.DTSTART?.value);
    if(!start)continue;

    const title=unesc(p.SUMMARY?.value||"Canvas item");
    const desc=unesc(p.DESCRIPTION?.value||"");
    const url=unesc(p.URL?.value||"");
    const uid=unesc(p.UID?.value||`${title}-${start.toISOString()}`);

    const courseMatch=title.match(/^\[([^\]]+)\]\s*(.*)$/);
    const item={
      uid,
      title:courseMatch?courseMatch[2]:title,
      course:courseMatch?courseMatch[1]:"Canvas",
      start,
      desc,
      url
    };

    // Homework-only behavior:
    // 1) reject obvious Miami/university calendar administration
    // 2) only keep likely coursework
    if(isAdministrative(item)) continue;
    if(!looksLikeCoursework(item)) continue;

    out.push(item);
  }
  return out;
}

async function getFeed(){
  const s=getState().settings,proxy=normalizeProxy(s.canvasProxy),feed=normalizeFeed(s.canvasFeedUrl);
  let r;
  try{
    r=await fetch(`${proxy}/calendar`,{headers:{"X-Canvas-Feed":feed,"Accept":"text/calendar,text/plain,*/*"}});
  }catch{
    throw new Error("Could not reach the Canvas calendar proxy.");
  }
  if(!r.ok) throw new Error(`Canvas feed returned HTTP ${r.status}: ${(await r.text()).slice(0,100)}`);
  return r.text();
}

export async function syncCanvas(){
  const items=parseICS(await getFeed()),state=getState();

  // Remove all prior Canvas-feed imports, then rebuild only homework.
  const tasks=state.tasks.filter(t=>t.source!=="canvas-preview"&&t.source!=="canvas-feed");
  state.events=state.events.filter(e=>e.source!=="canvas-feed");

  for(const item of items){
    tasks.push({
      id:`canvas-feed-task-${item.uid}`,
      course:item.course,
      title:item.title,
      due:item.start.toISOString(),
      points:null,
      completed:false,
      source:"canvas-feed",
      canvasUrl:item.url||null
    });
  }

  state.tasks=tasks.sort((a,b)=>new Date(a.due)-new Date(b.due));
  patchSettings({
    canvasUser:{id:"calendar-feed",name:"Miami Canvas",primary_email:null},
    lastCanvasSync:new Date().toISOString()
  });
  save();

  return {profile:{name:"Miami Canvas"},count:items.length,taskCount:items.length,eventCount:0};
}
