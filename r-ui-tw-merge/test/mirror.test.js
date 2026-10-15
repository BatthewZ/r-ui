// The mirror rule: `tailwindMergeExtension` registers exactly the utility names
// r-ui-css declares, namespace by namespace, in both directions. r-ui-css is
// parsed at test time, so neither side is a hand-kept copy of the other.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

import { tailwindMergeExtension } from "../src/index.js";
import { CSS_PACKAGE_DIR, cssPackageEntry, readCssGraph } from "./lib/css-names.js";
import { UTILITY, compareMirror, cssNames, mirrorNames } from "./lib/mirror.js";

const graph = readCssGraph(cssPackageEntry());
const css = cssNames(graph);
const report = compareMirror(css.names, mirrorNames(tailwindMergeExtension));

describe("the CSS side is non-trivial", () => {
  test("the import graph is followed and @theme blocks are found in several files", () => {
    assert.ok(graph.files.length > 5, `only ${graph.files.length} file(s) visited`);
    assert.ok(new Set(graph.declarations.map((d) => d.file)).size > 3);
    assert.deepEqual(graph.bareImports, ["tailwindcss"], "a new package import may bring @theme names this test cannot see");
  });

  test("known names parse into the right namespaces", () => {
    assert.ok(css.names.get("spacing")?.has("r3"));
    assert.ok(css.names.get("text")?.has("h1"));
    assert.ok(css.names.get("font-weight")?.has("semibold"));
    assert.ok(css.names.get("transition-duration")?.has("fast"));
    assert.ok(css.names.get(UTILITY)?.has("focus-ring"));
    assert.ok(!css.names.get("text")?.has("h1--line-height"), "sub-properties are not utilities");
  });

  test("every @theme declaration is classified", () => {
    assert.deepEqual(css.problems, []);
  });
});

describe("mirror == r-ui-css, per namespace", () => {
  for (const ns of report.namespaces) {
    test(ns, () => {
      const { css: c, mirror: m } = report.byNamespace[ns];
      assert.ok(c.length > 0, `r-ui-css declares nothing in \`${ns}\`; remove it from the mirror`);
      assert.deepEqual(m, c);
    });
  }

  test("nothing missing, nothing stale", () => {
    assert.deepEqual({ missing: report.missing, stale: report.stale }, { missing: [], stale: [] });
  });
});

// Each case reports what the tampering ADDS to the real report, so these hold
// (and say something) even while the real mirror is out of step.
const added = (list, baseline) => list.filter((x) => !baseline.includes(x));

describe("the mirror check can fail", () => {
  const without = (ns, name) => {
    const mirror = mirrorNames(tailwindMergeExtension);
    assert.ok(mirror.get(ns).delete(name), `fixture: ${ns} ${name} was not in the mirror`);
    return mirror;
  };

  test("a name removed from the mirror is reported missing, and only that name", () => {
    const tampered = compareMirror(css.names, without("spacing", "control"));
    assert.deepEqual(added(tampered.missing, report.missing), ["spacing: control"]);
    assert.deepEqual(added(tampered.stale, report.stale), []);
    assert.notDeepEqual(tampered.byNamespace.spacing.mirror, tampered.byNamespace.spacing.css);
  });

  test("a removed class-group name (no tailwind-merge theme key) is reported missing", () => {
    const missing = (mirror) => added(compareMirror(css.names, mirror).missing, report.missing);
    assert.deepEqual(missing(without("opacity", "disabled")), ["opacity: disabled"]);
    assert.deepEqual(missing(without(UTILITY, "focus-ring-inset")), [`${UTILITY}: focus-ring-inset`]);
  });

  test("a name the CSS does not declare is reported stale", () => {
    const { theme, classGroups } = tailwindMergeExtension;
    const extra = mirrorNames({ theme: { ...theme, text: [...theme.text, "h7"] }, classGroups });
    assert.deepEqual(added(compareMirror(css.names, extra).stale, report.stale), ["text: h7"]);
  });

  test("an unmirrored namespace in the mirror is reported stale", () => {
    const extra = mirrorNames({ theme: { ...tailwindMergeExtension.theme, leading: ["tight"] }, classGroups: {} });
    assert.deepEqual(added(compareMirror(css.names, extra).stale, report.stale), ["leading: tight"]);
  });

  test("an unmirrored or unknown namespace in the CSS is a problem, not a skip", () => {
    const { problems } = cssNames({
      declarations: [
        { prop: "--blur-soft", value: "4px", file: "x.css" },
        { prop: "--text-shadow-sm", value: "0 1px red", file: "x.css" },
        { prop: "--made-up-thing", value: "1", file: "x.css" },
      ],
      utilities: ["tab-*"],
    });
    assert.equal(problems.length, 4, problems.join("\n"));
  });

  test("an @utility extends a theme utility only when it shares that utility's exact class", () => {
    const declarations = [
      { prop: "--text-h1", value: "1rem", file: "x.css" },
      { prop: "--color-ink", value: "black", file: "x.css" },
    ];
    const { names } = cssNames({ declarations, utilities: ["text-h1", "text-h1-face", "font-h1", "bg-ink", "bg-inkwell"] });
    assert.deepEqual([...names.get(UTILITY)].sort(), ["bg-inkwell", "font-h1", "text-h1-face"]);
    assert.deepEqual([...names.get("text")], ["h1"]);
    assert.deepEqual([...names.get("color")], ["ink"]);
  });

  describe("a token added to a new file in a copy of r-ui-css", () => {
    const dir = mkdtempSync(join(tmpdir(), "r-ui-tw-merge-mirror-"));
    after(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(join(CSS_PACKAGE_DIR, "src"), join(dir, "src"), { recursive: true });
    cpSync(join(CSS_PACKAGE_DIR, "package.json"), join(dir, "package.json"));
    writeFileSync(
      join(dir, "src/tokens/aurora.css"),
      "@theme inline {\n  --spacing-aurora: 1rem;\n  --text-aurora--line-height: 1;\n}\n@utility aurora-ring { outline: 0; }\n",
    );
    const tokensIndex = join(dir, "src/tokens/index.css");
    writeFileSync(tokensIndex, `${readFileSync(tokensIndex, "utf8")}\n@import "./aurora.css";\n`);

    test("is reported missing through the import graph", () => {
      const tampered = cssNames(readCssGraph(cssPackageEntry(dir)));
      assert.deepEqual(tampered.problems, []);
      const result = compareMirror(tampered.names, mirrorNames(tailwindMergeExtension));
      assert.deepEqual(added(result.missing, report.missing), ["@utility: aurora-ring", "spacing: aurora"]);
    });
  });
});
