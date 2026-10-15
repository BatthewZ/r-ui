// Browser check: Accordion rows, keyboard and the height animation, for real.
//
// jsdom has no layout, no CSS transitions and no focus-visible styling, so the
// panel's height and the row sizes are only measurable here.
//
// Asserts, on the Overview's Accordion demos:
//   1. harness: in the first demo the open panel ("Which alerts…") is as tall as
//      its content, and a closed one is 0px tall with its content
//      `visibility: hidden` (the grid track is 0fr in the source);
//   2. rows: a one-line trigger is exactly the `--ROW-H` it reads, at
//      comfortable, in the compact demo (a smaller `--ROW-H`) and at coarse
//      input (where `--ROW-H` is raised to `--HIT-MIN`), so rows follow density
//      and never fall under the hit floor;
//   3. keyboard (real key presses): ArrowDown moves to the next header, End to
//      the last ENABLED one, then ArrowDown crosses the disabled last header and
//      wraps to the first, ArrowUp crosses it back to the last enabled one (harness:
//      the demo's last header is disabled, so each of these can fail), Home goes
//      back to the first, and Enter on a closed header opens it;
//   4. opening animates: two frames after the state flips the panel is taller
//      than 0 and shorter than its content; it settles at the content's height, and
//      closing runs the other way and ends at 0 with the content hidden;
//   5. with reduced motion emulated, the panel is at its full height two frames
//      after the press.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${base}#/overview/disclosure-accordion`);
  await page.reload();
  await waitForShowcase(page);
  const demo = page.locator('[data-sc="accordion-single"]');
  await demo.waitFor();
  await demo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const QUESTIONS = {
    alerts: "Which alerts page someone?",
    export: "Can we export the timeline?",
    retention: "How long are incidents kept?",
  };

  // Height of the panel controlled by a header, and of its content.
  const measure = (scope, title) =>
    page.evaluate(
      ({ scope, title }) => {
        const root = document.querySelector(scope);
        const trigger = [...root.querySelectorAll("button[aria-controls]")].find((b) => b.textContent.trim() === title);
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        const clip = panel.firstElementChild;
        return {
          expanded: trigger.getAttribute("aria-expanded"),
          height: panel.getBoundingClientRect().height,
          content: clip.firstElementChild.getBoundingClientRect().height,
          visibility: getComputedStyle(clip).visibility,
        };
      },
      { scope, title }
    );

  const first = '[data-sc="accordion-single"]';
  const open = await measure(first, QUESTIONS.alerts);
  const closed = await measure(first, QUESTIONS.export);
  if (open.expanded !== "true" || open.content < 10 || Math.abs(open.height - open.content) > 0.5)
    fail.push(`harness: open panel ${JSON.stringify(open)}, expected its content's height`);
  if (closed.expanded !== "false" || closed.height !== 0 || closed.visibility !== "hidden")
    fail.push(`harness: closed panel ${JSON.stringify(closed)}, expected 0px and hidden`);

  // 2. Rows.
  const rowFit = (scope) =>
    page.evaluate((scope) => {
      const trigger = [...document.querySelectorAll(`${scope} button[aria-controls]`)].find(
        (b) => b.textContent.trim() === "Can we export the timeline?"
      );
      const cs = getComputedStyle(trigger);
      return {
        height: trigger.getBoundingClientRect().height,
        rowH: Number.parseFloat(cs.getPropertyValue("--ROW-H")),
      };
    }, scope);
  const comfortable = await rowFit(first);
  const compact = await rowFit('[data-density="compact"]:has(> [data-accordion])');
  await page.evaluate(() => (document.documentElement.dataset.input = "coarse"));
  await page.waitForTimeout(50);
  const coarse = await rowFit(first);
  await page.evaluate(() => delete document.documentElement.dataset.input);
  for (const [label, m] of Object.entries({ comfortable, compact, coarse })) {
    if (!(m.rowH > 0) || Math.abs(m.height - m.rowH) > 0.5) fail.push(`rows: ${label} trigger is ${m.height}px, its --ROW-H is ${m.rowH}px`);
  }
  if (!(compact.rowH < comfortable.rowH)) fail.push(`rows: compact --ROW-H ${compact.rowH} is not below comfortable ${comfortable.rowH}`);
  if (!(coarse.height >= 44)) fail.push(`rows: at coarse input the trigger is ${coarse.height}px, under the 44px floor`);

  // 3. Keyboard, with real key presses. Harness: the demo's LAST header is the disabled one.
  const order = await page.evaluate(
    (scope) => [...document.querySelectorAll(`${scope} button[aria-controls]`)].map((b) => ({ title: b.textContent.trim(), disabled: b.disabled })),
    first,
  );
  const lastHeader = order[order.length - 1];
  if (order.length < 3 || lastHeader?.title !== QUESTIONS.retention || !lastHeader.disabled || order.slice(0, -1).some((h) => h.disabled)) {
    fail.push(`harness: headers ${JSON.stringify(order)}, expected enabled ones then "${QUESTIONS.retention}" disabled last`);
  }
  const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  await page.locator(first).getByRole("button", { name: QUESTIONS.alerts }).focus();
  const keys = [];
  for (const [key, want] of [
    ["ArrowDown", "How is an incident routed"],
    ["End", QUESTIONS.export],
    // Crossing the disabled last header, both ways.
    ["ArrowDown", QUESTIONS.alerts],
    ["ArrowUp", QUESTIONS.export],
    ["Home", QUESTIONS.alerts],
  ]) {
    await page.keyboard.press(key);
    const now = await focused();
    keys.push(`${key}→${now.slice(0, 24)}`);
    if (!now.startsWith(want)) fail.push(`keyboard: ${keys.join(", ")}: ${key} landed on "${now}", expected "${want}"`);
  }

  // 4. The height animates, both ways. Enter on the focused (closed) last header.
  const animate = () =>
    page.evaluate(
      async ({ scope, title }) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const trigger = [...document.querySelectorAll(`${scope} button[aria-controls]`)].find((b) => b.textContent.trim() === title);
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        const content = () => panel.firstElementChild.firstElementChild.getBoundingClientRect().height;
        const was = trigger.getAttribute("aria-expanded");
        trigger.click();
        // Count frames from the commit, not the click.
        const clicked = performance.now();
        while (trigger.getAttribute("aria-expanded") === was && performance.now() - clicked < 1000) await frame();
        await frame();
        await frame();
        const mid = panel.getBoundingClientRect().height;
        const started = performance.now();
        let last = -1;
        // Settled: two frames at the same height.
        for (;;) {
          await frame();
          const h = panel.getBoundingClientRect().height;
          if (h === last || performance.now() - started > 1000) break;
          last = h;
        }
        return {
          expanded: trigger.getAttribute("aria-expanded"),
          mid,
          end: panel.getBoundingClientRect().height,
          content: content(),
          visibility: getComputedStyle(panel.firstElementChild).visibility,
        };
      },
      { scope: first, title: QUESTIONS.export }
    );
  await page.locator(first).getByRole("button", { name: QUESTIONS.export }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const enterOpened = await measure(first, QUESTIONS.export);
  if (enterOpened.expanded !== "true") fail.push("keyboard: Enter did not open the focused header");
  // Close it again through the animation (the same press closes it: collapsible).
  const shut = await animate();
  const opening = await animate();
  if (shut.expanded !== "false" || !(shut.mid > 0 && shut.mid < shut.content)) fail.push(`close: two frames in, height ${shut.mid} of ${shut.content} (expected strictly between)`);
  if (shut.end !== 0 || shut.visibility !== "hidden") fail.push(`close: settled at ${shut.end}px, ${shut.visibility}`);
  if (opening.expanded !== "true" || !(opening.mid > 0 && opening.mid < opening.content)) fail.push(`open: two frames in, height ${opening.mid} of ${opening.content} (expected strictly between)`);
  if (Math.abs(opening.end - opening.content) > 0.5 || opening.visibility !== "visible") fail.push(`open: settled at ${opening.end}px of ${opening.content}, ${opening.visibility}`);

  // 5. Reduced motion: full height two frames after the press.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedShut = await animate();
  const reducedOpen = await animate();
  await page.emulateMedia({ reducedMotion: null });
  if (reducedShut.mid !== 0) fail.push(`reduced motion: closing panel still ${reducedShut.mid}px two frames in`);
  if (Math.abs(reducedOpen.mid - reducedOpen.content) > 0.5) fail.push(`reduced motion: opening panel ${reducedOpen.mid}px of ${reducedOpen.content} two frames in`);

  const result = { comfortable, compact, coarse, shut, opening, reducedOpen };
  if (fail.length) throw new Error(`disclosure-accordion FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `disclosure-accordion OK rows ${comfortable.height}/${compact.height}/${coarse.height}px (comfortable/compact/coarse); height ${shut.mid.toFixed(0)}→0 and ${opening.mid.toFixed(0)}→${opening.end}px two frames in; reduced motion instant`;
}
