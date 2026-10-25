#!/usr/bin/env node
// Builds the GitHub Pages site: the component showcase and the renderer playground, each
// from its package's latest release tag (so the site shows what npm serves, not `main`),
// under `<base>showcase/` and `<base>playground/`, plus the landing page at `<base>`.
// `--ref <ref>` builds both from that commit instead, for changes to the apps alone
// (a showcase page, not a component); the landing page names the ref.
// Usage: node scripts/build-pages.mjs <base> <out-dir> [--ref <ref>]   e.g. /r-ui/ _site
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `before` runs in the package folders it names first: the playground imports the library's build. */
const APPS = [
  { dir: "r-ui-react-components", script: "showcase:build", app: "showcase", path: "showcase/" },
  { dir: "r-ui-renderer", script: "playground:build", app: "playground", path: "playground/", before: ["r-ui-react-components"] },
];

function run(cmd, args, cwd) {
  console.log(`\n$ ${[cmd, ...args].join(" ")}   (in ${cwd})`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`\`${[cmd, ...args].join(" ")}\` failed`);
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function latestRelease(dir) {
  const [tag] = git("tag", "--list", `${dir}@*`, "--sort=-v:refname").split("\n").filter(Boolean);
  if (!tag) throw new Error(`${dir} has no release tag (${dir}@<version>) to build from.`);
  return { tag, version: tag.slice(dir.length + 1), commit: git("rev-list", "-n", "1", tag) };
}

/** `dir` as it is at `ref`, labelled with the package's version there and the commit. */
function atRef(dir, ref) {
  const commit = git("rev-parse", `${ref}^{commit}`);
  const { version } = JSON.parse(git("show", `${commit}:${dir}/package.json`));
  return { tag: ref, version: `${version} · ${ref.replace(/^origin\//, "")} ${commit.slice(0, 7)}`, commit };
}

function main(argv) {
  const [base, outArg, flag, ref, ...extra] = argv;
  const usage = "usage: node scripts/build-pages.mjs <base> <out-dir> [--ref <ref>]   (base like /r-ui/)";
  if (!base?.startsWith("/") || !base.endsWith("/") || !outArg || extra.length > 0) throw new Error(usage);
  if (flag !== undefined && (flag !== "--ref" || !ref)) throw new Error(usage);
  const out = resolve(outArg);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const releases = APPS.map((app) => ({ ...app, ...(ref ? atRef(app.dir, ref) : latestRelease(app.dir)) }));
  // Apps whose releases share a commit share one checkout and one install.
  for (const commit of new Set(releases.map((r) => r.commit))) {
    const tree = mkdtempSync(join(tmpdir(), "r-ui-pages-"));
    git("worktree", "add", "--detach", tree, commit);
    try {
      run("bun", ["install", "--frozen-lockfile"], tree);
      for (const release of releases.filter((r) => r.commit === commit)) {
        for (const dir of release.before ?? []) run("bun", ["run", "build"], join(tree, dir));
        run("bun", ["run", release.script, `--base=${base}${release.path}`], join(tree, release.dir));
        cpSync(join(tree, release.dir, release.app, "dist"), join(out, release.path), { recursive: true });
      }
    } finally {
      git("worktree", "remove", "--force", tree);
    }
  }

  let landing = readFileSync(join(ROOT, "site", "index.html"), "utf8");
  for (const { app, version } of releases) landing = landing.replaceAll(`{{${app}-version}}`, version);
  writeFileSync(join(out, "index.html"), landing);
  console.log(`\nSite written to ${out}: ${releases.map((r) => `${r.app} from ${r.tag}`).join(", ")}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`\nbuild-pages: ${error.message}`);
  process.exitCode = 1;
}
