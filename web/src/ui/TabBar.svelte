<script lang="ts">
  import Icon from "./Icon.svelte";
  import { app, setTab, type Tab } from "../lib/store.svelte";
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "heute", label: "Heute", icon: "heart" },
    { key: "verlauf", label: "Verlauf", icon: "chart" },
    { key: "arzt", label: "Arzt", icon: "doc" },
  ];
  const keys = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length].key;
    setTab(next);
    (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>("button")[(i + d + tabs.length) % tabs.length].focus();
  };
</script>

<div class="tabbar" role="tablist" aria-label="Bereiche">
  {#each tabs as t, i (t.key)}
    {@const on = app.tab === t.key}
    <button type="button" role="tab" aria-selected={on} tabindex={on ? 0 : -1} onclick={() => setTab(t.key)} onkeydown={(e) => keys(e, i)}>
      <Icon name={t.icon} filled={on && t.icon === "heart"} />
      <span>{t.label}</span>
    </button>
  {/each}
</div>
