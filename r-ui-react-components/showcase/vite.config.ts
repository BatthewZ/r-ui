import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The showcase is a CONSUMER app: it imports the library from ../src (so a
// component edit shows up live) and the CSS package exactly as an app would.
// Run through the package scripts: showcase:dev / showcase:build / showcase:preview.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
