export const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

export const toDate = value => value instanceof Date ? value : new Date(value);

export const sameDay = (a,b) => toDate(a).toDateString() === toDate(b).toDateString();

export const fmtTime = value =>
  new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(toDate(value));

export const fmtDay = value =>
  new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"}).format(toDate(value));

export const fmtShort = value =>
  new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"}).format(toDate(value));

export const fmtDue = value => {
  const d = toDate(value);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1);
  if (sameDay(d,today)) return `Today · ${fmtTime(d)}`;
  if (sameDay(d,tomorrow)) return `Tomorrow · ${fmtTime(d)}`;
  return `${fmtShort(d)} · ${fmtTime(d)}`;
};

export const uid = () =>
  (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const minutesBetween = (a,b) => Math.max(0, Math.round((toDate(b)-toDate(a))/60000));

export const humanDuration = mins => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins/60), m = mins%60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const safeJson = async response => {
  try { return await response.json(); } catch { return null; }
};
