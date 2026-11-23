<script lang="ts">
  import Segmented from "../ui/Segmented.svelte";
  import BarChart from "../ui/BarChart.svelte";
  import LineChart from "../ui/LineChart.svelte";
  import FlareRow from "../ui/FlareRow.svelte";
  import { dayCount, deShort, rel, today, addDays, num } from "../lib/dates";
  import { avgDur, energySeries, last12, loadFlares, monthSeries } from "../lib/data";
  import { loader } from "../lib/load.svelte";
  import { q } from "../lib/phone";

  const MOODS: Record<string, [string, string]> = { gut: ["😊", "Gut"], okay: ["🙂", "Okay"], mau: ["😕", "Mau"], schlecht: ["😣", "Schlecht"] };
  let part = $state<"schuebe" | "tagesform">("schuebe");

  const view = loader(async () => {
    const [flares, months, en, days] = await Promise.all([
      loadFlares(), monthSeries(), energySeries(30),
      q("SELECT tag, energie, gefuehl FROM tagesform WHERE tag >= ? ORDER BY tag DESC", [addDays(today(), -89)]),
    ]);
    return { flares, months, en, days };
  });
  const data = $derived(view.data);
</script>

<div class="content">
  <header class="large-title"><h1>Verlauf</h1></header>
  <div style="margin-bottom:1.5rem">
    <Segmented kind="tab" label="Ansicht" bind:value={part} items={[{ key: "schuebe", label: "Schübe" }, { key: "tagesform", label: "Tagesform" }]} />
  </div>

  {#if data && part === "schuebe"}
    {@const d = avgDur(data.flares)}
    <section class="group">
      <h2 class="gh">Zahlen</h2>
      <div class="gl stats">
        <div><b>{last12(data.flares).length}</b><span>Schübe, 12 Monate</span></div>
        <div><b>{d ? dayCount(d) : "–"}</b><span>Ø Dauer</span></div>
        <div><b>{data.flares.filter((f) => f.kortison).length}</b><span>Kortison-Behandlungen</span></div>
        <div><b>{data.flares.length}</b><span>Schübe gesamt</span></div>
      </div>
    </section>
    <section class="group">
      <h2 class="gh">Schübe pro Monat</h2>
      <div class="gl">
        {#if !data.flares.length}<p class="empty">Sobald ein Schub eingetragen ist, siehst du ihn hier pro Monat.</p>
        {:else}<div class="pad"><BarChart values={data.months.values} labels={data.months.labels} showValues label="Schübe pro Monat der letzten 12 Monate" /></div>{/if}
      </div>
    </section>
    <section class="group">
      <h2 class="gh">Alle Schübe</h2>
      <div class="gl">{#each data.flares as f (f.id)}<FlareRow {f} />{:else}<p class="empty">Noch kein Schub eingetragen.</p>{/each}</div>
    </section>
  {:else if data}
    {@const avg = data.en.count ? Math.round((data.en.values.reduce<number>((a, v) => a + (v ?? 0), 0) / data.en.count) * 10) / 10 : null}
    <section class="group">
      <h2 class="gh">Energie, 30 Tage</h2>
      <div class="gl">
        {#if data.en.count < 2}<p class="empty">Trag deine Tagesform an ein paar Tagen ein, dann siehst du hier den Verlauf.</p>
        {:else}<div class="pad"><LineChart values={data.en.values} labels={data.en.days.map(deShort)} label="Energie der letzten 30 Tage" /></div>{/if}
      </div>
      {#if avg !== null}<p class="gf">Durchschnitt: {num(avg)}/10</p>{/if}
    </section>
    <section class="group">
      <h2 class="gh">Tage</h2>
      <div class="gl">
        {#each data.days as t (t.tag)}
          {@const m = t.gefuehl ? MOODS[t.gefuehl] : null}
          <div class="row">
            <span class="lead" aria-hidden="true">{m ? m[0] : "·"}</span>
            <span class="grow"><span class="title">{rel(t.tag)}</span>{#if m}<span class="sub">{m[1]}</span>{/if}</span>
            <span class="val">{t.energie}/10</span>
          </div>
        {:else}<p class="empty">Noch keine Tagesform eingetragen.</p>{/each}
      </div>
    </section>
  {/if}
</div>
