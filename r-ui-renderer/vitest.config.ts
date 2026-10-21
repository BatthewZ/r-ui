import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // `scripts/**/*.test.mjs` are the gates' and the harness's own tests, and the
    // package's shape; they opt into the node environment per file.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs", "playground/**/*.test.{ts,tsx,mjs}"],
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
  },
});
