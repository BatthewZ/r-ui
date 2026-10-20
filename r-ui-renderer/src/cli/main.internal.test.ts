// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { type CliIO, INTERNAL_ERROR, main } from "./main";

// A bug inside the validator, simulated: the CLI must say so with its own
// exit status rather than call the document invalid.
vi.mock("../spec/validate", () => ({
  validateViewSpec: () => {
    throw new TypeError("boom");
  },
}));

describe("main: an internal error", () => {
  it("exits 3, distinct from an invalid document, and prints nothing on stdout", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const io: CliIO = {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
      readFile: () => Promise.reject(new Error("unused")),
      readStdin: () => Promise.resolve(""),
      stdinIsTTY: false,
    };
    expect(await main(["--raw", "{}"], io)).toBe(3);
    expect(out).toEqual([]);
    expect(err).toHaveLength(1);
    expect(err[0]?.startsWith(`${INTERNAL_ERROR}TypeError: boom`)).toBe(true);
  });
});
