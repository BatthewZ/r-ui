// The `r-ui-validate` bin. React-free (verify:react-free); runs under Node 22+
// and bun. Everything but the process wiring is in ./main.

import { readFile } from "node:fs/promises";

import { internalErrorReport, main } from "./main";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

try {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    readFile: (path) => readFile(path, "utf8"),
    readStdin,
    stdinIsTTY: process.stdin.isTTY === true,
  });
} catch (error) {
  process.stderr.write(internalErrorReport(error));
  process.exitCode = 3;
}
