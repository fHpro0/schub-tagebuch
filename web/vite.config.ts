import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The phone serves the bundle from its own scheme, so the page loads as a plain deferred script (no type="module",
// no crossorigin): one request type less to go wrong, and still no inline script.
const classicScript = (): Plugin => ({
  name: "classic-script",
  enforce: "post",
  transformIndexHtml: (html) => html.replace(/<script type="module" crossorigin /g, "<script defer ").replace(/ crossorigin(?==|>| )/g, ""),
});

export default defineConfig({
  base: "./",
  plugins: [svelte(), classicScript()],
  build: {
    outDir: "../app",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    target: "safari16",
    rollupOptions: { output: { format: "iife" } },
  },
});
