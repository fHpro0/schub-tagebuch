// App state: tabs, the stack of pushed screens, sheets, the lock and the intents from widget buttons and actions.
import { tick } from "svelte";
import { authCheck, buzz, on, q, ready, type PhoneError } from "./phone";
import { todayState, type DayState } from "./flow";

export type Tab = "heute" | "verlauf" | "arzt";
export type Route = { name: "flare"; id: string } | { name: "all" };
export type Sheet = null | "new" | "settings" | "day" | "end" | "mood";

export const app = $state({
  tab: "heute" as Tab,
  stack: [] as Route[],
  sheet: null as Sheet,
  day: null as null | (DayState & { kind: "noch-da" | "staerke" }), // what the "noch da" / "Stärke heute" sheet shows
  tick: 0, // bumps whenever the data may have changed; screens reload on it
  toast: "",
  toastAction: null as null | { label: string; run: () => void },
  fx: 0, // bumps for a little confetti
  locked: false,
  lockText: "Mit Face ID öffnest du dein Tagebuch.",
  lockOn: localStorage.getItem("lock") === "1",
  started: false,
});

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const motion = (ms: number) => (reducedMotion() ? 0 : ms);

let toastTimer = 0;
export function toast(text: string, action: { label: string; run: () => void } | null = null) {
  app.toast = text; app.toastAction = action;
  clearTimeout(toastTimer);
  if (text) toastTimer = window.setTimeout(() => { app.toast = ""; app.toastAction = null; }, action ? 7000 : 4000);
}
export const quiet = (e: unknown) => { const err = e as PhoneError | undefined; if (err && err.code !== "Cancelled") toast(err.message || "Das hat nicht geklappt."); };
export const refresh = () => { app.tick++; };
export const confetti = () => { if (!reducedMotion()) app.fx++; };

export const push = (route: Route) => { app.stack.push(route); };
export const pop = () => { app.stack.pop(); toast(""); };
export const openNew = () => { app.sheet = "new"; };
export const setTab = (t: Tab) => { app.tab = t; };

// ---- the sheets: the same ones for the widget buttons, the actions and the buttons in the app
/** Back to a clean Heute: nothing pushed, no sheet. */
export function closeAll() { app.sheet = null; app.day = null; app.stack = []; app.tab = "heute"; }
/** "noch da" (writes today's row first) or "staerke" (just shows it). Safe to call twice: a second call changes nothing
 *  (the row is written with ON CONFLICT DO NOTHING). Calls run one after the other (see `intents`), so a later tap is
 *  never dropped because an earlier one was still busy. */
export async function startDay(kind: "noch-da" | "staerke") {
  if (app.sheet === "day" && app.day?.kind === kind) return;
  try {
    const st = await todayState(kind === "noch-da");
    closeAll();
    if (!st) { toast("Gerade läuft kein Schub.", { label: "Neuer Schub", run: openNew }); return; }
    app.day = { ...st, kind }; app.sheet = "day"; refresh();
  } catch (e) { quiet(e); }
}
export async function startEnd() {
  if (app.sheet === "end") return;
  try {
    const run = await q("SELECT id FROM schuebe WHERE ende IS NULL LIMIT 1");
    closeAll();
    if (!run.length) { toast("Gerade läuft kein Schub.", { label: "Neuer Schub", run: openNew }); return; }
    app.sheet = "end";
  } catch (e) { quiet(e); }
}
export function startMood() { if (app.sheet === "mood") return; closeAll(); app.sheet = "mood"; }
export function startNew() { if (app.sheet === "new") return; closeAll(); app.sheet = "new"; }

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
// An event can come before the data is there, or while Face ID has the app locked: it waits for both.
type Intent = "noch-da" | "staerke" | "vorbei" | "neu" | "tagesform" | "heute";
let intent: Intent | null = null;
// one at a time, in order: two taps close together (an old place and a new tap at start-up) both run, the last one wins
let intents: Promise<void> = Promise.resolve();
const INTENTS: Record<string, Intent> = { "noch-da": "noch-da", staerke: "staerke", vorbei: "vorbei", neu: "neu", tagesform: "tagesform", heute: "heute", "neuer-schub": "neu" };
function takeIntent(kind: Intent) { intent = kind; if (app.started && !app.locked) void runIntent(); }
function runIntent(): Promise<void> {
  intents = intents.then(runOne, runOne);
  return intents;
}
async function runOne() {
  const k = intent; intent = null;
  if (!k) return;
  if (k === "noch-da" || k === "staerke") await startDay(k);
  else if (k === "vorbei") await startEnd();
  else if (k === "tagesform") startMood();
  else if (k === "neu") startNew();
  else closeAll();
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
