<script lang="ts">
  // SF-like line icons, 24 x 24, drawn with a 1.7 stroke.
  let { name, size = 1.5, filled = false }: { name: string; size?: number; filled?: boolean } = $props();
  // a gear: eight teeth around a ring
  const gear = (() => {
    const pts: string[] = [];
    for (let k = 0; k < 8; k++) for (const [a, r] of [[-12, 7.6], [-7.5, 9.6], [7.5, 9.6], [12, 7.6]] as const) {
      const t = ((k * 45 + a - 90) * Math.PI) / 180;
      pts.push(`${(12 + r * Math.cos(t)).toFixed(2)},${(12 + r * Math.sin(t)).toFixed(2)}`);
    }
    return `M${pts.join("L")}Z`;
  })();
</script>

<svg viewBox="0 0 24 24" style:width="{size}rem" style:height="{size}rem" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  {#if name === "heart"}
    <path d="M12 20.3C7 16.9 3.7 13.7 3.7 9.9 3.7 7.4 5.6 5.6 8 5.6c1.6 0 3.2.9 4 2.4.8-1.5 2.4-2.4 4-2.4 2.4 0 4.3 1.8 4.3 4.3 0 3.8-3.3 7-8.3 10.4z" fill={filled ? "currentColor" : "none"} />
  {:else if name === "chart"}
    <path d="M4 4.5v15h16" /><path d="M7.5 14.5l3.5-4 3 2.7 4.5-6" />
  {:else if name === "doc"}
    <path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z" fill={filled ? "currentColor" : "none"} fill-opacity=".18" /><path d="M13.5 3.5v4.5h4.5" /><path d="M9.5 13h5M9.5 16.5h5" />
  {:else if name === "gear"}
    <path d={gear} /><circle cx="12" cy="12" r="2.9" />
  {:else if name === "chev"}
    <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  {:else if name === "back"}
    <path d="M14.500 5l-7 7 7 7" />
  {:else if name === "check"}
    <path d="M5 12.8l4.5 4.5L19 7.2" />
  {:else if name === "plus"}
    <path d="M12 5.5v13M5.5 12h13" />
  {:else if name === "x"}
    <path d="M7 7l10 10M17 7L7 17" />
  {/if}
</svg>
