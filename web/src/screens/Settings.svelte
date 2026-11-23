<script lang="ts">
  import Sheet from "../ui/Sheet.svelte";
  import SwitchRow from "../ui/SwitchRow.svelte";
  import { app, disableLock, enableLock } from "../lib/store.svelte";
  async function setLock(on: boolean) { if (on) await enableLock(); else disableLock(); }
</script>

<Sheet title="Einstellungen" cancel={null} action="Fertig" onclose={() => (app.sheet = null)} onaction={() => (app.sheet = null)}>
  <section class="group">
    <div class="gl"><SwitchRow label="Mit Face ID schützen" checked={app.lockOn} onchange={setLock} /></div>
    <p class="gf">Das Tagebuch fragt beim Öffnen nach Face ID.</p>
  </section>
  <section class="group">
    <h2 class="gh">Über</h2>
    <div class="gl">
      <div class="row"><span class="grow">Schub-Tagebuch</span><span class="val">Version 3</span></div>
    </div>
    <p class="gf">Alle Daten bleiben auf diesem iPhone.</p>
  </section>
</Sheet>
