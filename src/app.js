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
const vibeLines = [
  "Schedule loaded. Go make the day nervous.",
  "Calendar says you're booked. Spirit says we're so back.",
  "Dead space detected. That’s called freedom.",
  "One thing at a time. Then absolutely cook.",
  "Your week has lore now.",
  "Nothing sneaks up on you in this house.",
  "Mission control online.",
  "Today looks beatable.",
  "Tiny wins. Huge aura.",
  "Schedule clean. Brain quieter."
];

const celebrationLines = [
  "BANG. Off the board.",
  "Cooked. Next.",
  "One less thing haunting you.",
  "Absolutely dispatched.",
  "Donezo.",
  "That assignment just got folded.",
  "Calendar karma +10.",
  "Clean work, killer."
];

function dailyVibe(){
  const d=new Date();
  const key=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  return vibeLines[key % vibeLines.length];
}

function loadScore(){
  const today=eventsFor(new Date()).length;
  const due=upcomingTasks().filter(t=>new Date(t.due)-new Date()<86400000).length;
  const score=today+due*2;
  if(score<=2)return {label:"LIGHT WORK",emoji:"😌",cls:"light"};
  if(score<=5)return {label:"BUSY",emoji:"⚡",cls:"busy"};
  if(score<=8)return {label:"COOKED",emoji:"🔥",cls:"cooked"};
  return {label:"BOSS FIGHT",emoji:"☠️",cls:"boss"};
}

function confettiBurst(){
  const wrap=document.createElement("div");
  wrap.className="confetti-wrap";
  const glyphs=["✦","◆","●","★","✶","✹"];
  for(let i=0;i<34;i++){
    const s=document.createElement("span");
    s.textContent=glyphs[i%glyphs.length];
    s.style.left=`${45+Math.random()*10}%`;
    s.style.top=`${35+Math.random()*20}%`;
    s.style.setProperty("--x",`${(Math.random()-.5)*520}px`);
    s.style.setProperty("--y",`${-120-Math.random()*340}px`);
    s.style.setProperty("--r",`${Math.random()*720-360}deg`);
    s.style.animationDelay=`${Math.random()*80}ms`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),1200);
}

function hype(message){
  const h=document.createElement("div");
  h.className="hype-banner";
  h.innerHTML=`<b>${esc(message)}</b><span>Day Rush</span>`;
  document.body.appendChild(h);
  requestAnimationFrame(()=>h.classList.add("show"));
  setTimeout(()=>h.classList.remove("show"),1500);
  setTimeout(()=>h.remove(),1900);
}

function dayComplete(){
  const today=eventsFor(new Date());
  const openDue=getState().tasks.filter(t=>!t.completed && sameDay(t.due,new Date()));
  const now=new Date();
  const remaining=today.filter(e=>new Date(e.end)>now);
  return remaining.length===0 && openDue.length===0;
}

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
  x.className="toast";
  x.innerHTML=`<span class="toast-spark">✦</span><b>${esc(message)}</b>`;
  document.body.appendChild(x);
  requestAnimationFrame(()=>x.classList.add("show"));
  setTimeout(()=>x.classList.remove("show"),2100);
  setTimeout(()=>x.remove(),2500);
}
function setTab(next){
  tab=next; localStorage.setItem("dr-tab",tab);
  render(); window.scrollTo({top:0,behavior:"smooth"});
}

function topHeader(){
  const score=loadScore();
  return `<header class="topbar">
    <div>
      <span class="eyebrow">${fmtDay(new Date()).toUpperCase()}</span>
      <div class="brand-row"><h1>Day Rush</h1><span class="pulse-mark">●</span></div>
      <p class="vibe-line">${esc(dailyVibe())}</p>
    </div>
    <div class="top-actions">
      <span class="load-badge ${score.cls}">${score.emoji} ${score.label}</span>
      ${getState().settings.canvasUser?`<span class="sync-chip"><i></i> Canvas live</span>`:""}
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


function weekAhead(){
  const now=new Date();
  const end=new Date(now); end.setDate(end.getDate()+7);
  const ev=getState().events
    .filter(e=>new Date(e.start)>=now && new Date(e.start)<=end)
    .sort((a,b)=>new Date(a.start)-new Date(b.start))
    .slice(0,5);
  return ev;
}

function workloadSummary(){
  const now=new Date();
  const end=new Date(now); end.setDate(end.getDate()+7);
  const tasks=getState().tasks.filter(t=>!t.completed && new Date(t.due)>=now && new Date(t.due)<=end);
  const events=getState().events.filter(e=>new Date(e.start)>=now && new Date(e.start)<=end);
  const days=new Set(events.map(e=>new Date(e.start).toDateString()));
  return {tasks:tasks.length,events:events.length,activeDays:days.size};
}

function renderWeekStrip(){
  const today=new Date();
  const days=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()+i);return d});
  return `<section class="week-strip">
    ${days.map((d,i)=>{
      const count=eventsFor(d).length;
      const due=getState().tasks.filter(t=>!t.completed&&sameDay(t.due,d)).length;
      return `<button class="week-day ${i===0?"active":""}" data-jump-date="${d.toISOString()}">
        <span>${d.toLocaleDateString([], {weekday:"short"}).toUpperCase()}</span>
        <b>${d.getDate()}</b>
        <small>${count+due?`${count+due} item${count+due===1?"":"s"}`:"clear"}</small>
      </button>`;
    }).join("")}
  </section>`;
}

function renderMomentum(){
  const s=workloadSummary();
  const next=weekAhead();
  return `<section class="momentum-grid">
    <div class="momentum-card">
      <span class="eyebrow">NEXT 7 DAYS</span>
      <div class="stat-row">
        <div><b>${s.tasks}</b><small>due</small></div>
        <div><b>${s.events}</b><small>events</small></div>
        <div><b>${7-s.activeDays}</b><small>open days</small></div>
      </div>
    </div>
    <div class="momentum-card next-up-card">
      <span class="eyebrow">COMING UP</span>
      <div class="mini-upcoming">
        ${next.length?next.slice(0,3).map(e=>`<button data-edit-event="${e.id}"><b>${esc(e.title)}</b><small>${new Date(e.start).toLocaleDateString([], {weekday:"short"})} · ${fmtTime(e.start)}</small></button>`).join(""):`<div class="clear-week">Wide open. Go cause problems.</div>`}
      </div>
    </div>
  </section>`;
}

function renderToday(){
  const today=eventsFor(new Date());
  const n=new Date();
  const current=today.find(e=>new Date(e.start)<=n&&new Date(e.end)>=n);
  const next=today.find(e=>new Date(e.start)>n);
  const due=upcomingTasks().slice(0,4);
  const free=next?minutesBetween(n,next.start):0;

  return `<main class="simple-main">
    ${dayComplete()?`<section class="victory-strip"><span>🏁</span><div><b>DAY CLEARED</b><small>Nothing left can hurt you.</small></div></section>`:""}
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
        <div class="stack">${today.length?today.map(eventListCard).join(""):`<div class="empty">Nothing on the board. Glorious.</div>`}</div>
      </section>
      <section>
        <div class="section-title"><h3>Assignments</h3><span>${due.length}</span></div>
        <div class="canvas-summary">
          <div class="mini-ring" style="--p:${progressPct()}">${progressPct()}%</div>
          <div><b>${upcomingTasks().length} open Canvas items</b><small>${getState().settings.canvasUser?"Live Canvas data":"Canvas preview"}</small></div>
        </div>
        <div class="stack">${due.map(taskCard).join("")||`<div class="empty">Canvas is quiet. Suspiciously peaceful.</div>`}</div>
      </section>
    </div>
  ${renderWeekStrip()}${renderMomentum()}</main>`;
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
      ${calendarMode!=="month"?`<div class="zoom-control"><button id="zoomOut">−</button><span>Density</span><button id="zoomIn">+</button></div>`:""}
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
          ${es.length+ts.length>5?`<small>+${es.length+ts.length-5} more chaos</small>`:""}
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
    <div class="task-list">${all.length?all.map(taskCard).join(""):`<div class="empty">Task list is cleaner than a whistle.</div>`}</div>
  </main>`;
}

function renderInbox(){
  const inbox=getState().inbox;
  return `<main class="simple-main">
    <div class="page-head"><div><span class="eyebrow">INBOX</span><h2>${inbox.length} need review</h2><p>Nothing uncertain gets added without your approval.</p></div></div>
    <div class="stack">${inbox.length?inbox.map(i=>`<article class="inbox-card">
      <div><b>${esc(i.title)}</b><small>${esc(i.note)}</small></div>
      <div><button class="subtle-button" data-ignore="${esc(i.id)}">Ignore</button><button class="primary-button" data-confirm="${esc(i.id)}">Set date</button></div>
    </article>`).join(""):`<div class="empty">Inbox zero. Michelin-star behavior.</div>`}</div>
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
    t.completed=!t.completed;save();
    if(t.completed){
      confettiBurst();
      hype(celebrationLines[Math.floor(Math.random()*celebrationLines.length)]);
    }
    render();
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
    save();document.getElementById("eventDialog").close();
    if(id){toast("Event updated");}else{confettiBurst();hype("LOCKED IN.");}
    render();
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
      msg.textContent=`Canvas connected. ${result.taskCount} coursework items loaded.`;
      toast("Canvas homework synced"); setTimeout(render,500);
    }catch(err){msg.textContent=err.message;toast("Canvas connection failed");}
  });
}

function toggleTheme(){
  const next=getState().settings.theme==="dark"?"light":"dark";
  patchSettings({theme:next});localStorage.setItem("day-rush-theme",next);render();
}

render();
