import { fileURLToPath } from "node:url";

import { themeScript } from "@batthewz/r-ui-react-components/theme-script";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Imported with their extensions: Vite's native config loader resolves no extensionless TS imports.
import { fixtures } from "./fixtures-plugin.ts";
import { PREFERENCES } from "./themes.ts";

/**
 * Restores the saved View before the first paint on the playground route. A
 * `?view=` route takes its axes from the query alone (main.tsx), so the script
 * stands aside there and nothing saved leaks into a check.
 */
function themeScriptPlugin(): Plugin {
  const script = `if(!new URLSearchParams(location.search).has("view")){${themeScript(PREFERENCES)}}`;
  return {
    name: "playground-theme-script",
    transformIndexHtml: (html) => html.replace(/<meta charset="UTF-8" \/>/, (charset) => `${charset}<script>${script}</script>`),
  };
}

const root = fileURLToPath(new URL(".", import.meta.url));

// A consumer app: the renderer from ../src (edits show live), the library and
// the CSS package as an app imports them. Run through the package scripts
// playground:dev (4318), playground:build and playground:preview (4317).
export default defineConfig({
  root,
  plugins: [themeScriptPlugin(), fixtures(fileURLToPath(new URL("./fixtures", import.meta.url))), react(), tailwindcss()],
  server: { port: 4318, strictPort: true },
  preview: { port: 4317, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
