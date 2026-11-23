<script lang="ts" generics="K extends string">
  type Item = { key: K; label: string; emoji?: string };
  let { items, value = $bindable(), label, kind = "radio", mood = false, onpick }: {
    items: Item[]; value: K | null; label: string; kind?: "radio" | "tab"; mood?: boolean; onpick?: (key: K) => void;
  } = $props();
  const pick = (k: K) => { value = k; onpick?.(k); };
</script>

<div class="seg" class:mood role={kind === "tab" ? "tablist" : "radiogroup"} aria-label={label}>
  {#each items as it (it.key)}
    {@const on = value === it.key}
    <button type="button" role={kind === "tab" ? "tab" : "radio"} aria-checked={kind === "tab" ? undefined : on} aria-selected={kind === "tab" ? on : undefined} onclick={() => pick(it.key)}>
      {#if it.emoji}<span class="emo" aria-hidden="true">{it.emoji}</span>{/if}
      <span class={it.emoji ? "lbl" : ""}>{it.label}</span>
    </button>
  {/each}
</div>
