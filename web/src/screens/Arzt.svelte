<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import LineChart from "../ui/LineChart.svelte";
  import { buzz, exec, q, share } from "../lib/phone";
  import { addDays, dayCount, de, deShort, num, today } from "../lib/dates";
  import { avgDur, energySeries, flareLen, last12, loadFlares, summaryText, type Frage, type SymStat } from "../lib/data";
  import { loader } from "../lib/load.svelte";
  import { app, quiet, refresh, toast } from "../lib/store.svelte";

  const view = loader(async () => {
    const [flares, symStats, en, fragen, avg] = await Promise.all([
      loadFlares(),
      q("SELECT l.name AS name, l.emoji AS emoji, count(*) AS n FROM symptome y JOIN symptom_liste l ON l.name = y.name GROUP BY l.name ORDER BY n DESC, l.ord") as Promise<SymStat[]>,
      energySeries(30),
      q("SELECT id, text, erledigt FROM fragen ORDER BY erledigt, erstellt, rowid") as Promise<Frage[]>,
      q("SELECT round(avg(energie), 1) AS a FROM tagesform WHERE tag > ?", [addDays(today(), -30)]),
    ]);
    return { flares, symStats, en, fragen, avg: (avg[0]?.a ?? null) as number | null };
  });
  const data = $derived(view.data);

  let draft = $state(""), editing = $state(false);
  async function addQuestion() {
    const t = draft.trim();
    if (!t) return;
    try { await exec("INSERT INTO fragen (text) VALUES (?)", [t]); buzz("success"); draft = ""; refresh(); } catch (e) { quiet(e); }
  }
  async function tickQuestion(fr: Frage) {
    try { await exec("UPDATE fragen SET erledigt = ? WHERE id = ?", [fr.erledigt ? 0 : 1, fr.id]); buzz("selection"); refresh(); } catch (e) { quiet(e); }
  }
  async function removeQuestion(fr: Frage) {
    try { await exec("DELETE FROM fragen WHERE id = ?", [fr.id]); buzz("selection"); refresh(); } catch (e) { quiet(e); }
  }
  async function shareText() {
    if (!data) return;
    try { await share(summaryText(data.flares, data.symStats, data.avg, data.fragen)); }
    catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "Cancelled") return;
      if (code === "NotAllowed" || code === "NotDeclared") toast("Teilen ist für dieses Tagebuch ausgeschaltet."); else toast((e as Error).message);
    }
  }
</script>

<div class="content">
  <header class="large-title"><h1>Arzt</h1></header>

  {#if data}
    {@const d = avgDur(data.flares)}
    {@const first = data.flares.length ? data.flares[data.flares.length - 1].start : null}
    <section class="group">
      <h2 class="gh">Übersicht</h2>
      <div class="gl">
        <div class="row"><span class="grow">{first ? `Schübe seit ${de(first)}` : "Schübe gesamt"}</span><span class="val strong">{data.flares.length}</span></div>
        <div class="row"><span class="grow">Letzte 12 Monate</span><span class="val strong">{last12(data.flares).length}</span></div>
        <div class="row"><span class="grow">Ø Dauer</span><span class="val strong">{d ? dayCount(d) : "–"}</span></div>
        <div class="row"><span class="grow">Ø Energie, 30 Tage</span><span class="val strong">{data.avg ? `${num(data.avg)}/10` : "–"}</span></div>
      </div>
      <p class="gf">Alle Schübe auf einen Blick: wann, wie lange, wie stark, welche Symptome und was behandelt wurde.</p>
    </section>

    <section class="group">
      <h2 class="gh">Fragen für den nächsten Termin
        {#if data.fragen.length}<button type="button" onclick={() => (editing = !editing)}>{editing ? "Fertig" : "Bearbeiten"}</button>{/if}
      </h2>
      <div class="gl">
        {#each data.fragen as fr (fr.id)}
          <div class="row pick">
            <button type="button" class="hit" role="checkbox" aria-checked={!!fr.erledigt} onclick={() => tickQuestion(fr)}>
              <span class="circle" aria-hidden="true">{#if fr.erledigt}<Icon name="check" size={1} />{/if}</span>
              <span class="grow title notes" class:done={fr.erledigt}>{fr.text}</span>
            </button>
            {#if editing}<button type="button" class="del" aria-label="Frage löschen: {fr.text}" onclick={() => removeQuestion(fr)}>Löschen</button>{/if}
          </div>
        {/each}
        <div class="row">
          <span class="lead" style="color:var(--accent-text)" aria-hidden="true"><Icon name="plus" size={1.25} /></span>
          <input class="field grow" type="text" bind:value={draft} placeholder="Neue Frage" aria-label="Neue Frage" enterkeyhint="done" autocomplete="off"
            onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addQuestion(); } }} />
          {#if draft.trim()}<button type="button" class="add" onclick={addQuestion}>Hinzufügen</button>{/if}
        </div>
      </div>
      {#if !data.fragen.length}<p class="gf">Schreib auf, was dir einfällt, dann hast du es beim Termin parat.</p>{/if}
    </section>

    {#if data.symStats.length}
      <section class="group">
        <h2 class="gh">Häufigste Symptome</h2>
        <div class="gl">
          {#each data.symStats as y (y.name)}
            <div class="row col">
              <div style="display:flex;gap:.75rem;justify-content:space-between"><span><span aria-hidden="true">{y.emoji}</span> {y.name}</span><span class="val strong">{y.n}×</span></div>
              <span class="hbar" role="img" aria-label="{y.n} von {data.symStats[0].n}"><i style:width="{(y.n / data.symStats[0].n) * 100}%"></i></span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if data.en.count >= 2}
      <section class="group">
        <h2 class="gh">Energie, 30 Tage</h2>
        <div class="gl"><div class="pad"><LineChart values={data.en.values} labels={data.en.days.map(deShort)} label="Energie der letzten 30 Tage" /></div></div>
      </section>
    {/if}

    {#each data.flares as f (f.id)}
      <section class="group">
        <h2 class="gh">{de(f.start)}{f.ende ? " bis " + de(f.ende) : ", läuft noch"}</h2>
        <div class="gl">
          <div class="row"><span class="grow">Dauer</span><span class="val">{dayCount(flareLen(f))}</span></div>
          <div class="row"><span class="grow">Stärkster Tag</span><span class="val">{f.maxst}/10</span></div>
          <div class="row"><span class="grow">Auslöser</span><span class="val">{f.ausloeser || "unbekannt"}</span></div>
          <div class="row"><span class="grow">Kortison</span><span class="val">{f.kortison ? "ja" : "nein"}</span></div>
          <div class="row"><span class="grow">MRT</span><span class="val">{f.mrt ? "ja" : "nein"}</span></div>
          <div class="row col"><span class="muted sm">Symptome</span><span class="notes">{f.syms.length ? f.syms.map((y) => y.name).join(", ") : "keine gewählt"}</span></div>
          {#if f.beschreibung}<div class="row col"><span class="muted sm">Beschreibung</span><span class="notes">{f.beschreibung}</span></div>{/if}
          {#if f.notiz}<div class="row col"><span class="muted sm">Notizen</span><span class="notes">{f.notiz}</span></div>{/if}
        </div>
      </section>
    {:else}
      <section class="group"><div class="gl"><p class="empty">Noch kein Schub eingetragen.</p></div></section>
    {/each}

    <button type="button" class="btn block" onclick={shareText}>Als Text teilen</button>
    <p class="gf" style="text-align:center">Teilt die Übersicht als Text, zum Beispiel per Nachricht oder Mail.</p>
  {/if}
</div>

<style>
  .pick { display: grid; grid-template-columns: minmax(0, 1fr) auto; padding: 0; gap: 0; }
  .hit { grid-row: 1; grid-column: 1; display: flex; align-items: center; gap: .75rem; min-height: 2.75rem; padding: .625rem 1rem; border: 0; background: none; text-align: left; }
  .hit:active { background: var(--hl); }
  .hit:focus-visible { outline-offset: -2px; }
  .done { color: var(--label2); text-decoration: line-through; }
  .del { grid-row: 1; grid-column: 2; min-height: 2.75rem; padding: 0 1rem; border: 0; background: none; color: var(--danger); font-size: .941rem; }
  .add { flex: none; min-height: 2.75rem; border: 0; background: none; color: var(--accent-text); font-weight: 600; padding: 0; }
</style>
