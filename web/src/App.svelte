<script lang="ts">
  import { fade } from "svelte/transition";
  import TabBar from "./ui/TabBar.svelte";
  import Sheet from "./ui/Sheet.svelte";
  import Today from "./screens/Today.svelte";
  import Verlauf from "./screens/Verlauf.svelte";
  import Arzt from "./screens/Arzt.svelte";
  import FlareDetail from "./screens/FlareDetail.svelte";
  import AllFlares from "./screens/AllFlares.svelte";
  import NewFlare from "./screens/NewFlare.svelte";
  import Settings from "./screens/Settings.svelte";
  import DaySheet from "./screens/DaySheet.svelte";
  import EndSheet from "./screens/EndSheet.svelte";
  import MoodSheet from "./screens/MoodSheet.svelte";
  import Lock from "./screens/Lock.svelte";
  import { app, motion, start } from "./lib/store.svelte";

  start();
  const hearts = ["💗", "💖", "🌸", "✨", "💕"];
  // the page behind a sheet or the lock can't be reached
  const covered = $derived(app.locked || app.sheet !== null);
  const buried = $derived(app.stack.length > 0);
</script>

{#if app.started}
  <div class="root" inert={covered} style="position:absolute;inset:0">
    <div style="position:absolute;inset:0;isolation:isolate" inert={buried} aria-hidden={buried}>
      <!-- the three tabs stay mounted, so each keeps its scroll position -->
      <main class="screen tab" hidden={app.tab !== "heute"}><Today /></main>
      <main class="screen tab" hidden={app.tab !== "verlauf"}><Verlauf /></main>
      <main class="screen tab" hidden={app.tab !== "arzt"}><Arzt /></main>
      <TabBar />
    </div>
    {#each app.stack as r, i (i + (r.name === "flare" ? r.id : r.name))}
      {#if r.name === "flare"}<FlareDetail id={r.id} />{:else}<AllFlares />{/if}
    {/each}
  </div>

  {#if app.sheet === "new"}<NewFlare />{/if}
  {#if app.sheet === "settings"}<Settings />{/if}
  {#if app.sheet === "day" && app.day}{#key app.day}<DaySheet />{/key}{/if}
  {#if app.sheet === "end"}<EndSheet />{/if}
  {#if app.sheet === "mood"}<MoodSheet />{/if}
  {#if app.locked}<Lock />{/if}

  {#key app.fx}
    {#if app.fx}
      <div class="fx" aria-hidden="true">
        {#each Array.from({ length: 16 }) as _, i}<i style="left:{(i * 37) % 92 + 2}%;font-size:{1 + (i % 4) * 0.3}rem;animation-delay:{(i % 6) * 0.12}s">{hearts[i % hearts.length]}</i>{/each}
      </div>
    {/if}
  {/key}
  {#if app.toast}
    <p class="toast" class:high={app.stack.length > 0} class:top={app.sheet !== null} role="status" transition:fade={{ duration: motion(150) }}>{app.toast}{#if app.toastAction}<button type="button" class="tbtn" onclick={() => { const a = app.toastAction; app.toast = ""; app.toastAction = null; a?.run(); }}>{app.toastAction.label}</button>{/if}</p>
  {/if}
{/if}
