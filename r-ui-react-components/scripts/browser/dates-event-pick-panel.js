// @covers   dates/EventCalendar, overlays/Popover
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: an app's own surface for a picked range (EventCalendar's
// `renderSelection`), as the showcase's editable demo uses it: a Popover at the pick through
// its `anchor`. jsdom cannot place anything; this says where it lands and that it follows.
//
// On `[data-sc="event-calendar-edit"]` (week of Sunday 11 October 2026), it asserts:
//   1. harness: the demo's slot layer is there and nothing is picked;
//   2. a real mouse drag from Thursday 10:00 to the 11:30 slot opens the booking panel in the
//      top layer (`:popover-open`), beside the picked range's piece (its inline start at the
//      piece's inline end, or its inline end at the piece's start when it flips; their
//      block extents overlapping), with focus in its title field;
//   3. scrolling the time grid by 80px moves the panel with the range (its top by -80 ±2px);
//   4. typing a title and Enter adds the booking: the demo's state says so, a block of that
//      title is drawn at Thursday 10:00, and the panel and the pick are gone;
//   5. a keyboard pick (the slot cursor: Shift+ArrowDown, Enter) opens it too, focus inside;
//      Escape closes it, clears the pick, and focus is back on the slots;
//   6. at 375 a pick's panel stays inside the viewport.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|slot|popover/i.test(text) });
  const ROOT = '[data-sc="event-calendar-edit"]';
  const REGION = `${ROOT} [data-timegrid]`;
  const LAYER = `${ROOT} [data-slots]`;
  const PANEL = '[data-sc="event-calendar-edit-panel"]';
  const OUT = '[data-sc="event-calendar-edit-state"]';
  const view = { theme: "default", density: "comfortable", input: "fine" };

  const state = () => page.evaluate((OUT) => document.querySelector(OUT)?.textContent ?? "", OUT);
  const cellBox = (iso, minute) =>
    page.evaluate(
      ({ LAYER, iso, minute }) => {
        const r = document.querySelector(`${LAYER} [data-slot-day="${iso}"][data-slot-minute="${minute}"]`)?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      },
      { LAYER, iso, minute },
    );
  /** The panel and the picked range's last piece, as laid out now. */
  const layout = () =>
    page.evaluate(
      ({ ROOT, PANEL }) => {
        const panel = document.querySelector(PANEL);
        const pieces = document.querySelectorAll(`${ROOT} [data-selection-piece]`);
        const piece = pieces[pieces.length - 1];
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        return {
          panel: panel ? box(panel) : null,
          open: Boolean(panel?.matches(":popover-open")),
          piece: piece ? box(piece) : null,
          focusInPanel: Boolean(panel?.contains(document.activeElement)),
          focusOnSlots: document.activeElement === document.querySelector(`${ROOT} [data-slots]`),
          viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
        };
      },
      { ROOT, PANEL },
    );
  const waitOpen = () => page.waitForFunction((PANEL) => document.querySelector(PANEL)?.matches(":popover-open"), PANEL, { timeout: 3000 }).catch(() => {});
  const waitClosed = () => page.waitForFunction((PANEL) => !document.querySelector(PANEL), PANEL, { timeout: 3000 }).catch(() => {});
  /** The region scrolled so 09:00 is under its header, and the demo high on the page. */
  const placeDemo = () =>
    page.evaluate(
      ({ ROOT, REGION, LAYER }) => {
        const root = document.querySelector(ROOT);
        root.scrollIntoView({ block: "start" });
        let scroller = root.parentElement;
        while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
        (scroller ?? document.scrollingElement).scrollTop += root.getBoundingClientRect().top - 120;
        const region = document.querySelector(REGION);
        const head = region.querySelector("[data-timegrid-head]").getBoundingClientRect();
        region.scrollTop += document.querySelector(`${LAYER} [data-slot-minute="540"]`).getBoundingClientRect().top - head.bottom;
      },
      { ROOT, REGION, LAYER },
    );

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, height: 1100, view });
    await page.locator(LAYER).waitFor();
    await placeDemo();
    if (!(await state()).includes("selection: none")) problems.push(`harness: the demo starts with "${await state()}"`);

    // ── 2. a drag opens the panel beside the pick, focus in it ──────────────
    const from = await cellBox("2026-10-15", 600);
    const to = await cellBox("2026-10-15", 690);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 6, { steps: 2 });
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await waitOpen();
    await settle(page);
    let l = await layout();
    if (!l.open || !l.panel) problems.push("drag: the booking panel did not open in the top layer");
    else if (!l.piece) problems.push("drag: harness: no piece of the picked range is drawn");
    else {
      const besideEnd = Math.abs(l.panel.left - l.piece.right) <= 12;
      const besideStart = Math.abs(l.panel.right - l.piece.left) <= 12;
      const overlapsBlock = l.panel.top < l.piece.bottom && l.panel.bottom > l.piece.top;
      if (!(besideEnd || besideStart) || !overlapsBlock) {
        problems.push(`drag: the panel ${JSON.stringify(l.panel)} is not beside the picked range ${JSON.stringify(l.piece)}`);
      }
      if (!l.focusInPanel) problems.push("drag: focus is not in the panel");
      summary.beside = besideEnd ? "end" : "start";
    }

    // ── 3. it follows the range when the grid scrolls ───────────────────────
    if (l.panel) {
      const before = l.panel.top;
      await page.evaluate((REGION) => (document.querySelector(REGION).scrollTop += 80), REGION);
      await settle(page);
      l = await layout();
      if (!l.panel || Math.abs(l.panel.top - (before - 80)) > 2) problems.push(`scroll: the panel's top went from ${before} to ${l.panel?.top}, expected ${before - 80} (±2px)`);
      await page.evaluate((REGION) => (document.querySelector(REGION).scrollTop -= 80), REGION);
      await settle(page);
    }

    // ── 4. a title and Enter add the booking ────────────────────────────────
    await page.keyboard.type("Retro");
    await page.keyboard.press("Enter");
    await waitClosed();
    const afterAdd = await state();
    if (!afterAdd.includes("selection: none") || !/last: add new-\d+/.test(afterAdd)) problems.push(`add: the demo prints "${afterAdd}", expected the booking added and no pick`);
    const retro = await page.evaluate(
      (ROOT) => [...document.querySelectorAll(`${ROOT} [data-block]`)].map((b) => b.dataset.block).find((id) => /^2026-10-15\|new-/.test(id ?? "")),
      ROOT,
    );
    const retroName = retro ? await page.evaluate(({ ROOT, retro }) => document.querySelector(`${ROOT} [data-block="${retro}"]`)?.getAttribute("aria-label") ?? "", { ROOT, retro }) : "";
    if (!/^Retro, /.test(retroName)) problems.push(`add: no "Retro" block on Thursday (found ${retro ?? "none"}: "${retroName}")`);

    // ── 5. a keyboard pick opens it too; Escape closes and clears ───────────
    await page.evaluate((LAYER) => document.querySelector(LAYER).focus({ preventScroll: true }), LAYER);
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Enter");
    await waitOpen();
    l = await layout();
    if (!l.open || !l.focusInPanel) problems.push(`keys: after a keyboard pick the panel is ${l.open ? "open" : "closed"}, focus ${l.focusInPanel ? "in" : "not in"} it`);
    await page.keyboard.press("Escape");
    await waitClosed();
    l = await layout();
    if (!(await state()).includes("selection: none")) problems.push(`keys: Escape left "${await state()}"`);
    if (!l.focusOnSlots) problems.push("keys: after Escape focus is not back on the slots");

    // ── 6. at 375 the panel stays inside the viewport ───────────────────────
    await setView(page, { width: 375 });
    await placeDemo();
    const narrow = await cellBox("2026-10-11", 600);
    if (!narrow) problems.push("375: harness: no Sunday 10:00 slot");
    else {
      await page.mouse.click(narrow.x, narrow.y);
      await waitOpen();
      await settle(page);
      l = await layout();
      if (!l.panel) problems.push("375: the panel did not open");
      else if (l.panel.left < -0.5 || l.panel.right > l.viewport.width + 0.5) problems.push(`375: the panel spans ${l.panel.left}–${l.panel.right}px of a ${l.viewport.width}px viewport`);
      await page.keyboard.press("Escape");
      await waitClosed();
    }

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
  }

  if (problems.length) throw new Error(`dates-event-pick-panel FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-pick-panel OK (${JSON.stringify(summary)})`;
}
