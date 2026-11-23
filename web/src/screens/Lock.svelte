<script lang="ts">
  import { app, unlock } from "../lib/store.svelte";
</script>

<div class="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title">
  <img src="./icon.svg" alt="" />
  <h2 id="lock-title">Schub-Tagebuch ist gesperrt</h2>
  <p role="status">{app.lockText}</p>
  <button type="button" class="btn" onclick={unlock}>Entsperren</button>
</div>
