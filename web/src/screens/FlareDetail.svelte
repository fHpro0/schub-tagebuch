<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import NavBar from "../ui/NavBar.svelte";
  import SliderRow from "../ui/SliderRow.svelte";
  import SwitchRow from "../ui/SwitchRow.svelte";
  import LineChart from "../ui/LineChart.svelte";
  import SymptomPicker from "../ui/SymptomPicker.svelte";
  import ActionSheet from "../ui/ActionSheet.svelte";
  import { autogrow } from "../lib/autogrow";
  import { batch, buzz, exec, q, reloadWidget } from "../lib/phone";
  import { addDays, dayCount, daysSince, de, deShort, diff, rel, today } from "../lib/dates";
  import { flareLen, loadFlares } from "../lib/data";
  import { loader } from "../lib/load.svelte";
  import { app, confetti, motion, pop, quiet, refresh, reveal, toast } from "../lib/store.svelte";

  let { id }: { id: string } = $props();
  const PROMPT = "Was genau? Wo im Körper? Wie fühlt es sich an? Wie hat es angefangen?";

  const view = loader(async () => {
    const [flares, vl] = await Promise.all([loadFlares(), q("SELECT tag, staerke, notiz FROM verlauf WHERE schub = ? ORDER BY tag DESC", [id])]);
    return { f: flares.find((x) => x.id === id) ?? null, vl: vl as { tag: string; staerke: number; notiz: string | null }[] };
  });
  const data = $derived(view.data);
  const f = $derived(data?.f ?? null);
  const run = $derived(!!f && !f.ende);
  const n = $derived(f ? flareLen(f) : 0);

  // what the person is typing or has switched; seeded once from the data, symptoms and treatment follow it
  let seeded = $state(false);
  let st = $state(5), dayNote = $state(""), editing = $state(false), descDraft = $state(""), noteDraft = $state(""), endDate = $state(today()), asking = $state(false);
  let sel = $state<string[]>([]), treat = $state({ arzt: 0, kortison: 0, mrt: 0 });
  $effect(() => {
    if (!data?.f) return;
    sel = data.f.syms.map((y) => y.name);
    treat = { arzt: data.f.arzt, kortison: data.f.kortison, mrt: data.f.mrt };
    if (!seeded) { st = data.vl.find((v) => v.tag === today())?.staerke ?? data.vl[0]?.staerke ?? data.f.staerke; seeded = true; }
  });
  const hasToday = $derived(!!data?.vl.some((v) => v.tag === today()));

  $effect(() => {
    if (!data?.f || (app.focus !== "today" && app.focus !== "end")) return;
    const target = app.focus === "today" ? "today-group" : "end-group";
    app.focus = null;
    if (run) void reveal(target);
  });

  async function saveToday() {
    try {
      await exec("INSERT INTO verlauf (schub, tag, staerke, notiz) VALUES (?, ?, ?, ?) ON CONFLICT(schub, tag) DO UPDATE SET staerke = excluded.staerke, notiz = coalesce(excluded.notiz, verlauf.notiz)", [id, today(), st, dayNote.trim() || null]);
      buzz("success"); reloadWidget(); toast("Für heute eingetragen 💗"); dayNote = ""; refresh();
    } catch (e) { quiet(e); }
  }
  function editDesc() { descDraft = f?.beschreibung ?? ""; editing = true; }
  async function saveDesc() {
    try { await exec("UPDATE schuebe SET beschreibung = ? WHERE id = ?", [descDraft.trim() || null, id]); buzz("success"); editing = false; toast("Beschreibung gespeichert."); refresh(); } catch (e) { quiet(e); }
  }
  async function toggleSym(name: string, on: boolean) {
    await (on ? exec("INSERT OR IGNORE INTO symptome (schub, name) VALUES (?, ?)", [id, name]) : exec("DELETE FROM symptome WHERE schub = ? AND name = ?", [id, name]));
    refresh();
  }
  const COLS = { arzt: "arzt", kortison: "kortison", mrt: "mrt" } as const;
  async function setTreat(col: keyof typeof COLS, on: boolean) {
    const before = treat[col];
    treat[col] = on ? 1 : 0;
    try { await exec(`UPDATE schuebe SET ${COLS[col]} = ? WHERE id = ?`, [on ? 1 : 0, id]); buzz("selection"); } catch (e) { treat[col] = before; quiet(e); }
  }
  async function addNote() {
    const t = noteDraft.trim();
    if (!t) return;
    const line = `${deShort(today())} ${t}`;
    try { await exec("UPDATE schuebe SET notiz = CASE WHEN notiz IS NULL OR notiz = '' THEN ? ELSE notiz || char(10) || ? END WHERE id = ?", [line, line, id]); buzz("success"); noteDraft = ""; refresh(); } catch (e) { quiet(e); }
  }
  async function endFlare() {
    const e = endDate || today();
    if (!f || e < f.start) { toast("Das Ende kann nicht vor dem Beginn liegen."); return; }
    try { await exec("UPDATE schuebe SET ende = ? WHERE id = ?", [e, id]); buzz("success"); reloadWidget(); confetti(); toast("Schön, dass es vorbei ist 💗"); refresh(); } catch (er) { quiet(er); }
  }
  async function reopen() {
    try { await exec("UPDATE schuebe SET ende = NULL WHERE id = ?", [id]); reloadWidget(); buzz("selection"); refresh(); } catch (e) { quiet(e); }
  }
  async function remove() {
    try {
      await batch([{ sql: "DELETE FROM symptome WHERE schub = ?", params: [id] }, { sql: "DELETE FROM verlauf WHERE schub = ?", params: [id] }, { sql: "DELETE FROM schuebe WHERE id = ?", params: [id] }]);
      asking = false; reloadWidget(); buzz("success"); pop(); toast("Schub gelöscht."); refresh();
    } catch (e) { asking = false; quiet(e); }
  }

  const series = $derived.by(() => {
    if (!data || data.vl.length < 2) return null;
    const asc = [...data.vl].reverse(), first = asc[0].tag, total = diff(first, asc[asc.length - 1].tag) + 1;
    const ds = Array.from({ length: total }, (_, i) => addDays(first, i)), map = new Map(asc.map((v) => [v.tag, v.staerke]));
    return { values: ds.map((d) => map.get(d) ?? null), labels: ds.map(deShort) };
  });
</script>

<div class="screen pushed" transition:fly|global={{ x: "100%", duration: motion(340), easing: cubicOut, opacity: 1 }}>
  <NavBar title="Schub" />
  <div class="content">
    {#if !data}
      <!-- loading -->
    {:else if !f}
      <div class="gl"><p class="empty">Diesen Schub gibt es nicht mehr.</p></div>
    {:else}
      <section class="group">
        <div class="gl">
          <div class="pad">
            {#if run}<p class="eyebrowline"><span class="dot" aria-hidden="true"></span>Läuft noch</p>{/if}
            <h2 class="headline">{de(f.start)} {f.ende ? "bis " + de(f.ende) : "bis heute"}</h2>
            <p class="muted" style="margin:.15rem 0 0">{run ? `Läuft seit ${daysSince(n)}` : dayCount(n)}</p>
          </div>
          <div class="stats" style="border-top:.5px solid var(--sep)">
            <div><b style="font-size:1.35rem;line-height:1.4">{f.maxst}/10</b><span>Stärkster Tag</span></div>
            <div><b style="font-size:1.35rem;line-height:1.4">{f.ausloeser || "Unbekannt"}</b><span>Auslöser</span></div>
          </div>
        </div>
      </section>

      {#if run}
        <section class="group" id="today-group">
          <h2 class="gh">Heute eintragen</h2>
          <div class="gl">
            <SliderRow id="d-st" label="Stärke" bind:value={st} />
            <div class="row"><textarea class="field" rows="2" bind:value={dayNote} use:autogrow={dayNote} placeholder="Notiz zum heutigen Tag (optional)" aria-label="Notiz zum heutigen Tag"></textarea></div>
            <button type="button" class="row action" onclick={saveToday}>{hasToday ? "Heute aktualisieren" : "Heute sichern"}</button>
          </div>
        </section>
      {/if}

      <section class="group">
        <h2 class="gh">Beschreibung</h2>
        <div class="gl">
          {#if editing}
            <div class="row"><textarea class="field" rows="5" bind:value={descDraft} use:autogrow={descDraft} placeholder={PROMPT} aria-label="Beschreibung"></textarea></div>
            <button type="button" class="row action plain" onclick={() => (editing = false)}>Abbrechen</button>
            <button type="button" class="row action" onclick={saveDesc}>Sichern</button>
          {:else}
            <div class="row col">{#if f.beschreibung}<p class="notes" style="margin:0">{f.beschreibung}</p>{:else}<p class="muted" style="margin:0">Noch nichts beschrieben. {PROMPT}</p>{/if}</div>
            <button type="button" class="row action" onclick={editDesc}>{f.beschreibung ? "Bearbeiten" : "Beschreiben"}</button>
          {/if}
        </div>
      </section>

      <section class="group">
        <h2 class="gh">Symptome</h2>
        <SymptomPicker bind:selected={sel} ontoggle={toggleSym} />
      </section>

      {#if series || data.vl.length}
        <section class="group">
          <h2 class="gh">Verlauf</h2>
          <div class="gl">
            {#if series}<div class="row" style="display:block"><LineChart values={series.values} labels={series.labels} label="Stärke pro Tag" /></div>{/if}
            {#each data.vl as v (v.tag)}
              <div class="row">
                <span class="grow"><span class="title">{rel(v.tag)}</span>{#if v.notiz}<span class="sub notes">{v.notiz}</span>{/if}</span>
                <span class="val">{v.staerke}/10</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <section class="group">
        <h2 class="gh">Behandlung</h2>
        <div class="gl">
          <SwitchRow label="Neurologin informiert" checked={!!treat.arzt} onchange={(on) => setTreat("arzt", on)} />
          <SwitchRow label="Kortison-Stoßtherapie" checked={!!treat.kortison} onchange={(on) => setTreat("kortison", on)} />
          <SwitchRow label="MRT gemacht" checked={!!treat.mrt} onchange={(on) => setTreat("mrt", on)} />
        </div>
      </section>

      <section class="group">
        <h2 class="gh">Notizen</h2>
        <div class="gl">
          <div class="row col">{#if f.notiz}<p class="notes" style="margin:0">{f.notiz}</p>{:else}<p class="muted" style="margin:0">Noch keine Notizen.</p>{/if}</div>
          <div class="row"><textarea class="field" rows="2" bind:value={noteDraft} use:autogrow={noteDraft} placeholder="Was möchtest du ergänzen?" aria-label="Notiz ergänzen"></textarea></div>
          <button type="button" class="row action" disabled={!noteDraft.trim()} onclick={addNote}>Notiz ergänzen</button>
        </div>
      </section>

      <section class="group" id="end-group">
        <h2 class="gh">{run ? "Ist der Schub vorbei?" : "Schub beendet"}</h2>
        <div class="gl">
          {#if run}
            <div class="row"><label for="d-end" class="grow">Ende am</label><input id="d-end" class="date" type="date" bind:value={endDate} min={f.start} max={today()} /></div>
            <button type="button" class="row action" onclick={endFlare}>Schub beenden</button>
          {:else}
            <button type="button" class="row action plain" onclick={reopen}>Doch noch nicht vorbei</button>
          {/if}
        </div>
      </section>

      <section class="group"><div class="gl"><button type="button" class="row action danger" onclick={() => (asking = true)}>Schub löschen</button></div></section>
    {/if}
  </div>
</div>

{#if asking}
  <ActionSheet message="Der Schub mit allen Einträgen wird von diesem iPhone gelöscht. Das lässt sich nicht rückgängig machen." confirm="Schub löschen" onconfirm={remove} oncancel={() => (asking = false)} />
{/if}

<style>
  .headline { margin: 0; font-size: 1.35rem; line-height: 1.2; font-weight: 700; letter-spacing: .01em; }
  .eyebrowline { display: flex; align-items: center; gap: .5rem; margin: 0 0 .35rem; font-size: .882rem; font-weight: 600; color: var(--accent-text); }
</style>
