// Browser check: ScrollReveal plays when content scrolls into view, and never
// hides anything under reduced motion.
//
// jsdom has no layout and no IntersectionObserver; the reveal is a question of
// real scrolling and painted opacity.
//
// Asserts, on the Overview's ScrollReveal demo cards (`[data-sc="reveal-card"]`),
// with the page loaded at its top so they start far below the fold:
//   1. harness: the first card is below the viewport, `data-reveal="hidden"`,
//      and paints at opacity 0 (the contract's `.scroll-reveal-hidden`);
//   2. scrolled into view, it switches to `revealed` and fades in: some frame
//      has an opacity strictly between 0 and 1, and it settles at 1;
//   3. scrolled away and back, it stays revealed (once by default);
//   4. with reduced motion emulated and the page reloaded at the top, the same
//      card (still below the fold) is `static` and paints at opacity 1.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  await page.setViewportSize({ width: 1280, height: 900 });

  const loadTop = async () => {
    await page.goto(`${base}#/overview`);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-sc="reveal-card"]').first().waitFor({ state: "attached" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
  };
  const read = () =>
    page.evaluate(() => {
      const card = document.querySelector('[data-sc="reveal-card"]');
      return {
        state: card.dataset.reveal,
        opacity: Number(getComputedStyle(card).opacity),
        top: Math.round(card.getBoundingClientRect().top),
        viewport: window.innerHeight,
      };
    });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await loadTop();
  const before = await read();
  if (!(before.top > before.viewport)) fail.push(`harness: the card is not below the fold at load (top ${before.top})`);
  if (before.state !== "hidden" || before.opacity !== 0) fail.push(`harness: below the fold ${JSON.stringify(before)}, expected hidden at opacity 0`);

  const reveal = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const card = document.querySelector('[data-sc="reveal-card"]');
    card.scrollIntoView({ block: "center" });
    const seen = [];
    const started = performance.now();
    while (performance.now() - started < 1000) {
      await frame();
      seen.push(Number(getComputedStyle(card).opacity));
      if (card.dataset.reveal === "revealed" && seen.at(-1) === 1) break;
    }
    return { state: card.dataset.reveal, fading: seen.filter((o) => o > 0.01 && o < 0.99), end: seen.at(-1) };
  });
  if (reveal.state !== "revealed") fail.push(`scrolled into view: state ${reveal.state}, expected revealed`);
  if (reveal.fading.length === 0) fail.push("scrolled into view: no frame between opacity 0 and 1 (no entrance)");
  if (reveal.end !== 1) fail.push(`scrolled into view: settled at opacity ${reveal.end}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-sc="reveal-card"]').scrollIntoView({ block: "center" }));
  await page.waitForTimeout(150);
  const again = await read();
  if (again.state !== "revealed" || again.opacity !== 1) fail.push(`scrolled away and back: ${JSON.stringify(again)}, expected to stay revealed`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadTop();
  const reduced = await read();
  await page.emulateMedia({ reducedMotion: null });
  if (!(reduced.top > reduced.viewport)) fail.push(`reduced motion harness: the card is not below the fold (top ${reduced.top})`);
  if (reduced.state !== "static" || reduced.opacity !== 1) fail.push(`reduced motion: below the fold ${JSON.stringify(reduced)}, expected static at opacity 1`);

  const result = { before, reveal, again, reduced };
  if (fail.length) throw new Error(`motion-scroll-reveal FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `motion-scroll-reveal OK hidden below the fold, fades ${reveal.fading.map((o) => o.toFixed(2)).join(" ")} on arrival, stays revealed; reduced motion shows it at once`;
}
