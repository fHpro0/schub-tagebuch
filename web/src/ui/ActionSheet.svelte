<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { motion } from "../lib/store.svelte";
  // The iOS action sheet: a message with one destructive choice, and a separate Cancel.
  let { message, confirm, onconfirm, oncancel }: { message: string; confirm: string; onconfirm: () => void; oncancel: () => void } = $props();
  let box: HTMLElement;
  $effect(() => { box.focus({ preventScroll: true }); });
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") oncancel(); }} />
<div class="scrim top" aria-hidden="true" onclick={oncancel} transition:fade|global={{ duration: motion(200) }}></div>
<div class="actions" role="alertdialog" aria-modal="true" aria-label={message} tabindex="-1" bind:this={box} transition:fly|global={{ y: 400, duration: motion(300), easing: cubicOut, opacity: 1 }}>
  <div class="gl">
    <p>{message}</p>
    <button type="button" class="row action danger" onclick={onconfirm}>{confirm}</button>
  </div>
  <div class="gl"><button type="button" class="row action bold" onclick={oncancel}>Abbrechen</button></div>
</div>
