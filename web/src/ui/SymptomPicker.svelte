<script lang="ts">
  // The symptom list as an iOS check list, with "Eigenes Symptom hinzufügen…". Own symptoms can be removed while no flare uses them.
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { loadSymList, type SymOption } from "../lib/data";
  import { buzz, exec, q } from "../lib/phone";
  import { quiet, toast } from "../lib/store.svelte";

  let { selected = $bindable(), ontoggle }: { selected: string[]; ontoggle?: (name: string, on: boolean) => Promise<unknown> } = $props();
  let list = $state<SymOption[]>([]);
  let adding = $state(false), draft = $state("");
  let input = $state<HTMLInputElement>();
  const reload = async () => { list = await loadSymList(); };
  $effect(() => { reload().catch(quiet); });

  async function toggle(name: string) {
    const on = !selected.includes(name);
    selected = on ? [...selected, name] : selected.filter((x) => x !== name);
    try { await ontoggle?.(name, on); if (ontoggle) buzz("selection"); }
    catch (e) { selected = on ? selected.filter((x) => x !== name) : [...selected, name]; quiet(e); }
  }
  async function add() {
    const name = draft.trim().slice(0, 40);
    if (!name) { input?.focus(); return; }
    try {
      await exec("INSERT OR IGNORE INTO symptom_liste (name, emoji, ord, eigen) VALUES (?, '✏️', (SELECT max(100, coalesce(max(ord), 0) + 1) FROM symptom_liste), 1)", [name]);
      await reload();
      if (!selected.includes(name)) { await ontoggle?.(name, true); selected = [...selected, name]; }
      buzz("success"); adding = false; draft = "";
    } catch (e) { quiet(e); }
  }
  async function remove(y: SymOption) {
    try {
      const used = await q("SELECT count(*) AS n FROM symptome WHERE name = ?", [y.name]);
      if (used[0].n > 0) { toast(`„${y.name}“ wird in einem Schub verwendet und bleibt deshalb in der Liste.`); return; }
      await exec("DELETE FROM symptom_liste WHERE name = ? AND eigen = 1", [y.name]);
      selected = selected.filter((x) => x !== y.name); await reload(); buzz("selection");
    } catch (e) { quiet(e); }
  }
  async function openAdd() { adding = true; await tick(); input?.focus(); }
</script>

<div class="gl" role="group" aria-label="Symptome">
  {#each list as y (y.name)}
    {@const on = selected.includes(y.name)}
    <div class="row pick" class:own={y.eigen}>
      <button type="button" class="hit" role="checkbox" aria-checked={on} onclick={() => toggle(y.name)}>
        <span class="lead" aria-hidden="true">{y.emoji}</span>
        <span class="grow title">{y.name}</span>
      </button>
      {#if y.eigen}<button type="button" class="del" aria-label="Eigenes Symptom {y.name} entfernen" onclick={() => remove(y)}><Icon name="x" size={1.1} /></button>{/if}
      <span class="tick" aria-hidden="true">{#if on}<Icon name="check" size={1.25} />{/if}</span>
    </div>
  {/each}
  {#if adding}
    <div class="row">
      <span class="lead" aria-hidden="true"><Icon name="plus" size={1.25} /></span>
      <input class="field grow" bind:this={input} bind:value={draft} type="text" maxlength="40" placeholder="Wie nennst du es?" aria-label="Eigenes Symptom" enterkeyhint="done" autocomplete="off"
        onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" class="mini" onclick={add}>Hinzufügen</button>
      <button type="button" class="mini muted" aria-label="Abbrechen" onclick={() => { adding = false; draft = ""; }}><Icon name="x" size={1.1} /></button>
    </div>
  {:else}
    <button type="button" class="row" style="color:var(--accent-text)" onclick={openAdd}>
      <span class="lead" aria-hidden="true"><Icon name="plus" size={1.25} /></span>
      <span class="grow">Eigenes Symptom hinzufügen…</span>
    </button>
  {/if}
</div>

<style>
  .pick { display: grid; grid-template-columns: minmax(0, 1fr) auto 3rem; padding: 0; gap: 0; }
  .hit { grid-column: 1 / -1; grid-row: 1; display: flex; align-items: center; gap: .75rem; min-height: 2.75rem; padding: .5rem 3.25rem .5rem 1rem; border: 0; background: none; text-align: left; }
  .own .hit { padding-right: 5.75rem; }
  .hit:active { background: var(--hl); }
  .hit:focus-visible { outline-offset: -2px; }
  .del { grid-column: 2; grid-row: 1; z-index: 1; width: 2.75rem; height: 2.75rem; border: 0; background: none; color: var(--label2); display: grid; place-items: center; }
  .tick { grid-column: 3; grid-row: 1; justify-self: center; pointer-events: none; }
  .mini { flex: none; min-height: 2.75rem; min-width: 2.25rem; display: grid; place-items: center; padding: 0 .25rem; border: 0; background: none; color: var(--accent-text); font-weight: 600; }
  .mini.muted { color: var(--label2); font-weight: 400; }
</style>
