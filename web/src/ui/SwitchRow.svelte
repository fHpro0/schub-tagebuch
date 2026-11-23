<script lang="ts">
  // A whole row that is a switch (real button, role=switch). The knob is drawn with CSS.
  let { label, sub, checked, onchange }: { label: string; sub?: string; checked: boolean; onchange: (on: boolean) => void } = $props();
</script>

<button type="button" class="row" role="switch" aria-checked={checked} onclick={() => onchange(!checked)}>
  <span class="grow"><span class="title">{label}</span>{#if sub}<span class="sub">{sub}</span>{/if}</span>
  <span class="switch" aria-hidden="true"></span>
</button>
