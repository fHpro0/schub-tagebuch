<script lang="ts">
  import Sheet from "../ui/Sheet.svelte";
  import SliderRow from "../ui/SliderRow.svelte";
  import SymptomPicker from "../ui/SymptomPicker.svelte";
  import Icon from "../ui/Icon.svelte";
  import { autogrow } from "../lib/autogrow";
  import { batch, buzz, reloadWidget } from "../lib/phone";
  import { hex16, today } from "../lib/dates";
  import { app, push, quiet, refresh } from "../lib/store.svelte";

  const AUS = ["Unbekannt", "Infekt", "Stress", "Hitze", "Wenig Schlaf", "Zyklus", "Anderes"];
  const PROMPT = "Was genau? Wo im Körper? Wie fühlt es sich an? Wie hat es angefangen?";

  let start = $state(today()), staerke = $state(5), aus = $state("Unbekannt"), syms = $state<string[]>([]), desc = $state("");
  const valid = $derived(!!start && start <= today());

  async function save() {
    if (!valid) return;
    const id = hex16(), text = desc.trim() || null;
    const list = [{ sql: "INSERT INTO schuebe (id, start, staerke, ausloeser, beschreibung) VALUES (?, ?, ?, ?, ?)", params: [id, start, staerke, aus === "Unbekannt" ? null : aus, text] }];
    for (const name of syms) list.push({ sql: "INSERT OR IGNORE INTO symptome (schub, name) VALUES (?, ?)", params: [id, name] });
    list.push({ sql: "INSERT INTO verlauf (schub, tag, staerke) VALUES (?, ?, ?)", params: [id, start, staerke] });
    try { await batch(list); buzz("success"); reloadWidget(); app.sheet = null; app.stack = []; push({ name: "flare", id }); refresh(); } catch (e) { quiet(e); }
  }
</script>

<Sheet title="Neuer Schub" action="Sichern" actionDisabled={!valid} onclose={() => (app.sheet = null)} onaction={save}>
  <section class="group">
    <h2 class="gh">Beginn</h2>
    <div class="gl">
      <div class="row"><label for="n-start" class="grow">Beginn</label><input id="n-start" class="date" type="date" bind:value={start} max={today()} /></div>
    </div>
  </section>

  <section class="group">
    <h2 class="gh">Stärke</h2>
    <div class="gl"><SliderRow id="n-staerke" label="Stärke heute" bind:value={staerke} /></div>
  </section>

  <section class="group">
    <h2 class="gh">Auslöser</h2>
    <div class="gl" role="radiogroup" aria-label="Auslöser">
      {#each AUS as a (a)}
        <button type="button" class="row" role="radio" aria-checked={aus === a} onclick={() => (aus = a)}>
          <span class="grow">{a}</span>
          <span class="tick" aria-hidden="true">{#if aus === a}<Icon name="check" size={1.25} />{/if}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="group">
    <h2 class="gh">Symptome</h2>
    <SymptomPicker bind:selected={syms} />
  </section>

  <section class="group">
    <h2 class="gh">Beschreibung</h2>
    <div class="gl"><div class="row"><textarea class="field" rows="5" bind:value={desc} use:autogrow={desc} placeholder={PROMPT} aria-label="Beschreibung"></textarea></div></div>
    <p class="gf">Neue oder deutlich stärkere Beschwerden, die länger als 24 Stunden bleiben? Sag deiner Neurologin Bescheid.</p>
  </section>
</Sheet>
