#!/usr/bin/env node
// Publishes every workspace package whose version is not on npm yet, in dependency order,
// and skips the rest. Each one passes its `check` and `test`, is packed by bun (which runs
// `prepack` and rewrites `workspace:` ranges; `npm publish` from the folder would ship them
// verbatim), and the tarball is published by npm, so npm's login and 2FA prompts apply.
// Each publish is tagged `<folder>@<version>` and the tags are pushed at the end (a
// component library or renderer tag deploys the Pages site). A failed run can be re-run:
// what it published is skipped.
// Usage: node scripts/publish.mjs [--dry-run] [--skip-checks]
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: node scripts/publish.mjs [--dry-run] [--skip-checks]";

class PublishError extends Error {}

// Throws rather than exits, so a failure mid-run still pushes the tags of what it published.
function fail(message) {
  throw new PublishError(message);
}

function run(cmd, args, cwd = ROOT) {
  const where = cwd === ROOT ? "" : `   (in ${cwd.slice(ROOT.length + 1)})`;
  console.log(`\n$ ${[cmd, ...args].join(" ")}${where}`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) fail(`\`${[cmd, ...args].join(" ")}\` failed`);
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  return { ok: result.status === 0, out: result.stdout.trim() };
}

function readPackages() {
  const { workspaces } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return workspaces.map((dir) => {
    const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8"));
    return { dir, path: join(ROOT, dir), manifest, name: manifest.name, version: manifest.version };
  });
}

/** Upstream first: a package follows every workspace package it names in any dependency field. */
function dependencyOrder(packages) {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const ordered = [];
  const visit = (pkg, trail) => {
    if (ordered.includes(pkg)) return;
    if (trail.includes(pkg)) fail(`dependency cycle: ${[...trail, pkg].map((p) => p.name).join(" → ")}`);
    const { dependencies, peerDependencies, devDependencies } = pkg.manifest;
    for (const name of Object.keys({ ...dependencies, ...peerDependencies, ...devDependencies })) {
      if (byName.has(name)) visit(byName.get(name), [...trail, pkg]);
    }
    ordered.push(pkg);
  };
  for (const pkg of packages) visit(pkg, []);
  return ordered;
}

function isPublished({ name, version }) {
  const { ok, out } = capture("npm", ["view", `${name}@${version}`, "version", "--json"]);
  if (ok) return JSON.parse(out) === version;
  let code;
  try {
    code = JSON.parse(out).error?.code;
  } catch {
    // Not JSON: reported below.
  }
  if (code === "E404") return false;
  fail(`could not ask npm about ${name}@${version}:\n${out}`);
}

const tagOf = (pkg) => `${pkg.dir}@${pkg.version}`;

function preflight(pending) {
  const whoami = capture("npm", ["whoami"]);
  if (!whoami.ok) fail("not logged in to npm. Run `npm login`, then re-run this script.");
  console.log(`\nnpm user: ${whoami.out}`);
  // The tags and each package's `repository` link must point at a commit others can see.
  if (capture("git", ["status", "--porcelain"]).out !== "") fail("the working tree has uncommitted changes. Commit or stash them first.");
  const unpushed = capture("git", ["rev-list", "--count", "@{u}..HEAD"]);
  if (!unpushed.ok) fail("the current branch has no upstream. Push it first.");
  if (unpushed.out !== "0") fail(`${unpushed.out} commit(s) not pushed. Push them first.`);
  for (const pkg of pending) {
    if (capture("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagOf(pkg)}`]).ok) {
      fail(`tag ${tagOf(pkg)} already exists, but ${pkg.name}@${pkg.version} is not on npm.`);
    }
  }
}

function runGates(packages, pending) {
  // A package's gates may read a sibling's build (the renderer derives its contracts from
  // the component library's dist), so build everything upstream-first before any gate runs.
  for (const pkg of packages) if (pkg.manifest.scripts?.build) run("bun", ["run", "build"], pkg.path);
  for (const pkg of pending) {
    const { check, test } = pkg.manifest.scripts ?? {};
    if (check) run("bun", ["run", "check"], pkg.path);
    if (test && !check?.includes("bun run test")) run("bun", ["run", "test"], pkg.path);
  }
}

function publish(pending, dryRun) {
  const packDir = mkdtempSync(join(tmpdir(), "r-ui-publish-"));
  const tags = [];
  try {
    for (const pkg of pending) {
      run("bun", ["pm", "pack", "--destination", packDir], pkg.path);
      const tarball = join(packDir, `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`);
      if (!existsSync(tarball)) fail(`bun pm pack did not write ${tarball}`);
      run("npm", ["publish", tarball, "--access", "public", ...(dryRun ? ["--dry-run"] : [])]);
      if (dryRun) continue;
      run("git", ["tag", "-a", tagOf(pkg), "-m", `${pkg.name} ${pkg.version}`]);
      tags.push(tagOf(pkg));
    }
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    // One push per tag: GitHub raises no push event for a push of more than three tags,
    // and the Pages workflow deploys on these tags.
    const unpushed = tags.filter((tag) => spawnSync("git", ["push", "origin", tag], { cwd: ROOT, stdio: "inherit" }).status !== 0);
    if (unpushed.length > 0) console.error(`\npublish: pushing tags failed. Run: git push origin ${unpushed.join(" ")}`);
  }
}

function main(argv) {
  const flags = new Set(argv);
  const dryRun = flags.delete("--dry-run");
  const skipChecks = flags.delete("--skip-checks");
  if (flags.size > 0) fail(`unknown flag ${[...flags].join(", ")}\n${USAGE}`);

  const packages = dependencyOrder(readPackages());
  const pending = packages.filter((pkg) => {
    const published = isPublished(pkg);
    console.log(`${published ? "skip   " : "publish"}  ${pkg.name}@${pkg.version}`);
    return !published;
  });
  if (pending.length === 0) {
    console.log("\nEvery package's version is already on npm. Bump a version to publish it.");
    return;
  }

  if (!dryRun) preflight(pending);
  if (skipChecks) console.log("\nSkipping checks (--skip-checks).");
  else runGates(packages, pending);
  publish(pending, dryRun);

  const list = pending.map((p) => `${p.name}@${p.version}`).join(", ");
  console.log(`\n${dryRun ? "Dry run complete for" : "Published"}: ${list}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof PublishError)) throw error;
  console.error(`\npublish: ${error.message}`);
  process.exitCode = 1;
}
