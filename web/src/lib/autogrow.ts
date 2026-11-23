import { tick } from "svelte";

/** A textarea that grows with its text. Pass the bound value so it refits when the value is set from code. */
export function autogrow(node: HTMLTextAreaElement, _value?: string) {
  const fit = () => { node.style.height = "auto"; node.style.height = node.scrollHeight + "px"; };
  node.addEventListener("input", fit);
  void tick().then(fit);
  return { update: () => { void tick().then(fit); }, destroy: () => node.removeEventListener("input", fit) };
}
