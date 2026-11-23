<script lang="ts">
  // "Ist der Schub vorbei?": the end date (today by default, not before the start, not in the future) and one tap.
  import Sheet from "../ui/Sheet.svelte";
  import { endFlare } from "../lib/flow";
  import { q } from "../lib/phone";
  import { de, deShort, diff, today } from "../lib/dates";
  import { app, confetti, quiet, refresh, toast } from "../lib/store.svelte";
  import { loader } from "../lib/load.svelte";

  const view = loader(async () => (await q("SELECT id, start FROM schuebe WHERE ende IS NULL ORDER BY start DESC LIMIT 1"))[0] as { id: string; start: string } | undefined ?? null);
  const f = $derived(view.data);
  let date = $state(today());
  const valid = $derived(!!f && !!date && date >= f.start && date <= today());
  const close = () => { app.sheet = null; };

  async function end() {
    if (!f || !valid) return;
    try { await endFlare(f.id, date); confetti(); toast("Schön, dass es vorbei ist 💗"); refresh(); close(); } catch (e) { quiet(e); }
  }
</script>

<Sheet title="Ist der Schub vorbei?" cancel={null} compact onclose={close}>
  {#if f}<p class="center sm muted" style="margin:0 0 1rem">Seit {deShort(f.start)} · Tag {diff(f.start, today()) + 1}</p>{/if}
  <div class="gl">
    <div class="row"><label for="e-date" class="grow">Ende am</label><input id="e-date" class="date" type="date" bind:value={date} min={f?.start} max={today()} /></div>
  </div>
  {#if f && !valid}<p class="gf" role="status">Das Ende liegt am {de(f.start)} oder später, höchstens heute.</p>{/if}
  <div style="display:grid;gap:.5rem;margin-top:1.25rem">
    <button type="button" class="btn block" disabled={!valid} onclick={end}>Schub beenden</button>
    <button type="button" class="btn tint block" onclick={close}>Abbrechen</button>
  </div>
</Sheet>
