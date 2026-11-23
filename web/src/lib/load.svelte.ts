// Run a loader in a component and keep its result; it reruns when the data changes (app.tick) or what it reads changes.
import { app, quiet } from "./store.svelte";

export function loader<T>(fn: () => Promise<T>) {
  let data = $state.raw<T | null>(null);
  let token = 0;
  $effect(() => {
    void app.tick;
    const mine = ++token;
    fn().then((v) => { if (mine === token) data = v; }, (e) => { if (mine === token) quiet(e); });
  });
  return { get data() { return data; } };
}
