<script lang="ts">
  import Icon from "./Icon.svelte";
  import { dayCount, daysSince, de } from "../lib/dates";
  import { flareLen, symLine, type Flare } from "../lib/data";
  import { push } from "../lib/store.svelte";
  let { f }: { f: Flare } = $props();
  const n = $derived(flareLen(f));
</script>

<button type="button" class="row" onclick={() => push({ name: "flare", id: f.id })}>
  <span class="grow">
    <span class="title">{de(f.start)}</span>
    <span class="sub">{f.ende ? dayCount(n) : `läuft seit ${daysSince(n)}`} · {symLine(f)}</span>
  </span>
  <span class="val" aria-label="Stärke {f.maxst} von 10">{f.maxst}/10</span>
  <span class="chev"><Icon name="chev" size={1.1} /></span>
</button>
