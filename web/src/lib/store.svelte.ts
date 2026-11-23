// App state: tabs, the stack of pushed screens, sheets, the lock and the intents from widget buttons and actions.
import { tick } from "svelte";
import { authCheck, buzz, on, q, ready, type PhoneError } from "./phone";

export type Tab = "heute" | "verlauf" | "arzt";
export type Route = { name: "flare"; id: string } | { name: "all" };
export type Focus = "mood" | "today" | "end" | null;
type Intent = "noch-da" | "vorbei" | "neu" | "tagesform";

export const app = $state({
  tab: "heute" as Tab,
  stack: [] as Route[],
  sheet: null as null | "new" | "settings",
  tick: 0, // bumps whenever the data may have changed; screens reload on it
  focus: null as Focus,
  toast: "",
  fx: 0, // bumps for a little confetti
  locked: false,
  lockText: "Mit Face ID öffnest du dein Tagebuch.",
  lockOn: localStorage.getItem("lock") === "1",
  started: false,
});

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const motion = (ms: number) => (reducedMotion() ? 0 : ms);

let toastTimer = 0;
export function toast(text: string) {
  app.toast = text;
  clearTimeout(toastTimer);
  if (text) toastTimer = window.setTimeout(() => { app.toast = ""; }, 4000);
}
export const quiet = (e: unknown) => { const err = e as PhoneError | undefined; if (err && err.code !== "Cancelled") toast(err.message || "Das hat nicht geklappt."); };
export const refresh = () => { app.tick++; };
export const confetti = () => { if (!reducedMotion()) app.fx++; };

export const push = (route: Route, focus: Focus = null) => { app.focus = focus; app.stack.push(route); };
export const pop = () => { app.stack.pop(); toast(""); };
export const openNew = () => { app.sheet = "new"; };
export const setTab = (t: Tab) => { app.tab = t; };

/** Scroll an element into the middle of the screen and focus its first control (used by widget buttons and actions). */
export async function reveal(id: string) {
  await tick();
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  el.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
}

// ---- Face ID lock
export function setLockOn(v: boolean) {
  app.lockOn = v;
  if (v) localStorage.setItem("lock", "1"); else localStorage.removeItem("lock");
}
const unavailable = (e: PhoneError) => e.code === "NotAllowed" || e.code === "Unavailable" || e.code === "NotDeclared";
export function lockMessage(e: PhoneError, enabling: boolean) {
  if (unavailable(e)) return enabling
    ? "Face ID ist hier nicht verfügbar oder für dieses Tagebuch ausgeschaltet. Du kannst es in den Einstellungen des Spaces erlauben."
    : "Face ID ist gerade nicht verfügbar. Schalte es in den Einstellungen des Spaces ein oder wähle einen anderen Weg, dein iPhone zu entsperren.";
  if (e.code === "Cancelled") return enabling ? "" : "Abgebrochen. Tippe auf Entsperren, um es noch einmal zu versuchen.";
  return e.message;
}
export async function enableLock() {
  try { await authCheck("Schub-Tagebuch schützen"); setLockOn(true); toast("Face ID ist an."); buzz("success"); return true; }
  catch (e) { toast(lockMessage(e as PhoneError, true)); return false; }
}
export function disableLock() { setLockOn(false); toast("Face ID ist aus."); }

let authing = false, quietUntil = 0;
function lock() {
  if (!app.lockOn || app.locked) return;
  app.locked = true; app.lockText = "Mit Face ID öffnest du dein Tagebuch."; app.sheet = null;
}
export async function unlock() {
  if (authing) return;
  authing = true;
  try {
    await authCheck("Schub-Tagebuch öffnen");
    app.locked = false; quietUntil = Date.now() + 2000; refresh();
    if (app.started) void runIntent();
  } catch (e) { app.lockText = lockMessage(e as PhoneError, false); }
  finally { authing = false; }
}

// ---- widget buttons and phone actions: phone.on("notification", {page}) and phone.on("action", {id})
let intent: Intent | null = null;
const INTENTS: Record<string, Intent> = { "noch-da": "noch-da", vorbei: "vorbei", neu: "neu", tagesform: "tagesform", "neuer-schub": "neu" };
function takeIntent(kind: Intent) { intent = kind; if (app.started && !app.locked) void runIntent(); }
async function runIntent() {
  const k = intent; intent = null;
  if (!k) return;
  try {
    if (k === "neu") { openNew(); return; }
    if (k === "tagesform") { app.stack = []; app.tab = "heute"; app.focus = "mood"; return; }
    const run = await q("SELECT id FROM schuebe WHERE ende IS NULL ORDER BY start DESC LIMIT 1");
    if (!run.length) { toast("Gerade läuft kein Schub."); app.stack = []; app.tab = "heute"; return; }
    app.sheet = null;
    app.stack = [{ name: "flare", id: run[0].id }];
    app.focus = k === "noch-da" ? "today" : "end";
  } catch (e) { quiet(e); }
}

export function start() {
  on("notification", (n) => { const k = INTENTS[n?.page]; if (k) takeIntent(k); });
  on("action", (a) => { const k = INTENTS[a?.id]; if (k) takeIntent(k); });
  on("rows", () => { if (!app.locked) refresh(); });
  on("resume", () => { if (authing || Date.now() < quietUntil) return; if (app.lockOn) lock(); else refresh(); });
  ready().then(() => {
    if (app.lockOn) lock();
    app.started = true;
    if (!app.locked) void runIntent();
  }, quiet);
}
