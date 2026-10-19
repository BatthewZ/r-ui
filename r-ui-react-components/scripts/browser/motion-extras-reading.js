// @covers   motion/ReadingProgress
// @sections motion-readingprogress
// @tier     component
//
// Browser check: ReadingProgress fills with the reader's position through its region, on a
// view timeline, sticks to its scrollport's top, takes no space or pointer, and never prints.
//
// jsdom has no layout, no scrolling and no scroll timelines.
//
// Run it through `bun run browser:check motion-extras-reading`.
//
// On the ReadingProgress section (`#motion-readingprogress`), opened alone: the LTR demo's
// scroller (`[data-sc="reading-scroller"]`, first) and its article, then the RTL compact one:
//   1. harness: the fill runs `r-motion-reading-fill`; the bar is `--R-SIZE-6` tall (a probe)
//      and `aria-hidden`; the scroller scrolls (its range is over 200px);
//   2. at 0, a quarter, half, three quarters and all of the scroller's range the fill's drawn
//      share (its width over the bar's) and its computed `scale` equal the share predicted
//      from geometry (the article's top against the scroller's top, its bottom against the
//      scroller's bottom: the `contain` range), ±0.02; 0 at the start, 1 at the end, rising;
//   3. scrolled, the bar sits on the scroller's top edge (±1px), the article's heading starts
//      where the bar does (it takes no space), and a press at the bar's middle hit-tests to
//      the article's content, never the bar;
//   4. RTL compact at half its range: the fill hangs from the bar's right edge (±1px), and the
//      bar is thinner than the comfortable LTR one (the compact `--R-SIZE-6`);
//   5. reduced motion keeps it: the same share at half the range (a position, not motion);
//   6. forced colours: the fill paints a colour that is not transparent and not the canvas;
//   7. print (emulated): the bar is not displayed;
//   8. no console or page error. (Nothing scrolling sideways at 375 is sweep-overview's sweep.)
//
// Suggested break: set `animation-range` to `cover` on `.r-motion-reading-fill` (2 fails:
// the bar is already part full at the top), or drop `data-print="hide"` from the bar (7).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async ({ width = 1280, reduced = false, view = {} } = {}) => {
    await openSection(page, "motion-readingprogress", { view: { theme: "default", density: "comfortable", input: "fine", ...view }, width, reduced });
    await page.locator('[data-sc="reading-scroller"]').first().scrollIntoViewIfNeeded();
  };

  /** Scrolls demo `index` to `frac` of its range and reads the bar two frames on. */
  const at = (index, frac) =>
    page.evaluate(
      async ([i, f]) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const scroller = document.querySelectorAll('[data-sc="reading-scroller"]')[i];
        const article = scroller.querySelector('[data-sc="reading-article"]');
        const bar = article.querySelector(".r-motion-reading-bar");
        const fill = bar.firstElementChild;
        const range = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = Math.round(range * f);
        await frame();
        await frame();
        const s = scroller.getBoundingClientRect();
        const portTop = s.top + scroller.clientTop;
        const port = { top: portTop, bottom: portTop + scroller.clientHeight };
        const a = article.getBoundingClientRect();
        const toTop = a.top - port.top;
        const toBottom = a.bottom - port.bottom;
        const start = Math.min(toTop, toBottom);
        const end = Math.max(toTop, toBottom);
        const expected = end === start ? (start <= 0 ? 1 : 0) : Math.min(1, Math.max(0, -start / (end - start)));
        const b = bar.getBoundingClientRect();
        const fr = fill.getBoundingClientRect();
        const heading = article.querySelector("h3").getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return {
          range,
          expected,
          drawn: b.width ? fr.width / b.width : null,
          scale: Number.parseFloat(getComputedStyle(fill).scale.split(" ")[0]),
          barTop: b.top,
          barHeight: b.height,
          portTop: port.top,
          headingTop: heading.top,
          articleTop: a.top,
          fillLeft: fr.left,
          fillRight: fr.right,
          barLeft: b.left,
          barRight: b.right,
          hitBar: bar.contains(hit),
          hitArticle: article.contains(hit),
        };
      },
      [index, frac],
    );

  await load();
  const harness = await page.evaluate(() => {
    const scroller = document.querySelector('[data-sc="reading-scroller"]');
    const bar = scroller.querySelector(".r-motion-reading-bar");
    const probe = document.createElement("div");
    probe.style.blockSize = "var(--R-SIZE-6)";
    scroller.parentElement.append(probe);
    const size6 = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      animation: getComputedStyle(bar.firstElementChild).animationName,
      barHeight: bar.getBoundingClientRect().height,
      size6,
      hidden: bar.getAttribute("aria-hidden"),
      range: scroller.scrollHeight - scroller.clientHeight,
    };
  });
  if (harness.animation !== "r-motion-reading-fill") fail.push(`harness: the fill runs ${harness.animation}`);
  if (!(harness.size6 > 0) || Math.abs(harness.barHeight - harness.size6) > 0.5) fail.push(`the bar is ${harness.barHeight}px, --R-SIZE-6 is ${harness.size6}px`);
  if (harness.hidden !== "true") fail.push("the bar is not aria-hidden");
  if (!(harness.range > 200)) fail.push(`harness: the demo scroller's range is ${harness.range}px`);

  const samples = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1]) samples.push({ f, ...(await at(0, f)) });
  for (const s of samples) {
    if (Math.abs(s.drawn - s.expected) > 0.02 || Math.abs(s.scale - s.expected) > 0.02) fail.push(`at ${s.f} of the range: drawn ${s.drawn?.toFixed(3)}, scale ${s.scale}, expected ${s.expected.toFixed(3)}`);
  }
  // Within a pixel's share: scrollTop is whole pixels, the article's edges are not.
  if (Math.abs(samples[0].expected) > 0.005 || Math.abs(samples.at(-1).expected - 1) > 0.005) fail.push(`harness: predicted ${samples[0].expected} at the start and ${samples.at(-1).expected} at the end, expected 0 and 1`);
  for (let i = 1; i < samples.length; i++) if (!(samples[i].drawn > samples[i - 1].drawn)) fail.push(`the fill does not rise: ${samples.map((s) => s.drawn?.toFixed(2)).join(" → ")}`);
  const mid = samples[2];
  if (Math.abs(mid.barTop - mid.portTop) > 1) fail.push(`scrolled, the bar sits at ${mid.barTop}, the scroller's top is ${mid.portTop}`);
  if (Math.abs(samples[0].headingTop - samples[0].barTop) > 1) fail.push(`the bar takes space: heading at ${samples[0].headingTop}, bar at ${samples[0].barTop}`);
  if (mid.hitBar || !mid.hitArticle) fail.push(`a press on the bar hit ${JSON.stringify({ bar: mid.hitBar, article: mid.hitArticle })}`);
  if (Math.abs(mid.fillLeft - mid.barLeft) > 1) fail.push(`LTR: the fill starts at ${mid.fillLeft}, the bar at ${mid.barLeft}`);

  await page.locator('[data-sc="reading-scroller"]').nth(1).scrollIntoViewIfNeeded();
  const rtl = await at(1, 0.5);
  if (Math.abs(rtl.fillRight - rtl.barRight) > 1) fail.push(`RTL: the fill ends at ${rtl.fillRight}, the bar at ${rtl.barRight} (it should hang from the right)`);
  if (Math.abs(rtl.drawn - rtl.expected) > 0.02) fail.push(`RTL: drawn ${rtl.drawn}, expected ${rtl.expected}`);
  if (!(rtl.barHeight < harness.barHeight)) fail.push(`compact: the bar is ${rtl.barHeight}px, not thinner than ${harness.barHeight}px`);

  await load({ reduced: true });
  const still = await at(0, 0.5);
  if (Math.abs(still.drawn - still.expected) > 0.02) fail.push(`reduced motion: drawn ${still.drawn}, expected ${still.expected}`);

  await setView(page, { forced: true });
  const forced = await page.evaluate(() => {
    const fill = document.querySelector('[data-sc="reading-scroller"] .r-motion-reading-fill');
    return { fill: getComputedStyle(fill).backgroundColor, canvas: getComputedStyle(document.body).backgroundColor };
  });
  await setView(page, { forced: false });
  if (/rgba\(.*, 0\)$|transparent/.test(forced.fill) || forced.fill === forced.canvas) fail.push(`forced colours: the fill paints ${forced.fill} on ${forced.canvas}`);

  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => [...document.querySelectorAll(".r-motion-reading-bar")].map((b) => getComputedStyle(b).display));
  await page.emulateMedia({ media: "screen" });
  if (printed.length < 2 || printed.some((d) => d !== "none")) fail.push(`print: the bars display ${printed.join(", ")}`);

  stopErrors();
  if (errors.length) fail.push(...errors);
  const result = { harness, samples: samples.map((s) => [s.f, Number(s.drawn?.toFixed(3)), Number(s.expected.toFixed(3))]), rtl, forced, printed };
  if (fail.length) throw new Error(`motion-extras-reading FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `motion-extras-reading OK the fill tracks the read share (${result.samples.map(([f, d]) => `${f}:${d}`).join(" ")}), sticks to the scroller's top taking no space or press, hangs from the right in RTL, keeps tracking under reduced motion, stays Highlight under forced colours and never prints`;
}
