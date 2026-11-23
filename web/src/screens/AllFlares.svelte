<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import NavBar from "../ui/NavBar.svelte";
  import FlareRow from "../ui/FlareRow.svelte";
  import { loadFlares } from "../lib/data";
  import { loader } from "../lib/load.svelte";
  import { motion } from "../lib/store.svelte";
  const view = loader(loadFlares);
</script>

<div class="screen pushed" transition:fly|global={{ x: "100%", duration: motion(340), easing: cubicOut, opacity: 1 }}>
  <NavBar title="Alle Schübe" />
  <div class="content">
    <div class="gl">{#each view.data ?? [] as f (f.id)}<FlareRow {f} />{:else}{#if view.data}<p class="empty">Noch kein Schub eingetragen.</p>{/if}{/each}</div>
  </div>
</div>
