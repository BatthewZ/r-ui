// @covers   dates/EventCalendar, overlays/Popover
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: an app's own surface for an opened event (EventCalendar's
// `renderEventDetails`), as the showcase's main demo uses it: a Popover at the event through
// its `anchor`, showing what the app keeps beside the calendar's fields (an owner, a runbook,
// attachments). jsdom cannot place anything; this says where it lands and that it follows.
//
// On `[data-sc="event-calendar-main"]` (October 2026, today Thursday 15), it asserts:
//   1. harness: the month is drawn with chips (1280) and no details are open;
//   2. a press on the maintenance bar (6–8 October) opens the details in the top layer,
//      beside the bar (inline start at its inline end, or inline end at its start when it
//      flips; their block extents overlapping), holding the app's own fields: its owner, two
//      attachment links and a runbook link, focus inside; the demo's state says it opened;
//   3. Escape closes them and hands focus back to the bar;
//   4. in the week view, the Incident review block's details follow the grid's scrolling
//      (their top moves with the block, ±2px). (That a page change closes them is the unit
//      tests': here any press outside the popover closes it first, so paging cannot tell.)
//   5. at 375 (dots, no chips) an event opened from the day panel gets its details inside the
//      viewport.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|popover|details/i.test(text) });
  const ROOT = '[data-sc="event-calendar-main"]';
  const DETAILS = '[data-sc="event-calendar-details"]';
  const view = { theme: "default", density: "comfortable", input: "fine" };

  const state = () => page.evaluate((ROOT) => document.querySelector(`${ROOT} [data-sc="event-calendar-state"]`)?.textContent ?? "", ROOT);
  const waitOpen = () => page.waitForFunction((D) => document.querySelector(D)?.matches(":popover-open"), DETAILS, { timeout: 3000 }).catch(() => {});
  const waitClosed = () => page.waitForFunction((D) => !document.querySelector(D), DETAILS, { timeout: 3000 }).catch(() => {});
  /** The details and the drawn element of event `key` they should sit beside, as laid out now. */
  const layout = (key) =>
    page.evaluate(
      ({ ROOT, DETAILS, key }) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
        };
        const panel = document.querySelector(DETAILS);
        const event = [...document.querySelectorAll(`${ROOT} [data-event="${key}"]`)].find((el) => el.getBoundingClientRect().width > 0);
        return {
          open: Boolean(panel?.matches(":popover-open")),
          panel: panel ? box(panel) : null,
          event: event ? box(event) : null,
          text: panel?.textContent ?? "",
          links: panel ? [...panel.querySelectorAll("a[href]")].map((a) => ({ name: a.textContent.trim(), href: a.getAttribute("href") })) : [],
          focusInside: Boolean(panel?.contains(document.activeElement)),
          focusOn: document.activeElement?.dataset?.event ?? null,
          viewport: document.documentElement.clientWidth,
        };
      },
      { ROOT, DETAILS, key },
    );
  const beside = (l) => {
    if (!l.panel || !l.event) return false;
    const touching = Math.abs(l.panel.left - l.event.right) <= 12 || Math.abs(l.panel.right - l.event.left) <= 12;
    return touching && l.panel.top < l.event.bottom && l.panel.bottom > l.event.top;
  };
  const placeDemo = () =>
    page.evaluate((ROOT) => {
      const root = document.querySelector(ROOT);
      root.scrollIntoView({ block: "start" });
      let scroller = root.parentElement;
      while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
      (scroller ?? document.scrollingElement).scrollTop += root.getBoundingClientRect().top - 120;
    }, ROOT);

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, height: 1000, view });
    await page.locator(`${ROOT} [role="grid"]`).waitFor();
    await placeDemo();
    const chips = await page.evaluate((ROOT) => [...document.querySelectorAll(`${ROOT} .r-dates-month-chip`)].filter((c) => c.getBoundingClientRect().width > 0).length, ROOT);
    if (chips === 0) problems.push("harness: the month at 1280 draws no chips");
    if (await page.evaluate((D) => Boolean(document.querySelector(D)), DETAILS)) problems.push("harness: details are open before anything was pressed");

    // ── 2. the maintenance bar opens its details beside it ──────────────────
    const bar = page.locator(`${ROOT} .r-dates-month-chip[data-event="maintenance"]`).first();
    await bar.click();
    await waitOpen();
    await settle(page);
    let l = await layout("maintenance");
    if (!l.open) problems.push("open: the details are not in the top layer");
    else {
      if (!beside(l)) problems.push(`open: the details ${JSON.stringify(l.panel)} are not beside the bar ${JSON.stringify(l.event)}`);
      if (!/Ada Lovelace/.test(l.text)) problems.push(`open: the app's owner field is missing from "${l.text.slice(0, 120)}"`);
      const files = l.links.filter((a) => /\.(pdf|png)$/.test(a.href ?? ""));
      if (files.length !== 2) problems.push(`open: ${files.length} attachment link(s), expected 2 (${JSON.stringify(l.links)})`);
      if (!l.links.some((a) => a.name === "Open runbook" && /runbooks\/dc2-maintenance$/.test(a.href ?? ""))) problems.push("open: no runbook link");
      if (!l.focusInside) problems.push("open: focus is not in the details");
    }
    if (!/opened: Datacenter maintenance window/.test(await state())) problems.push(`open: the demo's state reads "${await state()}"`);

    // ── 3. Escape closes them, focus back on the bar ────────────────────────
    await page.keyboard.press("Escape");
    await waitClosed();
    l = await layout("maintenance");
    if (l.panel) problems.push("escape: the details are still open");
    if (l.focusOn !== "maintenance") problems.push(`escape: focus is on ${l.focusOn}, expected back on the bar`);

    // ── 4. in the week: following the grid's scrolling ──────────────────────
    await page.locator(`${ROOT} label`, { hasText: "Week" }).click();
    await page.locator(`${ROOT} [data-timegrid]`).waitFor();
    await placeDemo();
    await page.locator(`${ROOT} [data-event="incident-review"]`).first().click();
    await waitOpen();
    await settle(page);
    l = await layout("incident-review");
    if (!beside(l)) problems.push(`week: the details ${JSON.stringify(l.panel)} are not beside the block ${JSON.stringify(l.event)}`);
    else {
      const before = { panel: l.panel.top, event: l.event.top };
      await page.evaluate((ROOT) => (document.querySelector(`${ROOT} [data-timegrid]`).scrollTop += 60), ROOT);
      await settle(page);
      l = await layout("incident-review");
      const moved = l.event.top - before.event;
      if (Math.abs(moved) < 30) problems.push(`week: harness: the block moved ${moved}px on a 60px scroll`);
      else if (!l.panel || Math.abs(l.panel.top - before.panel - moved) > 2) problems.push(`week: the block moved ${moved}px and the details ${l.panel ? l.panel.top - before.panel : "?"}px`);
    }
    await page.keyboard.press("Escape");
    await waitClosed();

    // ── 5. at 375, from the day panel, inside the viewport ──────────────────
    await page.locator(`${ROOT} label`, { hasText: "Month" }).click();
    await page.locator(`${ROOT} [role="grid"]`).waitFor();
    await setView(page, { width: 375 });
    await placeDemo();
    const cell = page.locator(`${ROOT} [role="gridcell"][data-day="2026-10-06"]`);
    await cell.focus();
    await page.keyboard.press("Enter");
    const item = page.locator(`${ROOT} .r-dates-month-panel [data-event="maintenance"]`);
    await item.waitFor({ timeout: 3000 }).catch(() => {});
    if (!(await item.count())) problems.push("375: the day panel lists no maintenance event");
    else {
      await item.click();
      await waitOpen();
      await settle(page);
      l = await layout("maintenance");
      if (!l.panel) problems.push("375: the details did not open from the day panel");
      else if (l.panel.left < -0.5 || l.panel.right > l.viewport + 0.5) problems.push(`375: the details span ${l.panel.left}–${l.panel.right}px of ${l.viewport}px`);
      await page.keyboard.press("Escape");
      await waitClosed();
    }
    summary.chips = chips;

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
  }

  if (problems.length) throw new Error(`dates-event-details FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-details OK (${JSON.stringify(summary)})`;
}
