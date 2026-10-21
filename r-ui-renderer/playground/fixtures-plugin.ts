import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import type { Plugin } from "vite";

const TYPES: { readonly [extension: string]: string } = {
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Serves `dir` at `/<urlPath>/` on the dev server, and writes it to the same
 * path in the build (which `vite preview` then serves as it is).
 */
export function fixtures(dir: string, urlPath = "fixtures"): Plugin {
  const prefix = `/${urlPath}/`;

  async function serve(request: IncomingMessage, response: ServerResponse, next: () => void): Promise<void> {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    if (!pathname.startsWith(prefix)) return next();
    const file = path.resolve(dir, `.${pathname.slice(prefix.length - 1)}`);
    const inside = file.startsWith(`${path.resolve(dir)}${path.sep}`);
    const body = inside ? await fs.readFile(file).catch(() => undefined) : undefined;
    if (body === undefined) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
    response.end(body);
  }

  return {
    name: "playground-fixtures",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        serve(request, response, next).catch(next);
      });
    },
    async generateBundle() {
      for (const file of await listFiles(dir)) {
        this.emitFile({
          type: "asset",
          fileName: path.posix.join(urlPath, path.relative(dir, file).split(path.sep).join("/")),
          source: await fs.readFile(file),
        });
      }
    },
  };
}
