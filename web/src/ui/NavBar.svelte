<script lang="ts">
  import Icon from "./Icon.svelte";
  import { pop } from "../lib/store.svelte";
  let { title }: { title: string } = $props();
</script>

<div class="navbar">
  <button type="button" onclick={pop} aria-label="Zurück"><Icon name="back" size={1.35} /><span>Zurück</span></button>
  <h2>{title}</h2>
  <span></span>
</div>
