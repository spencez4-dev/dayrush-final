const semesterStart = "2026-08-24";
const semesterEnd = "2026-12-04";

const weekly = {
  1: [
    ["Wayfinder","07:00","14:00","work","Remote"],
    ["GLG 121-A","14:50","16:10","school","Shideler Hall 152"]
  ],
  2: [
    ["ESP 251-C","11:40","13:00","school","Farmer School of Business 1006"],
    ["BUS 284-Q","13:15","14:35","school","Irvin Hall 118 / Web-Based Curriculum"],
    ["ISA 225-I","14:50","16:10","school","Farmer School of Business 1023"],
    ["MGT 295-B","16:25","17:45","school","Farmer School of Business 28"]
  ],
  3: [
    ["Wayfinder","07:00","14:00","work","Remote"],
    ["GLG 121-A","14:50","16:10","school","Shideler Hall 152"]
  ],
  4: [
    ["ESP 251-C","11:40","13:00","school","Farmer School of Business 1006"],
    ["BUS 284-Q","13:15","14:35","school","Irvin Hall 118 / Web-Based Curriculum"],
    ["ISA 225-I","14:50","16:10","school","Farmer School of Business 1023"],
    ["MGT 295-B","16:25","17:45","school","Farmer School of Business 28"]
  ],
  5: [
    ["Wayfinder","09:00","15:00","work","Remote"]
  ]
};

const beta = [
  ["Rolling Loud @ Lambda × Fiji × A Delt","2026-09-03T20:00:00-04:00","2026-09-03T23:59:00-04:00"],
  ["CJ's Date Party","2026-09-04T20:00:00-04:00","2026-09-04T22:00:00-04:00"],
  ["Pre Beat @ Nash × AXID","2026-09-05T20:00:00-04:00","2026-09-05T23:59:00-04:00"],
  ["Mimosa @ Rage × KD","2026-09-12T12:00:00-04:00","2026-09-12T14:00:00-04:00"],
  ["Silo × KD","2026-09-12T14:00:00-04:00","2026-09-12T16:00:00-04:00"],
  ["Devault @ Sig Chi","2026-09-17T21:00:00-04:00","2026-09-17T23:00:00-04:00"],
  ["Prebeat × Kappa @ Rage","2026-09-19T23:00:00-04:00","2026-09-20T00:00:00-04:00"],
  ["CJ's × Kappa","2026-09-19T12:00:00-04:00","2026-09-19T14:00:00-04:00"],
  ["Dad's Weekend","2026-09-25T00:00:00-04:00","2026-09-27T23:59:00-04:00"],
  ["Semi @ Fontana Dam, NC","2026-10-02T00:00:00-04:00","2026-10-04T23:59:00-04:00"],
  ["Fall Break","2026-10-09T00:00:00-04:00","2026-10-11T23:59:00-04:00"],
  ["CJ's × ZTA","2026-10-17T12:00:00-04:00","2026-10-17T14:00:00-04:00"],
  ["CJ's Date Party","2026-10-24T20:00:00-04:00","2026-10-24T22:00:00-04:00"],
  ["Xandra @ Lambda × D Chi","2026-10-29T20:00:00-04:00","2026-10-29T23:59:00-04:00"],
  ["CJ's × ZTA","2026-11-12T20:00:00-05:00","2026-11-12T22:00:00-05:00"],
  ["CJ's Date Party","2026-11-20T20:00:00-05:00","2026-11-20T22:00:00-05:00"],
  ["ZTA Wedding @ Rage","2026-11-21T19:00:00-05:00","2026-11-21T20:00:00-05:00"]
];

const initialCanvasPreview = [
  ["canvas-preview-1","ISA 225","M1 HW Chapter 10-11","2026-08-31T23:59:00-04:00",20],
  ["canvas-preview-2","ISA 225","Assignment 1","2026-08-31T23:59:00-04:00",10],
  ["canvas-preview-3","ESP 251","Module 1 Quiz","2026-09-01T12:00:00-04:00",50],
  ["canvas-preview-4","BUS 284","Discussions: LinkedIn Project","2026-09-01T14:50:00-04:00",10],
  ["canvas-preview-5","ISA 225","Quiz 1 Ch10-11","2026-09-01T16:10:00-04:00",10]
];

const makeLocalISO = (date, time) => `${date}T${time}:00`;

export function buildSeed(){
  const events = [];
  const start = new Date(`${semesterStart}T00:00:00`);
  const end = new Date(`${semesterEnd}T23:59:59`);
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate()+1)) {
    const rows = weekly[cursor.getDay()] || [];
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth()+1).padStart(2,"0");
    const d = String(cursor.getDate()).padStart(2,"0");
    const date = `${y}-${m}-${d}`;
    rows.forEach(([title,s,e,type,location], idx) => {
      events.push({
        id:`seed-${date}-${idx}-${title.replace(/\W/g,"").slice(0,10)}`,
        title, start:makeLocalISO(date,s), end:makeLocalISO(date,e),
        type, location, source:"seed"
      });
    });
  }

  beta.forEach(([title,start,end],idx) => events.push({
    id:`beta-${idx}`,title,start,end,type:"beta",location:"",source:"seed"
  }));

  const tasks = initialCanvasPreview.map(([id,course,title,due,points]) => ({
    id,course,title,due,points,completed:false,source:"canvas-preview",
    canvasUrl:null,submissionState:null
  }));

  const inbox = [{
    id:"uncertain-zta-afters",
    title:"ZTA Afters @ CJ's",
    note:"Date was unclear in the source screenshot. Leave TBD until confirmed.",
    confidence:"low",
    type:"beta"
  }];

  return {events,tasks,inbox};
}
