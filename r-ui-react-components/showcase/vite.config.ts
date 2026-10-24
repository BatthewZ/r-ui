import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Imported with their extensions: Vite's native config loader (its future
// default) runs this file in Node, which resolves no extensionless TS imports.
import { themeScript } from "../src/util/preferences.ts";
import { INITIAL_THEME, PREFERENCES } from "./shell/view.ts";

/**
 * Puts the library's pre-paint `themeScript()` at the top of <head>, as a
 * client-only app does (an SSR app renders `<ThemeScript>` instead), so a reload
 * applies the saved theme, density and input before the first paint (no flash).
 */
function themeScriptPlugin(): Plugin {
  return {
    name: "showcase-theme-script",
    // After the charset, which must stay within the first 1024 bytes.
    transformIndexHtml: (html) =>
      html.replace(/<meta charset="UTF-8" \/>/, (charset) => `${charset}<script>${themeScript(PREFERENCES)}</script>`),
  };
}

/**
 * Publishes the app's theme list on `<html data-showcase-themes>`, so the
 * browser checks iterate the themes this app ships (and pick "a dark theme" by
 * its `--SCHEME-DARK`) instead of naming them. `view.ts` stays the one list.
 * Also ships the page in its first-visit theme (`INITIAL_THEME`).
 */
function themeListPlugin(): Plugin {
  return {
    name: "showcase-theme-list",
    transformIndexHtml: (html) =>
      html.replace(/<html\b/, `<html data-theme="${INITIAL_THEME}" data-showcase-themes="${PREFERENCES.themes.join(" ")}"`),
  };
}

// The showcase is a CONSUMER app: it imports the library from ../src (so a
// component edit shows up live) and the CSS package exactly as an app would.
// Run through the package scripts: showcase:dev / showcase:build / showcase:preview.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [themeScriptPlugin(), themeListPlugin(), react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
