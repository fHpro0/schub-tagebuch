<script lang="ts">
  // "Eingetragen ✓" after the widget's "Ja, noch da" (and "Stärke heute" for "Ändern"): the strength saves by itself.
  import Sheet from "../ui/Sheet.svelte";
  import SliderRow from "../ui/SliderRow.svelte";
  import { autogrow } from "../lib/autogrow";
  import { saveDay, undoToday } from "../lib/flow";
  import { app, quiet, refresh, toast } from "../lib/store.svelte";

  const d = app.day!; // the sheet is keyed on it: a new one makes a new sheet
  let st = $state(d.st), note = $state(d.note), sync = $state<"" | "pending" | "saving" | "saved">("");
  let timer = 0, dirty = false;
  const title = d.kind === "staerke" ? "Stärke heute" : d.created ? "Eingetragen ✓" : "Schon eingetragen ✓";

  function schedule() { dirty = true; sync = "pending"; clearTimeout(timer); timer = window.setTimeout(() => void flush(), 700); }
  async function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false; sync = "saving";
    try { await saveDay(d.id, st, note); sync = "saved"; refresh(); } catch (e) { sync = ""; quiet(e); }
  }
  // a sheet closed in any way (scrim, Escape, another intent) still saves what was typed
  $effect(() => () => { if (dirty) void saveDay(d.id, st, note).then(refresh); });

  const close = () => { app.sheet = null; };
  async function done() { await flush(); close(); }
  async function undo() {
    clearTimeout(timer); dirty = false;
    try { await undoToday(d.id); toast("Eintrag rückgängig gemacht."); refresh(); close(); } catch (e) { quiet(e); }
  }
</script>

<Sheet {title} cancel={null} compact onclose={done}>
  <p class="center sm muted" style="margin:0 0 1rem">Tag {d.n} · Stärke {st}/10</p>
  <div class="gl">
    <SliderRow id="day-st" label="Stärke" bind:value={st} oninput={schedule} />
    <div class="row"><textarea class="field" rows="2" bind:value={note} oninput={schedule} use:autogrow={note} placeholder="Notiz zum heutigen Tag (optional)" aria-label="Notiz zum heutigen Tag"></textarea></div>
  </div>
  <p class="gf center" role="status" style="min-height:1.2em">{sync === "saved" ? "Gespeichert ✓" : sync ? "Speichert…" : ""}</p>
  <div class="btns" style="margin-top:.5rem">
    {#if d.created}<button type="button" class="btn tint" onclick={undo}>Rückgängig</button>{/if}
    <button type="button" class="btn" style={d.created ? "" : "grid-column:1 / -1"} onclick={done}>Fertig</button>
  </div>
</Sheet>
