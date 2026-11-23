<script lang="ts">
  // Today's mood and energy: the card on Heute and the quick sheet are this one component, so they behave the same.
  import Segmented from "./Segmented.svelte";
  import SliderRow from "./SliderRow.svelte";
  import { q } from "../lib/phone";
  import { today } from "../lib/dates";
  import { saveMood } from "../lib/flow";
  import { loader } from "../lib/load.svelte";
  import { quiet, refresh, toast } from "../lib/store.svelte";

  let { action = "Speichern", id = "energie", onsaved }: { action?: string; id?: string; onsaved?: () => void } = $props();
  type Mood = "gut" | "okay" | "mau" | "schlecht";
  const MOODS = [
    { key: "gut", emoji: "😊", label: "Gut" }, { key: "okay", emoji: "🙂", label: "Okay" },
    { key: "mau", emoji: "😕", label: "Mau" }, { key: "schlecht", emoji: "😣", label: "Schlecht" },
  ] as const;

  const view = loader(async () => ({ saved: (await q("SELECT energie, gefuehl FROM tagesform WHERE tag = ?", [today()]))[0] as { energie: number; gefuehl: Mood | null } | undefined }));
  const data = $derived(view.data);
  // starts from what is saved; after the person touches it, it stays what they set
  let mood = $state<Mood | null>(null), energy = $state(5), touched = $state(false);
  $effect(() => { if (data && !touched) { mood = data.saved?.gefuehl ?? null; energy = data.saved?.energie ?? 5; } });
  const label = (m: Mood | null) => MOODS.find((x) => x.key === m)?.label;
  const line = $derived(data?.saved ? `Heute gespeichert ✓ Energie ${data.saved.energie}/10${data.saved.gefuehl ? ", " + label(data.saved.gefuehl) : ""}` : "Noch nicht eingetragen.");

  async function save() {
    try { await saveMood(mood, energy); touched = false; toast("Gespeichert 💗"); refresh(); onsaved?.(); } catch (e) { quiet(e); }
  }
</script>

<div class="gl">
  <div class="row" style="padding-block:.75rem">
    <Segmented items={MOODS.map((m) => ({ ...m }))} bind:value={mood} label="Stimmung" mood onpick={() => (touched = true)} />
  </div>
  <SliderRow {id} label="Energie" bind:value={energy} oninput={() => (touched = true)} />
  <button type="button" class="row action" onclick={save}>{action}</button>
</div>
<p class="gf" role="status">{line}</p>
