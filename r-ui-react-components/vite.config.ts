import { promises as fs } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { glob } from "glob";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";

// Copy plain CSS files from src/ to dist/ at the same relative path. Lib mode
// only emits JS for the glob'd entries; the aggregator (styles.css), the domain
// tokens and every group's styles.css have to ship too, at the same relative
// paths, because styles.css reaches them with relative `@import`s.
function copyCssAssets(): Plugin {
  return {
    name: "copy-css-assets",
    apply: "build",
    async closeBundle() {
      const files = await glob("src/**/*.css");
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

// Library build for @batthewz/r-ui-react-components.
// - ESM only.
// - preserveModules so `./components/<group>` and `./hooks/<name>` subpaths
//   resolve to real files and tree-shake.
// - Every peer and dependency is external.
// - vite-plugin-dts emits .d.ts next to each module.
const entries = Object.fromEntries(
  glob
    .sync("src/**/*.{ts,tsx}", {
      // `*.test.*` also covers test-only helpers (`*.test.helpers.ts`).
      ignore: ["src/**/*.test.*", "src/**/*.examples.*", "src/**/*.d.ts"],
    })
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
      exclude: ["src/**/*.test.*", "src/**/*.examples.*"],
      rollupTypes: false,
      entryRoot: "src",
      outDir: "dist",
      compilerOptions: { declarationMap: true },
    }),
    copyCssAssets(),
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
        /^@floating-ui\/.+/,
        /^lucide-react($|\/)/,
        "clsx",
        "tailwind-merge",
        /^@batthewz\/r-ui-tw-merge($|\/)/,
        /^@batthewz\/r-ui-css($|\/)/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
    minify: false,
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
