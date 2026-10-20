import { promises as fs } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { glob } from "glob";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";

const CLI_CHUNK = "cli/r-ui-validate.js";

// Lib mode emits JS for the entries only; the stylesheet and the JSON Schema
// ship as files at the same relative paths (`./styles`, `./schema.json`).
function copyStaticAssets(): Plugin {
  return {
    name: "copy-static-assets",
    apply: "build",
    async closeBundle() {
      const files = await glob(["src/**/*.css", "src/schema.json"]);
      await Promise.all(
        files.map(async (file) => {
          const dest = path.join("dist", path.relative("src", file));
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(file, dest);
        }),
      );
    },
  };
}

// ESM only; preserveModules so every subpath is its own module graph (the
// React-free ones must not share a chunk with a React module); every peer is
// external; .d.ts beside each module.
const entries = Object.fromEntries(
  glob
    .sync("src/**/*.{ts,tsx}", { ignore: ["src/**/*.test.*", "src/**/*.d.ts"] })
    .map((file) => [
      path.relative("src", file.slice(0, file.length - path.extname(file).length)),
      path.resolve(file),
    ]),
);

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src/**/*"],
      exclude: ["src/**/*.test.*"],
      rollupTypes: false,
      entryRoot: "src",
      outDir: "dist",
      compilerOptions: { declarationMap: true },
    }),
    copyStaticAssets(),
  ],
  build: {
    lib: {
      entry: entries,
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        /^node:/,
        /^@batthewz\/r-ui-react-components($|\/)/,
        /^lucide-react($|\/)/,
        /^zod($|\/)/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        // The bin runs as `node dist/cli/r-ui-validate.js` through npm's shim.
        banner: (chunk) => (chunk.fileName === CLI_CHUNK ? "#!/usr/bin/env node" : ""),
        // src/ ships beside dist/, so the maps point at it instead of embedding a copy.
        sourcemapExcludeSources: true,
      },
    },
    sourcemap: true,
    minify: false,
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
