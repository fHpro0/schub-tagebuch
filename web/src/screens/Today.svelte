<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import SliderRow from "../ui/SliderRow.svelte";
  import BarChart from "../ui/BarChart.svelte";
  import FlareRow from "../ui/FlareRow.svelte";
  import { buzz, exec, q, reloadWidget } from "../lib/phone";
  import { daysSince, de, deShort, diff, longToday, today } from "../lib/dates";
  import { energySeries, flareLen, loadFlares } from "../lib/data";
  import { loader } from "../lib/load.svelte";
  import { app, openNew, push, quiet, reveal, toast } from "../lib/store.svelte";

  type Mood = "gut" | "okay" | "mau" | "schlecht";
  const MOODS = [
    { key: "gut", emoji: "😊", label: "Gut" }, { key: "okay", emoji: "🙂", label: "Okay" },
    { key: "mau", emoji: "😕", label: "Mau" }, { key: "schlecht", emoji: "😣", label: "Schlecht" },
  ] as const;

  const view = loader(async () => {
    const [flares, tf, en] = await Promise.all([loadFlares(), q("SELECT energie, gefuehl FROM tagesform WHERE tag = ?", [today()]), energySeries(14)]);
    return { flares, saved: tf[0] as { energie: number; gefuehl: Mood | null } | undefined, en };
  });
  const data = $derived(view.data);
  const running = $derived(data?.flares.find((f) => !f.ende));
  const ended = $derived(data?.flares.filter((f) => f.ende).sort((a, b) => (a.ende! < b.ende! ? 1 : -1))[0]);
  const free = $derived(ended ? diff(ended.ende!, today()) : 0);

  // today's entry; the form starts from what is saved, and stays what the person is typing after that
  let mood = $state<Mood | null>(null), energy = $state(5), touched = $state(false);
  $effect(() => {
    if (data && !touched) { mood = data.saved?.gefuehl ?? null; energy = data.saved?.energie ?? 5; }
  });
  const moodLabel = (m: Mood | null) => MOODS.find((x) => x.key === m)?.label;
  const savedLine = $derived(data?.saved ? `Heute gespeichert ✓ Energie ${data.saved.energie}/10${data.saved.gefuehl ? ", " + moodLabel(data.saved.gefuehl) : ""}` : "Noch nicht eingetragen.");

  async function save() {
    try {
      await exec("INSERT INTO tagesform (tag, energie, gefuehl) VALUES (?, ?, ?) ON CONFLICT(tag) DO UPDATE SET energie = excluded.energie, gefuehl = excluded.gefuehl", [today(), energy, mood]);
      buzz("success"); reloadWidget(); touched = false; toast("Gespeichert 💗"); app.tick++;
    } catch (e) { quiet(e); }
  }

  $effect(() => { if (app.focus === "mood" && data) { app.focus = null; void reveal("mood-group"); } });
</script>

<div class="content">
  <header class="large-title">
    <div><p class="eyebrow">{longToday()}</p><h1>Heute</h1></div>
    <button type="button" class="icon-btn" aria-label="Einstellungen" onclick={() => (app.sheet = "settings")}><Icon name="gear" size={1.5} /></button>
  </header>

  {#if data}
    <section class="card status" aria-label="Status">
      {#if running}
        {@const last = running.letzte ?? running.staerke}
        <h2><span class="dot" aria-hidden="true"></span>Schub · Tag {flareLen(running)}</h2>
        <p class="s">Stärke zuletzt {last}/10 · seit {deShort(running.start)}</p>
        <div class="btns">
          <button type="button" class="btn" onclick={() => push({ name: "flare", id: running.id }, "today")}>Noch da</button>
          <button type="button" class="btn tint" onclick={() => push({ name: "flare", id: running.id }, "end")}>Vorbei</button>
        </div>
      {:else if !data.flares.length}
        <p class="big">Noch kein Schub</p>
        <p class="s">Das ist völlig in Ordnung. Wenn doch einer kommt, kannst du ihn hier festhalten.</p>
        <button type="button" class="btn block" onclick={openNew}>Schub eintragen</button>
      {:else if free <= 0}
        <p class="big">Schub vorbei</p>
        <p class="s">Der letzte Schub endete heute. Gut gemacht.</p>
        <button type="button" class="btn block" onclick={openNew}>Schub eintragen</button>
      {:else}
        <p class="big">{free} {free === 1 ? "Tag" : "Tage"}</p>
        <p class="s">ohne Schub · letzter Schub endete am {de(ended!.ende!)}</p>
        <button type="button" class="btn block" onclick={openNew}>Schub eintragen</button>
      {/if}
    </section>

    <section class="group" id="mood-group">
      <h2 class="gh">Wie geht’s dir?</h2>
      <div class="gl">
        <div class="row" style="padding-block:.75rem">
          <Segmented items={MOODS.map((m) => ({ ...m }))} bind:value={mood} label="Stimmung" mood onpick={() => { touched = true; }} />
        </div>
        <SliderRow id="energie" label="Energie" bind:value={energy} oninput={() => { touched = true; }} />
        <button type="button" class="row action" onclick={save}>Speichern</button>
      </div>
      <p class="gf" role="status">{savedLine}</p>
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
