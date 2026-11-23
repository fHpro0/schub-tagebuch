// What the diary reads: flares with their symptoms, energy and month series, and the text for the doctor.
import { q, type Row } from "./phone";
import { addDays, dayCount, de, diff, MONTHS, num, pad, today } from "./dates";

export interface Sym { schub: string; name: string; emoji: string }
export interface Flare {
  id: string; start: string; ende: string | null; staerke: number; ausloeser: string | null;
  kortison: number; mrt: number; arzt: number; notiz: string | null; beschreibung: string | null;
  maxst: number; letzte: number | null; syms: Sym[];
}
export interface SymOption { name: string; emoji: string; eigen: number }
export interface Series { days: string[]; values: (number | null)[]; count: number }

const FLARES = "SELECT s.id, s.start, s.ende, s.staerke, s.ausloeser, s.kortison, s.mrt, s.arzt, s.notiz, s.beschreibung, max(s.staerke, coalesce((SELECT max(v.staerke) FROM verlauf v WHERE v.schub = s.id), 0)) AS maxst, (SELECT v.staerke FROM verlauf v WHERE v.schub = s.id ORDER BY v.tag DESC LIMIT 1) AS letzte FROM schuebe s ORDER BY s.start DESC, s.rowid DESC";

export async function loadFlares(): Promise<Flare[]> {
  const [flares, syms] = await Promise.all([
    q(FLARES),
    q("SELECT y.schub, y.name, coalesce(l.emoji, '') AS emoji FROM symptome y LEFT JOIN symptom_liste l ON l.name = y.name ORDER BY coalesce(l.ord, 99), y.name"),
  ]);
  const by = new Map<string, Flare>(flares.map((f: Row) => [f.id, Object.assign(f, { syms: [] }) as unknown as Flare]));
  for (const y of syms) by.get(y.schub)?.syms.push(y as Sym);
  return flares as Flare[];
}
export const loadSymList = () => q("SELECT name, emoji, eigen FROM symptom_liste ORDER BY ord, name") as Promise<SymOption[]>;

export const flareLen = (f: Flare) => diff(f.start, f.ende || today()) + 1;
export const symLine = (f: Flare) => f.syms.length ? f.syms.map((y) => y.name.replace(/,.*$/, "").replace(/ \(.*\)$/, "")).join(", ") : "Keine Symptome gewählt";
export const avgDur = (fl: Flare[]) => { const e = fl.filter((f) => f.ende); return e.length ? Math.round(e.reduce((a, f) => a + flareLen(f), 0) / e.length) : 0; };
export const last12 = (fl: Flare[]) => fl.filter((f) => f.start >= addDays(today(), -365));

/** Energy per day for the last n days (null where nothing was written). */
export async function energySeries(n: number): Promise<Series> {
  const from = addDays(today(), -(n - 1));
  const rows = await q("SELECT tag, energie FROM tagesform WHERE tag >= ? ORDER BY tag", [from]);
  const map = new Map(rows.map((r) => [r.tag as string, r.energie as number]));
  const days = Array.from({ length: n }, (_, i) => addDays(from, i));
  return { days, values: days.map((d) => map.get(d) ?? null), count: rows.length };
}

/** Flares per month for the last 12 months. */
export async function monthSeries() {
  const now = new Date(), months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS[d.getMonth()] }); }
  const rows = await q("SELECT substr(start, 1, 7) AS m, count(*) AS n FROM schuebe WHERE start >= ? GROUP BY m", [months[0].key + "-01"]);
  const map = new Map(rows.map((r) => [r.m as string, r.n as number]));
  return { values: months.map((m) => map.get(m.key) || 0), labels: months.map((m) => m.label) };
}

export interface Frage { id: string; text: string; erledigt: number }
export interface SymStat { name: string; emoji: string; n: number }

export function summaryText(flares: Flare[], symStats: SymStat[], avgEnergy: number | null, fragen: Frage[]) {
  const L = ["Schub-Tagebuch, Stand " + de(today()), ""];
  L.push(`Schübe insgesamt: ${flares.length}${flares.length ? " (seit " + de(flares[flares.length - 1].start) + ")" : ""}`, `Letzte 12 Monate: ${last12(flares).length}`);
  const d = avgDur(flares); if (d) L.push(`Durchschnittliche Dauer: ${dayCount(d)}`);
  if (avgEnergy) L.push(`Durchschnittliche Energie (30 Tage): ${num(avgEnergy)}/10`);
  const open = fragen.filter((x) => !x.erledigt);
  if (open.length) { L.push("", "Meine Fragen:"); for (const x of open) L.push(`- ${x.text.replace(/\n/g, " ")}`); }
  if (symStats.length) { L.push("", "Häufigste Symptome:"); for (const y of symStats.slice(0, 6)) L.push(`- ${y.name}: ${y.n}×`); }
  for (const f of flares) {
    L.push("", `${de(f.start)}${f.ende ? " bis " + de(f.ende) : " (läuft noch)"}, ${dayCount(flareLen(f))}, stärkster Tag ${f.maxst}/10`,
      `  Symptome: ${f.syms.length ? f.syms.map((y) => y.name).join(", ") : "keine gewählt"}`,
      `  Kortison: ${f.kortison ? "ja" : "nein"}, MRT: ${f.mrt ? "ja" : "nein"}, Auslöser: ${f.ausloeser || "unbekannt"}`);
    if (f.beschreibung) L.push("  Beschreibung: " + f.beschreibung.replace(/\n/g, "\n    "));
    if (f.notiz) L.push("  Notizen: " + f.notiz.replace(/\n/g, "; "));
  }
  return L.join("\n");
}
