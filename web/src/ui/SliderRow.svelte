<script lang="ts">
  // "Label ........ 5/10" with a native range input under it (pink fill).
  let { id, label, value = $bindable(), min = 1, max = 10, oninput }: { id: string; label: string; value: number; min?: number; max?: number; oninput?: () => void } = $props();
</script>

<div class="row col">
  <div style="display:flex;justify-content:space-between;gap:.75rem">
    <label for={id}>{label}</label>
    <output for={id} class="muted" style="font-variant-numeric:tabular-nums">{value}/{max}</output>
  </div>
  <input {id} class="slider" type="range" {min} {max} step="1" bind:value style:--f={(value - min) / (max - min)} {oninput} aria-valuetext="{value} von {max}" />
</div>
