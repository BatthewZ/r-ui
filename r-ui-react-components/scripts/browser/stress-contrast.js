// Browser check: in the dark example theme at compact density with coarse input,
// every visible text element on the Stress page reads at 4.5:1 or better.
//
// The CSS package's contrast gate proves the TOKEN pairs; this proves what is
// actually painted, where components layer tints, washes and status fills. For
// each element with its own visible text (and each text input and select), in
// page: the computed `color` is composited over the effective background, found
// by walking up the DOM for the first opaque `background-color` and laying every
// translucent one in between on top of it, exactly as painted (a 2D canvas does
// the colour maths, so oklch and color-mix values convert the way the browser
// converts them). Disabled and aria-hidden subtrees are skipped, as are SVG text
// and screen-reader-only text (no box to see). An ancestor with a background
// image makes the background unknowable; that is reported and fails.
//
// Runs at 1280 and 375 with the clipping card's menu open and a burst of toasts
// raised, so top-layer panels are measured too. Asserts:
//   1. harness: the theme resolves --SCHEME-DARK 1 and --HIT-MIN 44px, and a known
//      pair (body text on the page canvas) measures what the tokens give;
//   2. at least 300 text elements were measured (a check that measured nothing
//      must fail);
//   3. every one is >= 4.5:1. The result reports the worst on the page and the
//      worst inside the stress panels.
async (page) => {
  const MIN = 4.5;
  const base = page.url().split("#")[0];
  const fail = [];
  const runs = [];

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/stress`);
    await page.evaluate(() =>
      localStorage.setItem("r-ui-showcase:view", JSON.stringify({ theme: "nightfall", density: "compact", input: "coarse" })),
    );
    await page.reload();
    await page.locator("[data-stress-panel]").first().waitFor();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Raise \d+ toasts/ }).click();
    await page.locator('[data-testid="stress-clip-card"]').scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Row actions" }).click();
    await page.locator('[data-testid="stress-clip-card"] [role="menu"]').waitFor();
    await page.waitForTimeout(300);

    const m = await page.evaluate((MIN) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const alphaOf = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      // Paint `layers` (bottom first) and read back the sRGB result.
      const paint = (layers) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const { color, alpha = 1 } of layers) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
        }
        ctx.globalAlpha = 1;
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };
      const lum = ([r, g, b]) => {
        const c = (v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      // What shows through when nothing up to <html> paints: the root's own
      // background, else the UA canvas for the page's color-scheme.
      const rootBg = (() => {
        const own = getComputedStyle(document.documentElement).backgroundColor;
        if (alphaOf(own) >= 1) return own;
        const probe = document.createElement("span");
        probe.style.color = "Canvas";
        document.body.append(probe);
        const canvasColor = getComputedStyle(probe).color;
        probe.remove();
        return canvasColor;
      })();

      // The background stack under `el`, bottom (opaque) first; null when an image is in the way.
      const backgroundOf = (el) => {
        const stack = [];
        for (let n = el; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage !== "none") return { image: n };
          const a = alphaOf(cs.backgroundColor);
          if (a > 0) stack.unshift({ color: cs.backgroundColor });
          if (a >= 1) return { stack };
        }
        stack.unshift({ color: rootBg });
        return { stack };
      };
      const opacityOf = (el) => {
        let o = 1;
        for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return o;
      };
      const label = (el) =>
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ").slice(0, 3).join(".")}` : ""} "${(el.value ?? el.textContent).trim().slice(0, 30)}"`;

      const skip = (el) =>
        el.closest('svg, :disabled, [aria-disabled="true"], [data-disabled], [aria-hidden="true"], [hidden]') !== null ||
        getComputedStyle(el).visibility !== "visible";

      const targets = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || !t.parentElement) continue;
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) targets.add(t.parentElement);
      }
      for (const f of document.querySelectorAll("select, textarea, input:not([type=checkbox], [type=radio], [type=hidden])")) {
        if (f.value && f.getBoundingClientRect().width > 1) targets.add(f);
      }

      const results = [];
      const unknown = [];
      for (const el of targets) {
        if (skip(el)) continue;
        const bg = backgroundOf(el);
        if (bg.image) {
          unknown.push(`${label(el)} over a background image on ${label(bg.image)}`);
          continue;
        }
        const color = getComputedStyle(el).color;
        const under = paint(bg.stack);
        const over = paint([...bg.stack, { color, alpha: opacityOf(el) }]);
        results.push({ inPanel: el.closest("[data-stress-panel]") !== null, el: label(el), ratio: Math.round(ratio(over, under) * 100) / 100, fg: over, bg: under });
      }
      results.sort((a, b) => a.ratio - b.ratio);

      // Harness: the page title against the tokens it should be painted with,
      // resolved directly, not through the background walk.
      const tokenColor = (name) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      };
      const canvasToken = tokenColor("--C-CANVAS");
      const tokenRatio = ratio(paint([{ color: canvasToken }, { color: tokenColor("--C-TEXT-PRIMARY") }]), paint([{ color: canvasToken }]));
      const page = results.find((r) => r.el.startsWith("h1") && r.el.includes('"Stress'));

      const root = getComputedStyle(document.documentElement);
      return {
        scheme: root.getPropertyValue("--SCHEME-DARK").trim(),
        hit: Number.parseFloat(root.getPropertyValue("--HIT-MIN")) * Number.parseFloat(root.fontSize),
        measured: results.length,
        toastsMeasured: results.filter((r) => r.el.includes("Webhook") || r.el.includes("Quota")).length,
        menuMeasured: results.filter((r) => r.el.includes('"Assign owner')).length,
        tokenRatio: Math.round(tokenRatio * 100) / 100,
        pageTitle: page?.ratio ?? null,
        worst: results.slice(0, 5),
        worstInPanels: results.find((r) => r.inPanel) ?? null,
        below: results.filter((r) => r.ratio < MIN),
        unknown,
      };
    }, MIN);

    const label = `nightfall/compact/coarse@${width}`;
    if (m.scheme !== "1") fail.push(`${label}: harness --SCHEME-DARK is ${m.scheme}, nightfall is dark (1)`);
    if (m.hit !== 44) fail.push(`${label}: harness --HIT-MIN ${m.hit}px, coarse predicts 44px`);
    if (m.pageTitle === null || Math.abs(m.pageTitle - m.tokenRatio) > 0.05) {
      fail.push(`${label}: harness: the page title measures ${m.pageTitle}:1, its tokens give ${m.tokenRatio}:1`);
    }
    if (m.measured < 300) fail.push(`${label}: only ${m.measured} text elements measured`);
    if (m.toastsMeasured === 0 || m.menuMeasured === 0) fail.push(`${label}: the open menu or the toasts were not measured`);
    for (const b of m.below) fail.push(`${label}: ${b.ratio}:1 < ${MIN}:1 for ${b.el} (rgb ${b.fg} on ${b.bg})`);
    for (const u of m.unknown) fail.push(`${label}: background unknowable: ${u}`);
    runs.push({ width, measured: m.measured, worst: m.worst[0], worstInPanels: m.worstInPanels, tokenRatio: m.tokenRatio });

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Dismiss all" }).click();
  }

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  await page.setViewportSize({ width: 1280, height: 900 });
  if (fail.length) throw new Error(`stress-contrast FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(runs)}`);
  return `stress-contrast OK ${JSON.stringify(runs)}`;
}
