// The writes behind the sheets (and the actions in space.json that do the same without opening the app): one code path
// for the widget buttons, the status card and the detail screen.
import { buzz, exec, q, reloadWidget } from "./phone";
import { deShort, diff, today } from "./dates";

export interface DayState { id: string; start: string; n: number; created: boolean; st: number; note: string }

const running = async () => (await q("SELECT id, start, staerke FROM schuebe WHERE ende IS NULL ORDER BY start DESC LIMIT 1"))[0] as { id: string; start: string; staerke: number } | undefined;

/** Today of the running flare. `insert`: write today's row with the last strength first, as the "noch-da" action does
 * (an existing row is kept, so a second tap makes no duplicate and `created` says whether this tap wrote it). */
export async function todayState(insert: boolean): Promise<DayState | null> {
  const f = await running();
  if (!f) return null;
  const t = today(), n = diff(f.start, t) + 1;
  const cur = (await q("SELECT staerke, notiz FROM verlauf WHERE schub = ? AND tag = ?", [f.id, t]))[0];
  if (cur) return { id: f.id, start: f.start, n, created: false, st: cur.staerke, note: cur.notiz ?? "" };
  const st = (await q("SELECT staerke FROM verlauf WHERE schub = ? ORDER BY tag DESC LIMIT 1", [f.id]))[0]?.staerke ?? f.staerke;
  if (insert) { await exec("INSERT INTO verlauf (schub, tag, staerke) VALUES (?, ?, ?) ON CONFLICT(schub, tag) DO NOTHING", [f.id, t, st]); buzz("success"); reloadWidget(); }
  return { id: f.id, start: f.start, n, created: insert, st, note: "" };
}

/** Strength (and a note, kept when empty) for today. */
export async function saveDay(id: string, st: number, note: string) {
  await exec("INSERT INTO verlauf (schub, tag, staerke, notiz) VALUES (?, ?, ?, ?) ON CONFLICT(schub, tag) DO UPDATE SET staerke = excluded.staerke, notiz = coalesce(excluded.notiz, verlauf.notiz)", [id, today(), st, note.trim() || null]);
  reloadWidget();
}
export async function undoToday(id: string) {
  await exec("DELETE FROM verlauf WHERE schub = ? AND tag = ?", [id, today()]);
  reloadWidget(); buzz("selection");
}
export async function endFlare(id: string, date: string) {
  await exec("UPDATE schuebe SET ende = ? WHERE id = ?", [date, id]);
  buzz("success"); reloadWidget();
}
export async function saveMood(mood: string | null, energy: number) {
  await exec("INSERT INTO tagesform (tag, energie, gefuehl) VALUES (?, ?, ?) ON CONFLICT(tag) DO UPDATE SET energie = excluded.energie, gefuehl = excluded.gefuehl", [today(), energy, mood]);
  buzz("success"); reloadWidget();
}

/** "↑ 1 seit gestern", "↓ 2 seit 21.11.", "unverändert" (empty when there is no earlier day). */
export function trendText(cur: number, prev?: { tag: string; staerke: number } | null) {
  if (!prev) return "";
  const d = cur - prev.staerke, since = diff(prev.tag, today()) === 1 ? "seit gestern" : `seit ${deShort(prev.tag)}`;
  return d > 0 ? `↑ ${d} ${since}` : d < 0 ? `↓ ${-d} ${since}` : "unverändert";
}
