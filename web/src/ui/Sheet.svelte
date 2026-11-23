<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { motion } from "../lib/store.svelte";
  // An iOS sheet: grabber, nav bar (cancel / title / action), scrolling body.
  let { title, cancel = "Abbrechen", action, actionDisabled = false, onclose, onaction, children }: {
    title: string; cancel?: string | null; action?: string; actionDisabled?: boolean; onclose: () => void; onaction?: () => void; children: Snippet;
  } = $props();
  let box: HTMLElement;
  $effect(() => { box.focus({ preventScroll: true }); });
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") onclose(); }} />
<div class="scrim" aria-hidden="true" onclick={onclose} transition:fade|global={{ duration: motion(220) }}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={box} transition:fly|global={{ y: 800, duration: motion(340), easing: cubicOut, opacity: 1 }}>
  <div class="grabber" aria-hidden="true"></div>
  <div class="navbar">
    {#if cancel}<button type="button" onclick={onclose}>{cancel}</button>{:else}<span></span>{/if}
    <h2>{title}</h2>
    {#if action}<button type="button" class="end" disabled={actionDisabled} onclick={onaction}>{action}</button>{:else}<span></span>{/if}
  </div>
  <div class="body">{@render children()}</div>
</div>
