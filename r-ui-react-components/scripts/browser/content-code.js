// @covers   content/CodeBlock, content/CopyButton
// @sections content-codeblock content-copybutton content-markdown
// @tier     component
//
// Browser check: CodeBlock and CopyButton in a real browser.
//
// Run it through `bun run browser:check content-code`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print content-code)"
//
// Asserts:
//   1. lazy load: a page with no CodeBlock (the Dashboard) requests no lowlight
//      module; opening the content sections (every section with a CodeBlock:
//      CodeBlock, CopyButton, Markdown) requests lowlight's core and exactly the
//      grammars their blocks name (plus what those embed): in the build, the grammar
//      chunks the page fetched; on the dev server (`--dev`), the grammars the loader
//      itself asked for. Its blocks then carry coloured token spans (`data-highlight="on"`);
//   2. copy: with clipboard permission granted, the first block's Copy button
//      puts exactly the block's source on the system clipboard, the button shows
//      the check, and the status region beside it says "Copied";
//   3. contrast: in the first dark theme the showcase lists, every rendered token span reads at
//      >= 4.5:1 on what is painted under it (the block, or a marked line's band),
//      composited as painted; harness: body ink on the block measures what its
//      tokens give;
//   4. 375px: no CodeBlock reaches past its section and no line paints past its
//      block outside a scroller (a `hidden` clip loses content, so it does not
//      count), a long line scrolls inside its
//      <pre> (positive control) and stops scrolling once wrapped;
//   5. forced colors: tokens collapse to the block's ink (the documented
//      decision) while keywords keep their weight, comments their slant, and a
//      marked line its inline-start bar.
async (page) => {
  const base = page.url().split("#")[0];
  const SECTIONS = ["content-codeblock", "content-copybutton", "content-markdown"];
  const problems = [];
  const notes = {};
  const isLowlight = (url) => /lowlight/i.test(url);

  try {
    // ── 1. Lazy load ────────────────────────────────────────────────────
    await page.goto(`${base}#/dashboard`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, { theme: "default", density: "comfortable", input: "fine" }]);
    const requested = [];
    const grammarRequests = [];
    const onRequest = (req) => {
      requested.push(req.url());
      grammarRequests.push({ url: req.url(), from: req.headers().referer ?? "" });
    };
    page.on("request", onRequest);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("main").first().waitFor();
    await page.waitForLoadState("networkidle");
    const onDashboard = requested.filter(isLowlight);
    if (onDashboard.length) problems.push(`lazy: the Dashboard (no CodeBlock) requested ${onDashboard.join(", ")}`);
    const before = requested.length;
    const grammarsBefore = grammarRequests.length;
    await openSection(page, SECTIONS, { view: { theme: "default", density: "comfortable", input: "fine" } });
    const section = page.locator("#content-codeblock");
    await section.waitFor();
    await page.waitForFunction(() => document.querySelectorAll("#content-codeblock [data-highlight=on]").length >= 6, null, { timeout: 15000 });
    page.off("request", onRequest);
    const onOverview = requested.slice(before).filter(isLowlight);
    if (onOverview.length === 0) problems.push("lazy: highlighting appeared but no lowlight module was requested after navigation");
    // Grammars load per language: the loader asks for exactly those the sections'
    // blocks name (ts, json, shell, diff, html, python, sql, and the Markdown
    // demo's sh) plus what they embed; go, rust, yaml and markdown are curated but
    // unused. In a build each curated grammar is a chunk named after it, so the
    // chunks the page fetched are the claim. On the dev server they are counted by
    // initiator: its pre-bundled lowlight entry drags in its own grammar set,
    // which the build tree-shakes away.
    const CURATED = /\/assets\/(bash|css|diff|go|javascript|json|markdown|python|rust|shell|sql|typescript|xml|yaml)-[\w-]{8}\.js$/;
    const grammarOf = ({ url, from }) =>
      BROWSER_CHECK_BUILT ? (CURATED.exec(url)?.[1] ?? []) : /code-highlight/.test(from) ? (url.match(/languages[_/]([a-z0-9]+)\.js/)?.[1] ?? []) : [];
    const grammars = [...new Set(grammarRequests.slice(grammarsBefore).flatMap(grammarOf))].sort();
    const expectedGrammars = ["bash", "css", "diff", "javascript", "json", "python", "shell", "sql", "typescript", "xml"];
    if (grammars.join() !== expectedGrammars.join()) problems.push(`lazy: the loader fetched grammars ${grammars.join(", ")}; expected ${expectedGrammars.join(", ")}`);
    const tokens = await section.locator("[data-token]").count();
    if (tokens < 50) problems.push(`lazy: only ${tokens} token spans after load`);
    const states = await section.locator("[data-highlight]").evaluateAll((els) => els.map((e) => e.getAttribute("data-highlight")));
    if (!states.includes("off")) problems.push("lazy: the unknown-language block should settle off");
    notes.lazy = { dashboardRequests: onDashboard.length, overviewRequests: onOverview.length, grammars: grammars.length, tokens };

    // ── 2. Copy ─────────────────────────────────────────────────────────
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base.match(/^https?:\/\/[^/]+/)[0] });
    const first = section.locator("[data-highlight]").first();
    await first.scrollIntoViewIfNeeded();
    const expected = await first.locator("[data-line]").evaluateAll((lines) => lines.map((l) => l.textContent).join("\n"));
    const copy = first.getByRole("button", { name: "Copy code" });
    await copy.click();
    await page.waitForFunction((el) => el.getAttribute("data-state") === "copied", await copy.elementHandle());
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    // The block shows its source minus one trailing newline; the clipboard gets it verbatim.
    if (clip.replace(/\n$/, "") !== expected || expected.length < 100) {
      problems.push(`copy: clipboard holds ${JSON.stringify(clip.slice(0, 60))}…, the block shows ${JSON.stringify(expected.slice(0, 60))}…`);
    }
    const announced = await copy.evaluate((button) => {
      const status = button.parentElement?.querySelector('[role="status"]');
      return status ? status.textContent.trim() : null;
    });
    if (announced !== "Copied") problems.push(`copy: the status beside the button says ${JSON.stringify(announced)}, expected "Copied"`);
    const glyphs = await copy.evaluate(async (button) => {
      await new Promise((r) => setTimeout(r, 400));
      return [...button.querySelectorAll("svg")].map((s) => Number(getComputedStyle(s).opacity));
    });
    if (glyphs[1] !== 1 || glyphs[0] !== 0) problems.push(`copy: glyph opacities ${glyphs} (copy, check, alert): the check should show`);
    notes.copy = { chars: clip.length, announced };

    // ── 3. Contrast in a dark theme ─────────────────────────────────────
    await openSection(page, SECTIONS, { view: { theme: await darkTheme(page), density: "comfortable", input: "fine" } });
    await page.waitForFunction(() => document.querySelectorAll("#content-codeblock [data-highlight=on]").length >= 6, null, { timeout: 15000 });
    const contrast = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const paint = (layers) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const color of layers) {
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const alpha = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      const lum = (rgb) =>
        rgb.map((v) => v / 255).map((s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const stackUnder = (el) => {
        const stack = [];
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          const a = alpha(bg);
          if (a > 0) stack.unshift(bg);
          if (a >= 1) return stack;
        }
        return ["Canvas", ...stack];
      };
      const measure = (el) => {
        const under = stackUnder(el);
        return ratio(paint([...under, getComputedStyle(el).color]), paint(under));
      };
      const spans = [...document.querySelectorAll("#content-codeblock [data-token], #content-markdown [data-token]")];
      const results = spans.map((el) => ({ role: el.dataset.token, text: el.textContent.slice(0, 24), ratio: Math.round(measure(el) * 100) / 100, marked: !!el.closest("[data-highlighted]") }));
      results.sort((a, b) => a.ratio - b.ratio);
      const pre = document.querySelector("#content-codeblock pre");
      const root = pre.closest("[data-highlight]");
      const tokenRatio = ratio(paint([getComputedStyle(root).backgroundColor, getComputedStyle(root).color]), paint([getComputedStyle(root).backgroundColor]));
      const roles = [...new Set(results.map((r) => r.role))].sort();
      return {
        scheme: getComputedStyle(document.documentElement).getPropertyValue("--SCHEME-DARK").trim(),
        measured: results.length,
        markedMeasured: results.filter((r) => r.marked).length,
        roles,
        tokenRatio: Math.round(tokenRatio * 100) / 100,
        bodyInk: Math.round(measure(pre) * 100) / 100,
        worst: results.slice(0, 3),
        below: results.filter((r) => r.ratio < 4.5),
      };
    });
    if (contrast.scheme !== "1") problems.push(`contrast: harness --SCHEME-DARK ${contrast.scheme}, the dark theme is 1`);
    if (Math.abs(contrast.bodyInk - contrast.tokenRatio) > 0.05) problems.push(`contrast: harness: body ink measures ${contrast.bodyInk}:1, its tokens give ${contrast.tokenRatio}:1`);
    if (contrast.measured < 100 || contrast.markedMeasured === 0) problems.push(`contrast: measured ${contrast.measured} spans (${contrast.markedMeasured} on marked lines)`);
    for (const role of ["keyword", "string", "number", "function", "type", "comment", "property", "addition", "deletion"]) {
      if (!contrast.roles.includes(role)) problems.push(`contrast: no rendered ${role} span was measured`);
    }
    for (const b of contrast.below) problems.push(`contrast: ${b.role} "${b.text}" ${b.ratio}:1 < 4.5:1${b.marked ? " (marked line)" : ""}`);
    notes.contrast = { measured: contrast.measured, worst: contrast.worst[0] };

    // ── 4. 375px: never wider than the page ─────────────────────────────
    await openSection(page, SECTIONS, { view: { theme: "default", density: "comfortable", input: "coarse" }, width: 375, height: 800 });
    await page.waitForFunction(() => document.querySelectorAll("#content-codeblock [data-highlight=on]").length >= 6, null, { timeout: 15000 });
    const narrow = await page.evaluate(() => {
      const out = [];
      for (const id of ["content-codeblock", "content-markdown", "content-copybutton"]) {
        const sec = document.getElementById(id).getBoundingClientRect();
        for (const block of document.querySelectorAll(`#${id} [data-highlight]`)) {
          const r = block.getBoundingClientRect();
          if (r.right > sec.right + 0.5 || r.left < sec.left - 0.5) out.push(`${id}: a CodeBlock spans ${Math.round(r.left)}–${Math.round(r.right)}, its section ${Math.round(sec.left)}–${Math.round(sec.right)}`);
          // Nothing inside may paint past the block unless a scroller between them clips it.
          for (const line of block.querySelectorAll("[data-line]")) {
            const lr = line.getBoundingClientRect();
            if (lr.right <= r.right + 0.5) continue;
            let clipped = false;
            for (let n = line.parentElement; n && n !== block.parentElement; n = n.parentElement) {
              if (/^(?:auto|scroll)$/.test(getComputedStyle(n).overflowX)) clipped = true;
            }
            if (!clipped) out.push(`${id}: line ${line.dataset.line} spills ${Math.round(lr.right - r.right)}px past its block, unclipped`);
          }
        }
      }
      const longPre = [...document.querySelectorAll("#content-codeblock pre")].find((p) => p.textContent.includes("acme-industries-international") && !p.hasAttribute("data-wrap"));
      return {
        out,
        longScrolls: longPre ? longPre.scrollWidth > longPre.clientWidth + 50 : null,
      };
    });
    problems.push(...narrow.out.map((o) => `375: ${o}`));
    if (narrow.longScrolls !== true) problems.push("375: harness: the long-line block does not scroll inside its <pre>");
    const longBlock = section.locator("[data-highlight]").filter({ hasText: "acme-industries-international" }).first();
    await longBlock.getByRole("button", { name: "Wrap lines" }).click();
    const wrapped = await longBlock.locator("pre").evaluate((p) => p.scrollWidth - p.clientWidth);
    if (wrapped > 0) problems.push(`375: wrapped, the long line still scrolls by ${wrapped}px`);
    notes.narrow = { pageOverflow: narrow.page, wrappedOverflow: wrapped };

    // ── 5. Forced colors ────────────────────────────────────────────────
    await openSection(page, SECTIONS, { view: { theme: "default", density: "comfortable", input: "coarse" }, forced: true });
    await page.waitForFunction(() => document.querySelectorAll("#content-codeblock [data-highlight=on]").length >= 6, null, { timeout: 15000 });
    const forced = await page.evaluate(() => {
      const block = document.querySelector("#content-codeblock [data-highlight=on]");
      const ink = getComputedStyle(block.querySelector("pre")).color;
      const spans = [...block.querySelectorAll("[data-token]")];
      const off = spans.filter((s) => getComputedStyle(s).color !== ink).map((s) => `${s.dataset.token}:${getComputedStyle(s).color}`);
      const kw = spans.find((s) => s.dataset.token === "keyword");
      const cm = spans.find((s) => s.dataset.token === "comment");
      const marked = block.querySelector("[data-highlighted]");
      return {
        spans: spans.length,
        off: off.slice(0, 3),
        keywordWeight: kw ? Number(getComputedStyle(kw).fontWeight) : null,
        commentStyle: cm ? getComputedStyle(cm).fontStyle : null,
        bar: marked ? Number.parseFloat(getComputedStyle(marked).borderInlineStartWidth) : null,
      };
    });
    if (forced.spans < 20) problems.push(`forced: only ${forced.spans} token spans`);
    if (forced.off.length) problems.push(`forced: tokens keep their own colour (${forced.off.join(", ")}), the documented decision is to collapse to the block's ink`);
    if (!(forced.keywordWeight >= 600)) problems.push(`forced: a keyword's weight is ${forced.keywordWeight}`);
    if (forced.commentStyle !== "italic") problems.push(`forced: a comment's style is ${forced.commentStyle}`);
    if (!(forced.bar > 0)) problems.push(`forced: a marked line's bar is ${forced.bar}px`);
    notes.forced = forced;
  } finally {
    await page.context().clearPermissions();
  }

  if (problems.length) throw new Error(`content-code FAILED (${problems.length}):\n  ${problems.join("\n  ")}\n${JSON.stringify(notes)}`);
  return `content-code OK ${JSON.stringify(notes)}`;
}
