// Local days as YYYY-MM-DD (how SQLite stores them), shown the German way.
export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
const utc = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const diff = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000);
export const de = (s: string) => { const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; };
export const deShort = (s: string) => { const [, m, d] = s.split("-"); return `${d}.${m}.`; };
export const rel = (s: string) => { const n = diff(s, today()); return n === 0 ? "Heute" : n === 1 ? "Gestern" : de(s); };
export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
/** "seit 1 Tag" / "seit 4 Tagen" */
export const daysSince = (n: number) => `${n} ${n === 1 ? "Tag" : "Tagen"}`;
/** "1 Tag" / "4 Tage" */
export const dayCount = (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`;
/** A number with the German decimal comma. */
export const num = (n: number | string) => String(n).replace(".", ",");
export const longToday = () => new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
export const hex16 = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
