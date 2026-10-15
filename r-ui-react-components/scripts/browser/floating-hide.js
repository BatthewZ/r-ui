// Browser check: an anchored panel hides while its trigger is scrolled out of
// view, instead of following it to the viewport edge, and comes back with it.
//
// jsdom has no layout, so the hook's test can only fake the geometry; this is the
// real thing. A top-layer panel is `position: fixed`, so without `hide()` floating-ui
// keeps re-positioning it after the trigger and `shift()` pins it to the edge.
//
// Asserts, on the Popover demo (placement top, with an arrow):
//   1. harness: open, the panel is visible and sits above its trigger (its bottom
//      within 1px of trigger top minus the 8px offset);
//   2. the page scrolled until the trigger is above the viewport: the panel carries
//      `data-reference-hidden` and computes `visibility: hidden`, and it is still
//      open (mounted), so state and focus bookkeeping survive;
//   3. scrolled back: visible again, re-anchored to the trigger as in 1.
async (page) => {
  const base = page.url().split("#")[0];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/overlays-popover`);
  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  await page.reload();
  const section = page.locator("#overlays-popover");
  const trigger = section.getByRole("button", { name: "With arrow" });
  await trigger.waitFor();
  await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "About" });
  await panel.waitFor();
  await page.waitForTimeout(250);

  const read = () =>
    page.evaluate(() => {
      const t = [...document.querySelectorAll("#overlays-popover button")].find((b) => b.textContent.trim() === "With arrow");
      const p = document.querySelector('[role="dialog"][aria-label="About"]');
      if (!t || !p) return { mounted: Boolean(p) };
      const tr = t.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return {
        mounted: true,
        visibility: getComputedStyle(p).visibility,
        flagged: p.hasAttribute("data-reference-hidden"),
        triggerTop: tr.top,
        triggerBottom: tr.bottom,
        gap: tr.top - pr.bottom,
      };
    });
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const fail = [];
  const open = await read();
  if (open.visibility !== "visible" || open.flagged) fail.push(`harness: open panel is not visible (${JSON.stringify(open)})`);
  if (Math.abs(open.gap - 8) > 1) fail.push(`harness: open panel is ${open.gap}px above its trigger, expected 8px`);

  await page.evaluate((by) => window.scrollBy(0, by), open.triggerBottom + 100);
  await settle();
  await page.waitForTimeout(100);
  const away = await read();
  if (!away.mounted) fail.push("scrolled away: the panel unmounted (it should only hide)");
  if (!(away.triggerBottom < 0)) fail.push(`scrolled away: the trigger is still in view (bottom ${away.triggerBottom})`);
  if (away.visibility !== "hidden" || !away.flagged) fail.push(`scrolled away: panel not hidden (${JSON.stringify(away)})`);

  await page.evaluate((by) => window.scrollBy(0, -by), open.triggerBottom + 100);
  await settle();
  await page.waitForTimeout(100);
  const back = await read();
  if (back.visibility !== "visible" || back.flagged) fail.push(`scrolled back: panel not visible (${JSON.stringify(back)})`);
  if (Math.abs(back.gap - 8) > 1) fail.push(`scrolled back: panel is ${back.gap}px above its trigger, expected 8px`);

  await page.keyboard.press("Escape");
  const result = { open, away, back };
  if (fail.length) throw new Error(`floating-hide FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `floating-hide OK ${JSON.stringify(result)}`;
}
