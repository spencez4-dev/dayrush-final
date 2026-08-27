import { buildSeed } from "./seed.js";

const KEY = "day-rush-state-v2";
const TOKEN_KEY = "day-rush-canvas-token";
const BASE_KEY = "day-rush-canvas-base";
const REMEMBER_KEY = "day-rush-canvas-remember";
const CANVAS_FEED_KEY = "day-rush-canvas-feed";

const baseState = () => ({
  ...buildSeed(),
  settings:{
    theme: localStorage.getItem("day-rush-theme") || "dark",
    canvasBase: localStorage.getItem(BASE_KEY) || "https://miamioh.instructure.com",
    rememberCanvas: localStorage.getItem(REMEMBER_KEY) === "true",
    lastCanvasSync:null,
    canvasUser:null,
    canvasProxy: localStorage.getItem("day-rush-canvas-proxy") || "",
    canvasFeedUrl: localStorage.getItem(CANVAS_FEED_KEY) || ""
  }
});

let state = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return saved ? {...baseState(), ...saved, settings:{...baseState().settings,...(saved.settings||{})}} : baseState();
  } catch { return baseState(); }
})();

let runtimeCanvasToken = state.settings.rememberCanvas
  ? (localStorage.getItem(TOKEN_KEY) || "")
  : (sessionStorage.getItem(TOKEN_KEY) || "");

const listeners = new Set();

export const getState = () => state;
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const save = () => {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach(fn => fn(state));
};
export const patch = partial => { state = {...state,...partial}; save(); };
export const patchSettings = partial => {
  state.settings = {...state.settings,...partial};
  save();
};


export const setCanvasFeedUrl = feed => {
  const clean = String(feed || "").trim();
  if (clean) localStorage.setItem(CANVAS_FEED_KEY, clean);
  else localStorage.removeItem(CANVAS_FEED_KEY);
  patchSettings({canvasFeedUrl:clean});
};

export const setCanvasProxy = proxy => {
  const clean = String(proxy || "").trim().replace(/\/+$/,"");
  localStorage.setItem("day-rush-canvas-proxy", clean);
  patchSettings({canvasProxy:clean});
};

export const setCanvasBase = base => {
  const clean = base.replace(/\/$/,"");
  localStorage.setItem(BASE_KEY, clean);
  patchSettings({canvasBase:clean});
};
export const setCanvasToken = (token, remember=false) => {
  runtimeCanvasToken = token;
  localStorage.setItem(REMEMBER_KEY, remember ? "true":"false");
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
  patchSettings({rememberCanvas:remember});
};
export const getCanvasToken = () => runtimeCanvasToken;
export const clearCanvasToken = () => {
  runtimeCanvasToken="";
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  patchSettings({canvasUser:null,lastCanvasSync:null});
};
export const resetAll = () => {
  localStorage.removeItem(KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  state = baseState();
  save();
};
