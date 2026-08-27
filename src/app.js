import {
  getState, save, patchSettings, setCanvasBase, setCanvasProxy, setCanvasToken, getCanvasToken,
  clearCanvasToken, resetAll
} from "./store.js";
import { syncCanvas } from "./canvas.js";
import { esc, fmtTime, fmtDay, fmtShort, fmtDue, sameDay, uid, minutesBetween, humanDuration } from "./utils.js";

const app = document.getElementById("app");
let tab = "today";

const typeLabel = t => ({school:"School",work:"Work",beta:"Beta",music:"Music",personal:"Personal"})[t] || "Event";

function upcomingEvents(){
  const now = new Date();
  return getState().events.filter(e => new Date(e.end) >= now).sort((a,b)=>new Date(a.start)-new Date(b.start));
}
function eventsFor(day){
  return getState().events.filter(e => sameDay(e.start,day)).sort((a,b)=>new Date(a.start)-new Date(b.start));
}
function upcomingTasks(){
  return getState().tasks.filter(t => !t.completed && new Date(t.due) >= new Date(Date.now()-86400000))
    .sort((a,b)=>new Date(a.due)-new Date(b.due));
}
function progressPct(){
  const tasks=getState().tasks.filter(t=>t.source==="canvas"||t.source==="canvas-preview");
  if(!tasks.length) return 0;
  return Math.round(tasks.filter(t=>t.completed).length/tasks.length*100);
}
function nowStatus(){
  const todays = eventsFor(new Date());
  const current = todays.find(e => new Date(e.start)<=new Date() && new Date(e.end)>=new Date());
  const next = todays.find(e => new Date(e.start)>new Date());
  if(current) return {kicker:"RIGHT NOW",title:current.title,sub:`Until ${fmtTime(current.end)} · ${typeLabel(current.type)}`};
  if(next) return {kicker:"OPEN WINDOW",title:`Free until ${fmtTime(next.start)}`,sub:`Next: ${next.title}`};
  return {kicker:"TODAY",title:"You’re clear.",sub:"Nothing else locked on the schedule."};
}
function eventCard(e){
  return `<article class="event-card ${e.type||"personal"}">
    <div class="stripe"></div>
    <div class="event-copy">
      <strong>${esc(e.title)}</strong>
      <span>${esc(e.location || typeLabel(e.type))}</span>
    </div>
    <div class="event-clock">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></div>
  </article>`;
}
function taskCard(t){
  return `<article class="task-card ${t.completed?"done":""}">
    <button class="task-check" data-task="${esc(t.id)}">${t.completed?"✓":""}</button>
    <div class="task-copy">
      <span class="course">${esc(t.course)}</span>
      <strong>${esc(t.title)}</strong>
      <small>${fmtDue(t.due)}${t.points!=null?` · ${t.points} pts`:""}${t.source==="canvas"?" · Canvas":""}</small>
    </div>
    ${t.canvasUrl?`<a class="launch" href="${esc(t.canvasUrl)}" target="_blank" rel="noopener">↗</a>`:""}
  </article>`;
}
function openWindow(){
  const es = eventsFor(new Date());
  const now = new Date();
  const next = es.find(e=>new Date(e.start)>now);
  if(!next) return null;
  const mins = minutesBetween(now,next.start);
  return mins >= 30 ? {mins,next} : null;
}
function conflicts(){
  const es = upcomingEvents().slice(0,100);
  const out=[];
  for(let i=0;i<es.length;i++){
    for(let j=i+1;j<es.length;j++){
      if(new Date(es[j].start)>new Date(es[i].end)) break;
      if(new Date(es[j].start)<new Date(es[i].end) && new Date(es[j].end)>new Date(es[i].start)){
        out.push([es[i],es[j]]);
      }
    }
  }
  return out.slice(0,3);
}
function canvasBadge(){
  const s=getState().settings;
  if(s.canvasUser) return `<span class="badge ok">Canvas live</span>`;
  return `<span class="badge">Canvas preview</span>`;
}
function renderToday(){
  const status=nowStatus();
  const today=eventsFor(new Date());
  const due=upcomingTasks().slice(0,4);
  const ow=openWindow();
  const cs=conflicts();
  return `
  <section class="hero">
    <div class="eyebrow">${status.kicker}</div>
    <h2>${esc(status.title)}</h2>
    <p>${esc(status.sub)}</p>
  </section>

  ${ow?`<section class="smart-card">
    <div><span class="eyebrow">FREE WINDOW</span><strong>${humanDuration(ow.mins)} open</strong><small>until ${ow.next.title}</small></div>
    ${due[0]?`<div class="smart-suggestion">Best target: <b>${esc(due[0].course)} · ${esc(due[0].title)}</b></div>`:""}
  </section>`:""}

  <section class="section">
    <div class="section-head"><h3>Today</h3><span class="badge">${today.length} commitments</span></div>
    ${today.length?today.map(eventCard).join(""):`<div class="empty">Nothing scheduled. Rare sighting.</div>`}
  </section>

  <section class="section">
    <div class="section-head"><h3>School pulse</h3>${canvasBadge()}</div>
    <div class="progress-card">
      <div class="ring" style="--p:${progressPct()}" data-label="${progressPct()}%"></div>
      <div><strong>${upcomingTasks().length} open Canvas items</strong><small>${getState().settings.lastCanvasSync?`Synced ${fmtShort(getState().settings.lastCanvasSync)} ${fmtTime(getState().settings.lastCanvasSync)}`:"Connect Canvas in You"}</small></div>
    </div>
    ${due.map(taskCard).join("") || `<div class="empty">No assignments due soon.</div>`}
  </section>

  ${cs.length?`<section class="section">
    <div class="section-head"><h3>Heads up</h3><span class="badge warning">Conflict check</span></div>
    ${cs.map(([a,b])=>`<div class="warning-card"><strong>Schedule overlap</strong><span>${esc(a.title)} overlaps ${esc(b.title)}</span></div>`).join("")}
  </section>`:""}

  <section class="section">
    <div class="section-head"><h3>Coming up</h3></div>
    ${upcomingEvents().slice(0,5).map(e=>`<div class="mini-row"><div><strong>${esc(e.title)}</strong><small>${fmtShort(e.start)} · ${fmtTime(e.start)}</small></div><span class="dot ${e.type}"></span></div>`).join("")}
  </section>`;
}
function renderWeek(){
  const monday=new Date();
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  monday.setHours(0,0,0,0);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return d;});

  const startHour=7, endHour=24, hourHeight=72;
  const totalHeight=(endHour-startHour)*hourHeight;
  const hours=Array.from({length:endHour-startHour+1},(_,i)=>startHour+i);

  const eventBlocks = days.map((day,di)=>{
    const es=eventsFor(day);
    return es.map(e=>{
      const s=new Date(e.start), en=new Date(e.end);
      let startMin=(s.getHours()*60+s.getMinutes())-startHour*60;
      let endMin=(en.getHours()*60+en.getMinutes())-startHour*60;
      startMin=Math.max(0,startMin);
      endMin=Math.min((endHour-startHour)*60,endMin);
      if(endMin<=0 || startMin >= (endHour-startHour)*60) return "";
      const top=(startMin/60)*hourHeight;
      const height=Math.max(28,((endMin-startMin)/60)*hourHeight);
      return `<div class="cal-event ${e.type||"personal"}" style="top:${top}px;height:${height}px">
        <strong>${esc(e.title)}</strong>
        <span>${fmtTime(e.start)}–${fmtTime(e.end)}</span>
        ${e.location?`<small>${esc(e.location)}</small>`:""}
      </div>`;
    }).join("");
  });

  const taskBuckets = days.map(day =>
    getState().tasks
      .filter(t=>sameDay(t.due,day))
      .sort((a,b)=>new Date(a.due)-new Date(b.due))
  );

  return `<section class="calendar-shell">
    <div class="calendar-head">
      <div class="calendar-corner">TIME</div>
      ${days.map(d=>`<div class="calendar-day-head ${sameDay(d,new Date())?"today":""}">
        <span>${new Intl.DateTimeFormat("en-US",{weekday:"short"}).format(d)}</span>
        <strong>${d.getDate()}</strong>
        <small>${new Intl.DateTimeFormat("en-US",{month:"short"}).format(d)}</small>
      </div>`).join("")}
    </div>

    <div class="calendar-tasks-row">
      <div class="calendar-corner">DUE</div>
      ${taskBuckets.map(tasks=>`<div class="calendar-task-cell">
        ${tasks.length?tasks.map(t=>`<div class="calendar-task ${t.completed?"done":""}">
          <b>${esc(t.course)}</b>
          <span>${esc(t.title)}</span>
          <small>${fmtTime(t.due)}</small>
        </div>`).join(""):`<div class="calendar-task-empty">—</div>`}
      </div>`).join("")}
    </div>

    <div class="calendar-body" style="--hour-h:${hourHeight}px; --grid-h:${totalHeight}px">
      <div class="calendar-time-col" style="height:${totalHeight}px">
        ${hours.slice(0,-1).map((h,i)=>`<div class="calendar-time" style="top:${i*hourHeight}px">${new Intl.DateTimeFormat("en-US",{hour:"numeric"}).format(new Date(2026,0,1,h,0))}</div>`).join("")}
      </div>
      ${days.map((d,di)=>`<div class="calendar-day-col ${sameDay(d,new Date())?"today-col":""}" style="height:${totalHeight}px">
        ${hours.slice(0,-1).map((h,i)=>`<div class="calendar-hour-line" style="top:${i*hourHeight}px"></div>`).join("")}
        ${eventBlocks[di]}
      </div>`).join("")}
    </div>
  </section>`;
}
function renderTasks(){
  const all=[...getState().tasks].sort((a,b)=>new Date(a.due)-new Date(b.due));
  return `<section class="hero small-hero"><div class="eyebrow">TASKS</div><h2>${upcomingTasks().length} still alive</h2><p>Canvas assignments + anything you add yourself.</p></section>
  <section class="section">${all.length?all.map(taskCard).join(""):`<div class="empty">No tasks yet.</div>`}</section>`;
}
function renderInbox(){
  const inbox=getState().inbox;
  return `<section class="hero small-hero"><div class="eyebrow">INBOX</div><h2>Drop the chaos here.</h2><p>Uncertain screenshot imports wait for your confirmation instead of guessing.</p></section>
  <section class="section">
    <div class="section-head"><h3>Needs confirmation</h3><span class="badge">${inbox.length}</span></div>
    ${inbox.length?inbox.map(i=>`<article class="inbox-card"><strong>${esc(i.title)}</strong><span>${esc(i.note)}</span><div class="row-actions"><button class="subtle" data-ignore="${esc(i.id)}">Ignore</button><button class="primary" data-confirm="${esc(i.id)}">Set date</button></div></article>`).join(""):`<div class="empty">Inbox zero. Beautiful.</div>`}
  </section>`;
}
function renderYou(){
  const s=getState().settings;
  const hasToken=Boolean(getCanvasToken());
  return `<section class="hero small-hero"><div class="eyebrow">YOU</div><h2>Desktop command center.</h2><p>Canvas is the first real integration.</p></section>
  <section class="section">
    <div class="section-head"><h3>Canvas</h3>${s.canvasUser?`<span class="badge ok">Connected</span>`:`<span class="badge">Not connected</span>`}</div>
    <div class="settings-card">
      ${s.canvasUser?`<div class="identity"><strong>${esc(s.canvasUser.name)}</strong><span>${s.canvasUser.primary_email?esc(s.canvasUser.primary_email):"Miami Canvas"}</span></div>`:""}
      <label>Canvas URL<input id="canvasBase" value="${esc(s.canvasBase)}"></label>
      <label>Canvas Proxy URL<input id="canvasProxy" value="${esc(s.canvasProxy||"")}" placeholder="https://your-worker.workers.dev"></label>
      <label>Access token<input id="canvasToken" type="password" placeholder="${hasToken?"Token loaded on this device":"Paste your Canvas token"}" autocomplete="off"></label>
      <label class="remember"><input id="rememberToken" type="checkbox" ${s.rememberCanvas?"checked":""}><span>Remember token on this device</span></label>
      <div class="security-note">The token stays on your device. The proxy URL is safe to save in GitHub; the Canvas token is not.</div>
      <div class="button-stack">
        <button class="primary full" id="connectCanvas">${s.canvasUser?"Refresh Canvas":"Connect Canvas"}</button>
        ${hasToken?`<button class="subtle full" id="disconnectCanvas">Forget Canvas token</button>`:""}
      </div>
      <div id="canvasMessage" class="status-message">${s.lastCanvasSync?`Last sync: ${fmtShort(s.lastCanvasSync)} ${fmtTime(s.lastCanvasSync)}`:""}</div>
    </div>
  </section>
  <section class="section">
    <div class="section-head"><h3>Appearance</h3></div>
    <div class="settings-card"><button class="subtle full" id="toggleTheme">Toggle dark / light</button></div>
  </section>
  <section class="section">
    <div class="section-head"><h3>Prototype</h3></div>
    <div class="settings-card"><button class="danger full" id="resetApp">Reset Day Rush data</button></div>
  </section>`;
}
function render(){
  const s=getState();
  document.body.classList.toggle("light",s.settings.theme==="light");
  app.innerHTML=`
    <div class="shell">
      <header class="topbar">
        <div><span class="eyebrow">${fmtDay(new Date()).toUpperCase()}</span><h1>Day Rush</h1></div>
        ${s.settings.canvasUser?`<span class="live-dot" title="Canvas connected"></span>`:""}
      </header>
      <main>${tab==="today"?renderToday():tab==="week"?renderWeek():tab==="tasks"?renderTasks():tab==="inbox"?renderInbox():renderYou()}</main>
      <button class="fab" id="fab">+</button>
      <nav class="tabbar">
        ${[["today","◉","Today"],["week","▦","Calendar"],["tasks","✓","Tasks"],["inbox","↓","Inbox"],["you","⌁","You"]].map(([id,icon,label])=>`<button class="${tab===id?"active":""}" data-tab="${id}"><span>${icon}</span><small>${label}</small></button>`).join("")}
      </nav>
    </div>
    <dialog id="addSheet">
      <form method="dialog" id="addForm">
        <div class="handle"></div>
        <div class="sheet-head"><h3>Add commitment</h3><button value="cancel" class="subtle">Close</button></div>
        <label>Title<input id="newTitle" required placeholder="Band practice"></label>
        <div class="two"><label>Date<input id="newDate" type="date" required></label><label>Type<select id="newType"><option value="personal">Personal</option><option value="school">School</option><option value="work">Work</option><option value="beta">Beta</option><option value="music">Music</option></select></label></div>
        <div class="two"><label>Start<input id="newStart" type="time"></label><label>End<input id="newEnd" type="time"></label></div>
        <label>Location<input id="newLocation" placeholder="Optional"></label>
        <button value="default" class="primary full">Add to Day Rush</button>
      </form>
    </dialog>`;
  bind();
}
function toast(message){
  const x=document.createElement("div");x.className="toast";x.textContent=message;document.body.appendChild(x);setTimeout(()=>x.remove(),2800);
}
function bind(){
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.onclick=()=>{tab=btn.dataset.tab;render();scrollTo({top:0,behavior:"smooth"});});
  document.querySelectorAll("[data-task]").forEach(btn=>btn.onclick=()=>{
    const task=getState().tasks.find(t=>t.id===btn.dataset.task);
    if(task && task.source!=="canvas"){task.completed=!task.completed;save();render();}
    else if(task){toast("Canvas controls completion for synced assignments.");}
  });
  document.querySelectorAll("[data-ignore]").forEach(btn=>btn.onclick=()=>{getState().inbox=getState().inbox.filter(i=>i.id!==btn.dataset.ignore);save();render();});
  document.querySelectorAll("[data-confirm]").forEach(btn=>btn.onclick=()=>toast("Date confirmation editor is the next Inbox upgrade."));
  const sheet=document.getElementById("addSheet");
  const fab=document.getElementById("fab");
  fab.onclick=()=>{document.getElementById("newDate").value=new Date().toISOString().slice(0,10);sheet.showModal();};
  document.getElementById("addForm").onsubmit=e=>{
    if(e.submitter?.value==="cancel") return;
    e.preventDefault();
    const date=document.getElementById("newDate").value;
    const start=document.getElementById("newStart").value||"12:00";
    const end=document.getElementById("newEnd").value||start;
    getState().events.push({
      id:uid(),title:document.getElementById("newTitle").value,
      start:`${date}T${start}:00`,end:`${date}T${end}:00`,
      type:document.getElementById("newType").value,
      location:document.getElementById("newLocation").value,
      source:"manual"
    });
    save(); sheet.close(); toast("Added."); render();
  };
  document.getElementById("toggleTheme")?.addEventListener("click",()=>{
    const next=getState().settings.theme==="dark"?"light":"dark";
    patchSettings({theme:next});localStorage.setItem("day-rush-theme",next);render();
  });
  document.getElementById("connectCanvas")?.addEventListener("click",async()=>{
    const msg=document.getElementById("canvasMessage");
    const base=document.getElementById("canvasBase").value.trim();
    const proxy=document.getElementById("canvasProxy").value.trim();
    const typed=document.getElementById("canvasToken").value.trim();
    const remember=document.getElementById("rememberToken").checked;
    setCanvasBase(base);
    setCanvasProxy(proxy);
    if(typed) setCanvasToken(typed,remember);
    else if(getCanvasToken()) setCanvasToken(getCanvasToken(),remember);
    if(!getCanvasToken()){msg.textContent="Paste your Canvas token first.";return;}
    msg.textContent="Connecting to Miami Canvas…";
    try{
      const result=await syncCanvas();
      msg.textContent=`Connected as ${result.profile.name}. Imported ${result.count} planner items.`;
      toast(`Canvas live · ${result.count} items`);
      setTimeout(render,700);
    }catch(err){
      msg.textContent=err.message;
      toast("Canvas connection failed.");
    }
  });
  document.getElementById("disconnectCanvas")?.addEventListener("click",()=>{clearCanvasToken();toast("Canvas token forgotten.");render();});
  document.getElementById("resetApp")?.addEventListener("click",()=>{
    if(confirm("Reset Day Rush back to the starter schedule?")){resetAll();location.reload();}
  });
}
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
render();
