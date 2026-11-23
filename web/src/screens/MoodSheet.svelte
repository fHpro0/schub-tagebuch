<script lang="ts">
  import Sheet from "../ui/Sheet.svelte";
  import MoodEditor from "../ui/MoodEditor.svelte";
  import { app } from "../lib/store.svelte";
  const close = () => { app.sheet = null; };
</script>

<Sheet title="Wie geht’s dir?" cancel="Abbrechen" compact onclose={close}>
  <MoodEditor id="energie-sheet" action="Sichern" onsaved={close} />
</Sheet>
