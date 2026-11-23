<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import MoodEditor from "../ui/MoodEditor.svelte";
  import BarChart from "../ui/BarChart.svelte";
  import FlareRow from "../ui/FlareRow.svelte";
  import { q } from "../lib/phone";
  import { de, deShort, diff, longToday, today } from "../lib/dates";
  import { energySeries, flareLen, loadFlares } from "../lib/data";
  import { trendText } from "../lib/flow";
  import { loader } from "../lib/load.svelte";
  import { app, push, startDay, startEnd, startMood, startNew } from "../lib/store.svelte";

  const MOODS: Record<string, [string, string]> = { gut: ["😊", "Gut"], okay: ["🙂", "Okay"], mau: ["😕", "Mau"], schlecht: ["😣", "Schlecht"] };

  const view = loader(async () => {
    const [flares, tf, en, days] = await Promise.all([
      loadFlares(), q("SELECT energie, gefuehl FROM tagesform WHERE tag = ?", [today()]), energySeries(14),
      q("SELECT tag, staerke FROM verlauf WHERE schub IN (SELECT id FROM schuebe WHERE ende IS NULL) ORDER BY tag DESC LIMIT 2"),
    ]);
    return { flares, saved: tf[0] as { energie: number; gefuehl: string | null } | undefined, en, days: days as { tag: string; staerke: number }[] };
  });
  const data = $derived(view.data);
  const running = $derived(data?.flares.find((f) => !f.ende));
  const ended = $derived(data?.flares.filter((f) => f.ende).sort((a, b) => (a.ende! < b.ende! ? 1 : -1))[0]);
  const free = $derived(ended ? diff(ended.ende!, today()) : 0);
  // running flare: is today written, and how does it compare with the day before
  const logged = $derived(data?.days[0]?.tag === today());
  const mood = $derived(data?.saved?.gefuehl ? MOODS[data.saved.gefuehl] : null);
</script>

<div class="content">
  <header class="large-title">
    <div><p class="eyebrow">{longToday()}</p><h1>Heute</h1></div>
    <button type="button" class="icon-btn" aria-label="Einstellungen" onclick={() => (app.sheet = "settings")}><Icon name="gear" size={1.5} /></button>
  </header>

  {#if data}
    <section class="card status" aria-label="Status">
      {#if running}
        <h2><span class="dot" aria-hidden="true"></span>Schub · Tag {flareLen(running)}</h2>
        {#if logged}
          <p class="s">{["Heute: Stärke " + data.days[0].staerke + "/10 ✓", trendText(data.days[0].staerke, data.days[1])].filter(Boolean).join(" · ")}</p>
          <div class="btns">
            <button type="button" class="btn" onclick={() => startDay("staerke")}>Ändern</button>
            <button type="button" class="btn tint" onclick={startEnd}>Vorbei</button>
          </div>
        {:else}
          <p class="s">Stärke zuletzt {data.days[0]?.staerke ?? running.letzte ?? running.staerke}/10 · seit {deShort(running.start)}</p>
          <div class="btns">
            <button type="button" class="btn" onclick={() => startDay("noch-da")}>Ja, noch da</button>
            <button type="button" class="btn tint" onclick={startEnd}>Vorbei</button>
          </div>
        {/if}
      {:else}
        {#if !data.flares.length}
          <p class="big">Noch kein Schub</p>
          <p class="s">Das ist völlig in Ordnung. Wenn doch einer kommt, kannst du ihn hier festhalten.</p>
        {:else if free <= 0}
          <p class="big">Schub vorbei</p>
          <p class="s">Der letzte Schub endete heute. Gut gemacht.</p>
        {:else}
          <p class="big">{free} {free === 1 ? "Tag" : "Tage"}</p>
          <p class="s">ohne Schub · letzter Schub endete am {de(ended!.ende!)}</p>
        {/if}
        {#if mood}<p class="s" style="margin-top:.5rem">{`Heute: ${mood[0]} ${mood[1]} · Energie ${data.saved!.energie}/10 ✓`}</p>{/if}
        {#if mood}
          <button type="button" class="btn tint block" onclick={startNew}>Neuer Schub</button>
        {:else}
          <div class="btns wide">
            <button type="button" class="btn" onclick={startMood}>Wie geht’s dir?</button>
            <button type="button" class="btn tint" onclick={startNew}>Neuer Schub</button>
          </div>
        {/if}
      {/if}
    </section>

    <section class="group" id="mood-group">
      <h2 class="gh">Wie geht’s dir?</h2>
      <MoodEditor />
    </section>

    <section class="group">
      <h2 class="gh">Letzte 14 Tage</h2>
      <div class="gl">
        {#if data.en.count < 2}
          <p class="empty">Trag deine Tagesform an ein paar Tagen ein, dann siehst du hier den Verlauf.</p>
        {:else}
          <div class="pad"><BarChart values={data.en.values} labels={data.en.days.map(deShort)} max={10} ticks={[0, 5, 10]} every={3} label="Energie der letzten 14 Tage" /></div>
        {/if}
      </div>
      <p class="gf">Energie von 0 bis 10.</p>
    </section>

    <section class="group">
      <h2 class="gh">Letzte Schübe</h2>
      <div class="gl">
        {#each data.flares.slice(0, 3) as f (f.id)}<FlareRow {f} />{:else}
          <p class="empty">Noch kein Schub eingetragen. Wenn doch einer kommt, kannst du ihn hier festhalten.</p>
        {/each}
        {#if data.flares.length}
          <button type="button" class="row" onclick={() => push({ name: "all" })}>
            <span class="grow">Alle Schübe</span><span class="val">{data.flares.length}</span><span class="chev"><Icon name="chev" size={1.1} /></span>
          </button>
        {/if}
      </div>
    </section>
  {/if}
</div>
