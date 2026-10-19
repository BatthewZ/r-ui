// @covers   motion/CountUp
// @sections motion-countup
// @tier     component
// @flags    timing
//
// Browser check: CountUp counts when scrolled into view, every frame in the locale, lands on
// the exact formatted value, and gives assistive tech only the final value throughout.
//
// jsdom has no IntersectionObserver, no Web Animations clock and no layout; the count is a
// question of frames painted while a real page scrolls.
//
// Run it through `bun run browser:check motion-extras-count-up`.
//
// On the CountUp section opened alone with a viewport of runway above it, the page at its top
// (the section below the fold), the first band
// (`[data-sc="count-up-band"]`) and its figures (`[data-sc="count-up"]`):
//   1. harness: the first figure is below the viewport, `data-count="waiting"`, shows the
//      start ("0" in the runtime's locale) and its readable text (text outside
//      `aria-hidden`) is the final value, `Intl.NumberFormat` of 12480; its computed
//      `transition-duration` is `--DURATION-SLOW` × 4 (a probe) and over 0;
//   2. scrolled into view and sampled every frame until it settles: it counts (some frame
//      shows a number strictly between 0 and 12480, each one formatted exactly as Intl
//      formats it), the shown numbers never fall, the readable text is the final value in
//      every frame, the box's width never changes, the count takes at least half its
//      duration, and it ends `static` on exactly the formatted final value;
//   3. every other figure in the band ends on its own exact text (the percent "99.95%" by
//      Intl, the compact currency and the unit as their formatters print them: equal to the
//      readable text), in tabular figures (`font-variant-numeric`);
//   4. the German band ends on "12.480" (the LocaleProvider's locale); the missing figure is
//      the dash and `static`;
//   5. under reduced motion, loaded at the top: the figure below the fold is `static` on the
//      final value at once, and stays exactly that for 20 frames after scrolling to it;
//   6. no console or page error. (Nothing scrolling sideways at 375 is sweep-overview's sweep.)
//
// Suggested break: drop `aria-hidden` from `.r-motion-count-up-value` (2 fails: the readable
// text carries the moving digits), or stop clearing the last frame in CountUp's tick (2 fails
// on the final text when a value has more decimals than it prints).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  /** `top`: below a viewport of runway, scrolled to the top, so the figures start below the fold. */
  const load = async ({ width = 1280, reduced = false, view = {}, top = true } = {}) => {
    await openSection(page, "motion-countup", {
      view: { theme: "default", density: "comfortable", input: "fine", ...view },
      width,
      reduced,
      runway: top,
    });
    await page.locator('[data-sc="count-up"]').first().waitFor({ state: "attached" });
    if (top) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
    }
  };

  /** Reading helpers, installed in the page once per load. */
  const install = () =>
    page.evaluate(() => {
      window.__scCount = {
        readable(root) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let text = "";
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.parentElement.closest('[aria-hidden="true"]')) text += n.textContent;
          }
          return text;
        },
        shown: (root) => root.querySelector(".r-motion-count-up-value").textContent,
      };
    });

  await load();
  await install();
  const intl = (n) => page.evaluate((v) => new window.Intl.NumberFormat(undefined, { signDisplay: "negative" }).format(v), n);
  const FINAL = await intl(12480);
  const before = await page.evaluate(() => {
    const el = document.querySelector('[data-sc="count-up"]');
    const probe = document.createElement("div");
    probe.style.transitionDuration = "calc(var(--DURATION-SLOW) * 4)";
    document.body.append(probe);
    const expected = getComputedStyle(probe).transitionDuration;
    probe.remove();
    return {
      top: el.getBoundingClientRect().top,
      viewport: innerHeight,
      phase: el.dataset.count,
      shown: window.__scCount.shown(el),
      readable: window.__scCount.readable(el),
      duration: getComputedStyle(el).transitionDuration,
      expected,
    };
  });
  const zero = await intl(0);
  if (!(before.top > before.viewport)) fail.push(`harness: the first figure is not below the fold at load (top ${before.top})`);
  if (before.phase !== "waiting" || before.shown !== zero) fail.push(`below the fold: ${JSON.stringify(before)}, expected waiting on ${zero}`);
  if (before.readable !== FINAL) fail.push(`below the fold the readable text is "${before.readable}", expected the final "${FINAL}"`);
  if (before.duration !== before.expected || !(Number.parseFloat(before.duration) > 0)) fail.push(`harness: duration ${before.duration}, expected --DURATION-SLOW × 4 = ${before.expected}`);

  const run = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const el = document.querySelector('[data-sc="count-up"]');
    el.scrollIntoView({ block: "center" });
    const frames = [];
    const started = performance.now();
    let countedAt = null;
    while (performance.now() - started < 5000) {
      await frame();
      const phase = el.dataset.count;
      if (phase === "counting" && countedAt === null) countedAt = performance.now();
      frames.push({ phase, shown: window.__scCount.shown(el), readable: window.__scCount.readable(el), width: el.getBoundingClientRect().width });
      if (countedAt !== null && phase === "static") break;
    }
    return { frames, took: countedAt === null ? null : performance.now() - countedAt, end: frames.at(-1) };
  });
  const counting = run.frames.filter((f) => f.phase === "counting");
  const numbers = await page.evaluate(
    (texts) => {
      const nf = new window.Intl.NumberFormat(undefined, { signDisplay: "negative" });
      const group = nf.formatToParts(12345).find((part) => part.type === "group")?.value ?? "";
      return texts.map((t) => {
        const n = Number(t.split(group).join(""));
        return { text: t, n, exact: Number.isFinite(n) && nf.format(n) === t };
      });
    },
    counting.map((f) => f.shown),
  );
  const between = numbers.filter((x) => x.n > 0 && x.n < 12480);
  if (counting.length === 0) fail.push("scrolled into view: no frame was counting");
  if (between.length === 0) fail.push(`scrolled into view: no frame showed a number between 0 and 12480 (${numbers.map((x) => x.text).join(" ")})`);
  const unformatted = numbers.filter((x) => !x.exact);
  if (unformatted.length) fail.push(`frames not formatted as Intl formats them: ${unformatted.slice(0, 4).map((x) => x.text).join(", ")}`);
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i].n < numbers[i - 1].n) fail.push(`the count fell: ${numbers[i - 1].text} → ${numbers[i].text}`);
  }
  const misread = run.frames.filter((f) => f.readable !== FINAL);
  if (misread.length) fail.push(`${misread.length} frame(s) gave assistive tech "${misread[0].readable}", not "${FINAL}"`);
  const widths = new Set(run.frames.map((f) => Math.round(f.width * 2) / 2));
  if (widths.size !== 1) fail.push(`the figure's box changed width while counting: ${[...widths].join(", ")}`);
  const ms = Number.parseFloat(before.duration) * (before.duration.endsWith("ms") ? 1 : 1000);
  if (!(run.took >= ms / 2)) fail.push(`the count took ${run.took?.toFixed(0)}ms for a ${ms}ms duration`);
  if (run.end?.phase !== "static" || run.end?.shown !== FINAL) fail.push(`ended ${JSON.stringify(run.end)}, expected static on "${FINAL}"`);

  // The rest of the band, and the German band, once each has counted.
  const others = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const bands = [...document.querySelectorAll('[data-sc="count-up-band"]')];
    const out = [];
    for (const band of bands) {
      band.scrollIntoView({ block: "center" });
      const started = performance.now();
      while (performance.now() - started < 4000 && band.querySelector('[data-count="counting"], [data-count="waiting"]')) await frame();
      for (const el of band.querySelectorAll('[data-sc="count-up"]')) {
        out.push({
          band: band.getAttribute("aria-label"),
          lang: band.closest("[lang]")?.getAttribute("lang") ?? null,
          phase: el.dataset.count,
          shown: window.__scCount.shown(el),
          readable: window.__scCount.readable(el),
          numeric: getComputedStyle(el).fontVariantNumeric,
        });
      }
    }
    return out;
  });
  if (others.length < 8) fail.push(`harness: found ${others.length} figures across the bands, expected at least 8`);
  for (const o of others) {
    if (o.phase !== "static" || o.shown !== o.readable) fail.push(`${o.band}: ended ${o.phase} on "${o.shown}", its value is "${o.readable}"`);
    if (!o.numeric.includes("tabular-nums")) fail.push(`${o.band} "${o.readable}": font-variant-numeric ${o.numeric}`);
  }
  const percent = await page.evaluate(() => new window.Intl.NumberFormat(undefined, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0.9995));
  if (!others.some((o) => o.band === "This year" && o.shown === percent)) fail.push(`the uptime figure does not end on "${percent}": ${JSON.stringify(others.filter((o) => o.band === "This year"))}`);
  if (!others.some((o) => o.band === "Dieses Jahr" && o.shown === "12.480")) fail.push(`the German band does not end on "12.480": ${JSON.stringify(others.filter((o) => o.band === "Dieses Jahr"))}`);
  if (!others.some((o) => o.band === "Edge cases" && o.shown === "—" && o.phase === "static")) fail.push("the missing figure is not the dash");

  await load({ reduced: true });
  await install();
  const reduced = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const el = document.querySelector('[data-sc="count-up"]');
    const first = { top: el.getBoundingClientRect().top, viewport: innerHeight, phase: el.dataset.count, shown: window.__scCount.shown(el) };
    el.scrollIntoView({ block: "center" });
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      await frame();
      seen.add(`${el.dataset.count}:${window.__scCount.shown(el)}`);
    }
    return { first, seen: [...seen] };
  });
  if (!(reduced.first.top > reduced.first.viewport)) fail.push(`reduced motion harness: the figure is not below the fold (top ${reduced.first.top})`);
  if (reduced.first.phase !== "static" || reduced.first.shown !== FINAL) fail.push(`reduced motion: below the fold ${JSON.stringify(reduced.first)}, expected static on "${FINAL}"`);
  if (reduced.seen.length !== 1 || reduced.seen[0] !== `static:${FINAL}`) fail.push(`reduced motion: after scrolling to it the figure showed ${reduced.seen.join(" | ")}`);

  stopErrors();
  if (errors.length) fail.push(...errors);
  const result = { before, frames: run.frames.length, took: run.took, end: run.end, others: others.length, reduced };
  if (fail.length) throw new Error(`motion-extras-count-up FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `motion-extras-count-up OK waits on ${zero}, counts through ${between.length} formatted frames in ${run.took.toFixed(0)}ms to "${FINAL}" with the final value readable throughout and a fixed width; ${others.length} figures end exact (German, percent, dash); reduced motion shows the value at once`;
}
