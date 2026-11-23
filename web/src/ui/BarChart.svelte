<script lang="ts">
  // Thin rounded bars on a hairline baseline; value above each bar when there is room.
  let { values, labels, label, max, ticks, every = 1, showValues = false }: {
    values: (number | null)[]; labels: string[]; label: string; max?: number; ticks?: number[]; every?: number; showValues?: boolean;
  } = $props();
  const W = 340, H = 156, L = 4, T = 14, B = 24;
  const R = $derived(ticks ? 22 : 4);
  const n = $derived(values.length);
  const top = $derived(max ?? Math.max(1, ...values.map((v) => v ?? 0)));
  const slot = $derived((W - L - R) / n);
  const bw = $derived(Math.min(16, slot * 0.6));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  {#each ticks ?? [] as g}
    <line x1={L} x2={W - R + 6} y1={y(g)} y2={y(g)} stroke="var(--sep)" stroke-width=".5" />
    <text x={W - R + 12} y={y(g) + 3.5}>{g}</text>
  {/each}
  {#if !ticks}<line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--sep)" stroke-width=".5" />{/if}
  {#each values as v, i}
    {@const cx = L + i * slot + slot / 2}
    {#if v}
      <rect x={cx - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx={Math.min(3, bw / 2)} fill="var(--accent)" />
      {#if showValues}<text x={cx} y={y(v) - 4} text-anchor="middle">{v}</text>{/if}
    {/if}
    {#if (n - 1 - i) % every === 0}<text x={cx} y={H - 6} text-anchor="middle">{labels[i]}</text>{/if}
  {/each}
</svg>
