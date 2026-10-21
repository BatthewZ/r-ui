import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // `scripts/**/*.test.mjs` are the gates' own tests (each proves its gate goes
    // red on a fixture); they opt into the node environment per file.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs", "playground/**/*.test.{ts,tsx,mjs}"],
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
  },
});
