<script lang="ts">
  // A thin line chart in the iOS Charts style: hairline grid, labels on the right, small dots, nothing filled.
  let { values, labels, label, min = 0, max = 10, ticks = [0, 5, 10] }: {
    values: (number | null)[]; labels: string[]; label: string; min?: number; max?: number; ticks?: number[];
  } = $props();
  const W = 340, H = 156, L = 4, R = 22, T = 10, B = 24;
  const n = $derived(values.length);
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  // consecutive days are joined; a day with nothing written leaves a gap
  const segments = $derived.by(() => {
    const out: string[] = []; let cur: string[] = [];
    values.forEach((v, i) => {
      if (v == null) { if (cur.length > 1) out.push("M" + cur.join("L")); cur = []; return; }
      cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (cur.length > 1) out.push("M" + cur.join("L"));
    return out;
  });
  const step = $derived(Math.max(1, Math.ceil(n / 5)));
  const shown = $derived(labels.map((t, i) => ({ t, i })).filter(({ i }) => i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.8)));
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  {#each ticks as g}
    <line x1={L} x2={W - R + 6} y1={y(g)} y2={y(g)} stroke="var(--sep)" stroke-width=".5" />
    <text x={W - R + 12} y={y(g) + 3.5}>{g}</text>
  {/each}
  {#each segments as d}<path {d} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />{/each}
  {#each values as v, i}{#if v != null}<circle cx={x(i)} cy={y(v)} r={i === n - 1 || n < 20 ? 3.2 : 2.2} fill="var(--accent)" stroke="var(--cell)" stroke-width="1.5" />{/if}{/each}
  {#each shown as s}<text x={x(s.i)} y={H - 6} text-anchor={s.i === n - 1 && n > 1 ? "end" : s.i === 0 && n > 1 ? "start" : "middle"}>{s.t}</text>{/each}
</svg>
