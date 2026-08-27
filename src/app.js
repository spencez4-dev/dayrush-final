import {
  getState, save, patchSettings, setCanvasBase, setCanvasProxy, setCanvasFeedUrl, setCanvasToken,
  getCanvasToken, clearCanvasToken, resetAll
} from "./store.js";
import { syncCanvas } from "./canvas.js";
import { esc, fmtTime, fmtDay, fmtShort, fmtDue, sameDay, uid, minutesBetween, humanDuration } from "./utils.js";

const app = document.getElementById("app");

let tab = localStorage.getItem("dr-tab") || "calendar";
let calendarMode = localStorage.getItem("dr-calendar-mode") || "week";
let calendarZoom = Number(localStorage.getItem("dr-calendar-zoom") || 58);
let calendarAnchor = new Date();
calendarAnchor.setHours(0,0,0,0);

const typeLabel = t => ({school:"School",work:"Work",beta:"Beta",music:"Music",personal:"Personal"})[t] || "Event";
const typeClass = t => ["school","work","beta","music","personal"].includes(t) ? t : "personal";

function startOfWeek(date){
  const d=new Date(date);
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d;}
function addMonths(date,n){const d=new Date(date);d.setMonth(d.getMonth()+n);return d;}
function localDateValue(d){
  const x=new Date(d), y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,"0"),day=String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function localTimeValue(d){
  const x=new Date(d);
  return `${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`;
}
function parseLocal(date,time){
  return new Date(`${date}T${time||"12:00"}:00`);
}
function sortEvents(list){return [...list].sort((a,b)=>new Date(a.start)-new Date(b.start));}
function allEvents(){return sortEvents(getState().events);}
function eventsFor(day){return allEvents().filter(e=>sameDay(e.start,day));}
function tasksFor(day){return getState().tasks.filter(t=>sameDay(t.due,day)).sort((a,b)=>new Date(a.due)-new Date(b.due));}
function upcomingTasks(){
  return getState().tasks.filter(t=>!t.completed && new Date(t.due)>=new Date(Date.now()-86400000))
    .sort((a,b)=>new Date(a.due)-new Date(b.due));
}
function progressPct(){
  const tasks=getState().tasks.filter(t=>t.source==="canvas"||t.source==="canvas-preview");
  if(!tasks.length)return 0;
  return Math.round(tasks.filter(t=>t.completed).length/tasks.length*100);
}
function upcomingEvents(){
  const n=new Date();
  return allEvents().filter(e=>new Date(e.end)>=n);
}
function toast(message){
  const x=document.createElement("div");
  x.className="toast"; x.textContent=message;
  document.body.appendChild(x);
  setTimeout(()=>x.remove(),2400);
}
function setTab(next){
  tab=next; localStorage.setItem("dr-tab",tab);
  render(); window.scrollTo({top:0,behavior:"smooth"});
}

function topHeader(){
  return `<header class="topbar">
    <div>
      <span class="eyebrow">${fmtDay(new Date()).toUpperCase()}</span>
      <h1>Day Rush</h1>
    </div>
    <div class="top-actions">
      ${getState().settings.canvasUser?`<span class="sync-chip"><i></i> Canvas</span>`:""}
      <button class="icon-button" id="themeQuick" title="Toggle theme">◐</button>
    </div>
  </header>`;
}

function nav(){
  const items=[["today","Today"],["calendar","Calendar"],["tasks","Tasks"],["inbox","Inbox"],["you","You"]];
  return `<nav class="main-nav">${items.map(([id,label])=>`<button data-tab="${id}" class="${tab===id?"active":""}">${label}</button>`).join("")}</nav>`;
}

function eventListCard(e){
  return `<button class="event-row ${typeClass(e.type)}" data-edit-event="${esc(e.id)}">
    <span class="event-dot"></span>
    <span class="event-main"><b>${esc(e.title)}</b><small>${esc(e.location||typeLabel(e.type))}</small></span>
    <span class="event-time">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></span>
  </button>`;
}
function taskCard(t){
  return `<article class="task-row ${t.completed?"done":""}">
    <button class="task-check" data-task="${esc(t.id)}">${t.completed?"✓":""}</button>
    <div>
      <span class="course">${esc(t.course)}</span>
      <b>${esc(t.title)}</b>
      <small>${fmtDue(t.due)}${t.points!=null?` · ${t.points} pts`:""}</small>
    </div>
    ${t.canvasUrl?`<a href="${esc(t.canvasUrl)}" target="_blank" rel="noopener">↗</a>`:""}
  </article>`;
}

function renderToday(){
  const today=eventsFor(new Date());
  const n=new Date();
  const current=today.find(e=>new Date(e.start)<=n&&new Date(e.end)>=n);
  const next=today.find(e=>new Date(e.start)>n);
  const due=upcomingTasks().slice(0,4);
  const free=next?minutesBetween(n,next.start):0;

  return `<main class="simple-main">
    <section class="today-head">
      <div>
        <span class="eyebrow">${current?"RIGHT NOW":next?"NEXT":"TODAY"}</span>
        <h2>${esc(current?.title || next?.title || "You’re clear.")}</h2>
        <p>${current?`Until ${fmtTime(current.end)}`:next?`${fmtTime(next.start)} · ${typeLabel(next.type)}`:"Nothing else scheduled."}</p>
      </div>
      ${free>=30?`<div class="free-pill"><span>Free window</span><b>${humanDuration(free)}</b></div>`:""}
    </section>

    <div class="two-column">
      <section>
        <div class="section-title"><h3>Today</h3><span>${today.length}</span></div>
        <div class="stack">${today.length?today.map(eventListCard).join(""):`<div class="empty">No commitments today.</div>`}</div>
      </section>
      <section>
        <div class="section-title"><h3>Assignments</h3><span>${due.length}</span></div>
        <div class="canvas-summary">
          <div class="mini-ring" style="--p:${progressPct()}">${progressPct()}%</div>
          <div><b>${upcomingTasks().length} open Canvas items</b><small>${getState().settings.canvasUser?"Live Canvas data":"Canvas preview"}</small></div>
        </div>
        <div class="stack">${due.map(taskCard).join("")||`<div class="empty">Nothing due soon.</div>`}</div>
      </section>
    </div>
  </main>`;
}

function calendarToolbar(){
  const label = calendarMode==="month"
    ? new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(calendarAnchor)
    : calendarMode==="day"
      ? fmtDay(calendarAnchor)
      : `${fmtShort(startOfWeek(calendarAnchor))} – ${fmtShort(addDays(startOfWeek(calendarAnchor),6))}`;
  return `<div class="calendar-toolbar">
    <div class="calendar-nav">
      <button class="icon-button" id="calPrev">‹</button>
      <button class="subtle-button" id="calToday">Today</button>
      <button class="icon-button" id="calNext">›</button>
      <h2>${label}</h2>
    </div>
    <div class="calendar-actions">
      ${calendarMode!=="month"?`<div class="zoom-control"><button id="zoomOut">−</button><span>Zoom</span><button id="zoomIn">+</button></div>`:""}
      <div class="segment">
        <button data-cal-mode="day" class="${calendarMode==="day"?"active":""}">Day</button>
        <button data-cal-mode="week" class="${calendarMode==="week"?"active":""}">Week</button>
        <button data-cal-mode="month" class="${calendarMode==="month"?"active":""}">Month</button>
      </div>
    </div>
  </div>`;
}

function calendarEventBlock(e, top, height){
  return `<button class="cal-event ${typeClass(e.type)}" data-edit-event="${esc(e.id)}" style="top:${top}px;height:${height}px">
    <b>${esc(e.title)}</b>
    <span>${fmtTime(e.start)}–${fmtTime(e.end)}</span>
    ${height>44 && e.location?`<small>${esc(e.location)}</small>`:""}
  </button>`;
}

function renderTimeGrid(days){
  const startHour=6,endHour=24,hourH=calendarZoom,totalH=(endHour-startHour)*hourH;
  const hours=Array.from({length:endHour-startHour},(_,i)=>startHour+i);

  return `<div class="time-grid-wrap">
    <div class="time-grid-head" style="grid-template-columns:72px repeat(${days.length},minmax(150px,1fr))">
      <div></div>
      ${days.map(d=>`<div class="day-heading ${sameDay(d,new Date())?"today":""}">
        <span>${new Intl.DateTimeFormat("en-US",{weekday:"short"}).format(d)}</span>
        <b>${d.getDate()}</b>
      </div>`).join("")}
    </div>
    <div class="due-grid" style="grid-template-columns:72px repeat(${days.length},minmax(150px,1fr))">
      <div class="due-label">DUE</div>
      ${days.map(d=>`<div class="due-cell">${tasksFor(d).map(t=>`<div class="due-item ${t.completed?"done":""}"><b>${esc(t.course)}</b><span>${esc(t.title)}</span><small>${fmtTime(t.due)}</small></div>`).join("")}</div>`).join("")}
    </div>
    <div class="time-grid" style="grid-template-columns:72px repeat(${days.length},minmax(150px,1fr));height:${totalH}px">
      <div class="time-axis">${hours.map((h,i)=>`<span style="top:${i*hourH}px">${new Intl.DateTimeFormat("en-US",{hour:"numeric"}).format(new Date(2026,0,1,h,0))}</span>`).join("")}</div>
      ${days.map(d=>{
        const blocks=eventsFor(d).map(e=>{
          const s=new Date(e.start),en=new Date(e.end);
          let startMin=s.getHours()*60+s.getMinutes()-startHour*60;
          let endMin=en.getHours()*60+en.getMinutes()-startHour*60;
          startMin=Math.max(0,startMin); endMin=Math.min((endHour-startHour)*60,endMin);
          if(endMin<=0||startMin>=(endHour-startHour)*60)return "";
          return calendarEventBlock(e,(startMin/60)*hourH,Math.max(26,((endMin-startMin)/60)*hourH));
        }).join("");
        return `<div class="day-column ${sameDay(d,new Date())?"today":""}" style="--hour-h:${hourH}px">${hours.map((_,i)=>`<i style="top:${i*hourH}px"></i>`).join("")}${blocks}</div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderMonth(){
  const first=new Date(calendarAnchor.getFullYear(),calendarAnchor.getMonth(),1);
  const gridStart=startOfWeek(first);
  const days=Array.from({length:42},(_,i)=>addDays(gridStart,i));
  return `<div class="month-grid">
    ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=>`<div class="month-weekday">${x}</div>`).join("")}
    ${days.map(d=>{
      const inMonth=d.getMonth()===calendarAnchor.getMonth();
      const es=eventsFor(d),ts=tasksFor(d);
      return `<button class="month-day ${!inMonth?"outside":""} ${sameDay(d,new Date())?"today":""}" data-open-day="${localDateValue(d)}">
        <div class="month-num">${d.getDate()}</div>
        <div class="month-items">
          ${es.slice(0,3).map(e=>`<span class="month-event ${typeClass(e.type)}">${esc(e.title)}</span>`).join("")}
          ${ts.slice(0,2).map(t=>`<span class="month-task">• ${esc(t.title)}</span>`).join("")}
          ${es.length+ts.length>5?`<small>+${es.length+ts.length-5} more</small>`:""}
        </div>
      </button>`;
    }).join("")}
  </div>`;
}

function renderCalendar(){
  let body;
  if(calendarMode==="month") body=renderMonth();
  else if(calendarMode==="day") body=renderTimeGrid([new Date(calendarAnchor)]);
  else {
    const start=startOfWeek(calendarAnchor);
    body=renderTimeGrid(Array.from({length:7},(_,i)=>addDays(start,i)));
  }
  return `<main class="calendar-main">${calendarToolbar()}${body}</main>`;
}

function renderTasks(){
  const all=[...getState().tasks].sort((a,b)=>new Date(a.due)-new Date(b.due));
  return `<main class="simple-main">
    <div class="page-head"><div><span class="eyebrow">TASKS</span><h2>${upcomingTasks().length} open</h2></div></div>
    <div class="task-list">${all.length?all.map(taskCard).join(""):`<div class="empty">No tasks.</div>`}</div>
  </main>`;
}

function renderInbox(){
  const inbox=getState().inbox;
  return `<main class="simple-main">
    <div class="page-head"><div><span class="eyebrow">INBOX</span><h2>${inbox.length} need review</h2><p>Nothing uncertain gets added without your approval.</p></div></div>
    <div class="stack">${inbox.length?inbox.map(i=>`<article class="inbox-card">
      <div><b>${esc(i.title)}</b><small>${esc(i.note)}</small></div>
      <div><button class="subtle-button" data-ignore="${esc(i.id)}">Ignore</button><button class="primary-button" data-confirm="${esc(i.id)}">Set date</button></div>
    </article>`).join(""):`<div class="empty">Inbox zero.</div>`}</div>
  </main>`;
}

function renderYou(){
  const s=getState().settings,hasToken=Boolean(getCanvasToken());
  return `<main class="simple-main settings-page">
    <div class="page-head"><div><span class="eyebrow">YOU</span><h2>Settings</h2></div></div>
    <section class="settings-card">
      <div class="section-title"><h3>Canvas</h3><span>${s.canvasUser?"Connected":"Not connected"}</span></div>
      ${s.canvasUser?`<div class="identity"><b>${esc(s.canvasUser.name)}</b><small>${esc(s.canvasUser.primary_email||"Miami Canvas")}</small></div>`:""}
      <label>Canvas Calendar Feed URL<input id="canvasFeedUrl" type="password" value="${esc(s.canvasFeedUrl||"")}" placeholder="https://miamioh.instructure.com/feeds/calendars/...ics" autocomplete="off"></label>
      <label>Canvas Proxy URL<input id="canvasProxy" value="${esc(s.canvasProxy||"")}" placeholder="https://dayrush-final.spencez4.workers.dev"></label>
      <div class="security-note">Your Canvas feed URL is private. Keep it off GitHub and only paste it into Day Rush on your own device.</div>
      <div class="button-row"><button class="primary-button" id="connectCanvas">${s.canvasUser?"Refresh Canvas":"Connect Canvas"}</button></div>
      <div id="canvasMessage" class="status-message">${s.lastCanvasSync?`Last sync ${fmtShort(s.lastCanvasSync)} ${fmtTime(s.lastCanvasSync)}`:""}</div>
    </section>
    <section class="settings-card">
      <div class="section-title"><h3>Appearance</h3></div>
      <button class="subtle-button" id="toggleTheme">Toggle black / white</button>
    </section>
  </main>`;
}

function editorDialog(){
  return `<dialog id="eventDialog" class="editor-dialog">
    <form method="dialog" id="eventForm">
      <input type="hidden" id="editId">
      <div class="dialog-head"><h3 id="dialogTitle">Add event</h3><button value="cancel" class="icon-button">×</button></div>
      <label>Title<input id="editTitle" required></label>
      <div class="form-grid">
        <label>Date<input id="editDate" type="date" required></label>
        <label>Type<select id="editType">
          <option value="personal">Personal</option><option value="school">School</option><option value="work">Work</option><option value="beta">Beta</option><option value="music">Music</option>
        </select></label>
        <label>Start<input id="editStart" type="time"></label>
        <label>End<input id="editEnd" type="time"></label>
      </div>
      <label>Location<input id="editLocation"></label>
      <div class="dialog-actions">
        <button type="button" id="deleteEvent" class="danger-button">Delete</button>
        <div><button value="cancel" class="subtle-button">Cancel</button><button type="submit" value="save" class="primary-button">Save</button></div>
      </div>
    </form>
  </dialog>`;
}

function render(){
  document.body.classList.toggle("light",getState().settings.theme==="light");
  const content=tab==="today"?renderToday():tab==="calendar"?renderCalendar():tab==="tasks"?renderTasks():tab==="inbox"?renderInbox():renderYou();
  app.innerHTML=`<div class="shell">${topHeader()}${nav()}${content}<button class="fab" id="addEventBtn">+</button></div>${editorDialog()}`;
  bind();
}

function openEventEditor(id=null,presetDate=null){
  const dlg=document.getElementById("eventDialog");
  const e=id?getState().events.find(x=>x.id===id):null;
  document.getElementById("dialogTitle").textContent=e?"Edit event":"Add event";
  document.getElementById("editId").value=e?.id||"";
  document.getElementById("editTitle").value=e?.title||"";
  document.getElementById("editType").value=e?.type||"personal";
  document.getElementById("editLocation").value=e?.location||"";
  const start=e?new Date(e.start):(presetDate?new Date(`${presetDate}T12:00:00`):new Date());
  const end=e?new Date(e.end):new Date(start.getTime()+3600000);
  document.getElementById("editDate").value=localDateValue(start);
  document.getElementById("editStart").value=localTimeValue(start);
  document.getElementById("editEnd").value=localTimeValue(end);
  document.getElementById("deleteEvent").style.display=e?"inline-flex":"none";
  dlg.showModal();
}

function bind(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  document.getElementById("themeQuick")?.addEventListener("click",toggleTheme);
  document.getElementById("toggleTheme")?.addEventListener("click",toggleTheme);

  document.getElementById("addEventBtn").onclick=()=>openEventEditor();

  document.querySelectorAll("[data-edit-event]").forEach(b=>b.onclick=()=>openEventEditor(b.dataset.editEvent));
  document.querySelectorAll("[data-open-day]").forEach(b=>b.onclick=()=>{
    calendarAnchor=new Date(`${b.dataset.openDay}T12:00:00`);
    calendarMode="day"; localStorage.setItem("dr-calendar-mode",calendarMode); render();
  });

  document.getElementById("calPrev")?.addEventListener("click",()=>{
    calendarAnchor=calendarMode==="month"?addMonths(calendarAnchor,-1):addDays(calendarAnchor,calendarMode==="week"?-7:-1); render();
  });
  document.getElementById("calNext")?.addEventListener("click",()=>{
    calendarAnchor=calendarMode==="month"?addMonths(calendarAnchor,1):addDays(calendarAnchor,calendarMode==="week"?7:1); render();
  });
  document.getElementById("calToday")?.addEventListener("click",()=>{calendarAnchor=new Date();calendarAnchor.setHours(0,0,0,0);render();});
  document.querySelectorAll("[data-cal-mode]").forEach(b=>b.onclick=()=>{
    calendarMode=b.dataset.calMode; localStorage.setItem("dr-calendar-mode",calendarMode); render();
  });
  document.getElementById("zoomOut")?.addEventListener("click",()=>{calendarZoom=Math.max(34,calendarZoom-8);localStorage.setItem("dr-calendar-zoom",calendarZoom);render();});
  document.getElementById("zoomIn")?.addEventListener("click",()=>{calendarZoom=Math.min(100,calendarZoom+8);localStorage.setItem("dr-calendar-zoom",calendarZoom);render();});

  document.querySelectorAll("[data-task]").forEach(btn=>btn.onclick=()=>{
    const t=getState().tasks.find(x=>x.id===btn.dataset.task);
    if(!t)return;
    if(t.source==="canvas"){toast("Canvas controls completion.");return;}
    t.completed=!t.completed;save();render();
  });

  document.querySelectorAll("[data-ignore]").forEach(btn=>btn.onclick=()=>{
    getState().inbox=getState().inbox.filter(i=>i.id!==btn.dataset.ignore);save();render();
  });
  document.querySelectorAll("[data-confirm]").forEach(btn=>btn.onclick=()=>{
    const item=getState().inbox.find(i=>i.id===btn.dataset.confirm);
    openEventEditor(null,localDateValue(new Date()));
    if(item) document.getElementById("editTitle").value=item.title;
  });

  const form=document.getElementById("eventForm");
  form.onsubmit=e=>{
    if(e.submitter?.value==="cancel")return;
    e.preventDefault();
    const id=document.getElementById("editId").value;
    const date=document.getElementById("editDate").value;
    const start=document.getElementById("editStart").value||"12:00";
    const end=document.getElementById("editEnd").value||start;
    const data={
      title:document.getElementById("editTitle").value.trim(),
      start:`${date}T${start}:00`,end:`${date}T${end}:00`,
      type:document.getElementById("editType").value,
      location:document.getElementById("editLocation").value.trim()
    };
    if(id){
      const idx=getState().events.findIndex(x=>x.id===id);
      if(idx>=0)getState().events[idx]={...getState().events[idx],...data};
    }else{
      getState().events.push({id:uid(),...data,source:"manual"});
    }
    save();document.getElementById("eventDialog").close();toast(id?"Event updated":"Event added");render();
  };
  document.getElementById("deleteEvent").onclick=()=>{
    const id=document.getElementById("editId").value;
    if(!id)return;
    getState().events=getState().events.filter(e=>e.id!==id);
    save();document.getElementById("eventDialog").close();toast("Event deleted");render();
  };

  document.getElementById("connectCanvas")?.addEventListener("click",async()=>{
    const msg=document.getElementById("canvasMessage");
    const feed=document.getElementById("canvasFeedUrl").value.trim();
    const proxy=document.getElementById("canvasProxy").value.trim();
    setCanvasFeedUrl(feed); setCanvasProxy(proxy);
    msg.textContent="Syncing Canvas calendar…";
    try{
      const result=await syncCanvas();
      msg.textContent=`Canvas connected. ${result.taskCount} assignments and ${result.eventCount} calendar events loaded.`;
      toast("Canvas calendar synced"); setTimeout(render,500);
    }catch(err){msg.textContent=err.message;toast("Canvas connection failed");}
  });
}

function toggleTheme(){
  const next=getState().settings.theme==="dark"?"light":"dark";
  patchSettings({theme:next});localStorage.setItem("day-rush-theme",next);render();
}

render();
