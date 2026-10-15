import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Imported with their extensions: Vite's native config loader (its future
// default) runs this file in Node, which resolves no extensionless TS imports.
import { themeScript } from "../src/util/preferences.ts";
import { PREFERENCES } from "./shell/view.ts";

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

// The showcase is a CONSUMER app: it imports the library from ../src (so a
// component edit shows up live) and the CSS package exactly as an app would.
// Run through the package scripts: showcase:dev / showcase:build / showcase:preview.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [themeScriptPlugin(), react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
