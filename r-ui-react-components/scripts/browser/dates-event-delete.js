// @covers   dates/EventCalendar, overlays/ToastProvider
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: EventCalendar's `onEventDelete` as the showcase's editable demo answers it
// (removed at once, a toast with Undo), with real keys and the showcase's real toasts.
//
// On `[data-sc="event-calendar-edit"]` (the week of Sunday 11 October 2026), it asserts:
//   1. harness: the Interview block (Thursday 13:00) is drawn and says its key
//      (`aria-keyshortcuts`), the public holiday (editable: false) says none;
//   2. Delete on the focused Interview block removes it: the demo's state says so, a toast
//      says "Deleted “Interview”" with an Undo button, and focus is on another event, not lost;
//   3. Undo puts it back: the block is drawn again at Thursday 13:00 and the state says so;
//   4. Delete on the public holiday does nothing: no toast, the bar stays.
async (page) => {
  const problems = [];
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|toast/i.test(text) });
  const ROOT = '[data-sc="event-calendar-edit"]';
  const OUT = '[data-sc="event-calendar-edit-state"]';
  const view = { theme: "default", density: "comfortable", input: "fine" };

  const state = () => page.evaluate((OUT) => document.querySelector(OUT)?.textContent ?? "", OUT);
  const until = (text) => page.waitForFunction(({ OUT, text }) => document.querySelector(OUT)?.textContent.includes(text), { OUT, text }, { timeout: 3000 }).catch(() => {});
  const interview = () =>
    page.evaluate((ROOT) => {
      const el = document.querySelector(`${ROOT} [data-block="2026-10-15|b-interview"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const line = document.querySelector(`${ROOT} .r-dates-timegrid-body [data-hour="13"]`).getBoundingClientRect();
      return { top: r.top, line: line.top, keys: el.getAttribute("aria-keyshortcuts") };
    }, ROOT);
  const toastWith = (text) =>
    page.evaluate((text) => [...document.querySelectorAll("li, [role=status], [role=alert]")].some((el) => el.textContent?.includes(text)), text);

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, height: 1000, view });
    await page.locator(`${ROOT} [data-timegrid]`).waitFor();
    const before = await interview();
    if (!before) problems.push("harness: no Interview block on Thursday");
    else if (before.keys !== "Delete Backspace") problems.push(`harness: the Interview block says keys "${before.keys}"`);
    const holidayKeys = await page.evaluate((ROOT) => document.querySelector(`${ROOT} [data-event="b-holiday"]`)?.getAttribute("aria-keyshortcuts") ?? null, ROOT);
    if (holidayKeys !== null) problems.push(`harness: the public holiday says keys "${holidayKeys}"`);

    // ── 2. Delete removes it, a toast with Undo, focus kept on an event ─────
    await page.evaluate((ROOT) => document.querySelector(`${ROOT} [data-block="2026-10-15|b-interview"]`).focus(), ROOT);
    await page.keyboard.press("Delete");
    await until("last: delete b-interview");
    if (!(await state()).includes("last: delete b-interview")) problems.push(`delete: the demo prints "${await state()}"`);
    if (await interview()) problems.push("delete: the Interview block is still drawn");
    const focus = await page.evaluate((ROOT) => {
      const a = document.activeElement;
      return { event: a?.dataset?.event ?? null, inside: Boolean(a?.closest(ROOT)) };
    }, ROOT);
    if (!focus.event || !focus.inside) problems.push(`delete: focus is on ${JSON.stringify(focus)}, expected another event`);
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Undo"), null, { timeout: 3000 }).catch(() => {});
    if (!(await toastWith("Deleted “Interview”"))) problems.push("delete: no toast says the Interview was deleted");

    // ── 3. Undo puts it back ────────────────────────────────────────────────
    const undo = page.getByRole("button", { name: "Undo" });
    if (!(await undo.count())) problems.push("undo: the toast has no Undo button");
    else {
      await undo.first().click();
      await until("last: undo b-interview");
      const back = await interview();
      if (!back) problems.push("undo: the Interview block is not drawn again");
      else if (Math.abs(back.top - back.line) > 2) problems.push(`undo: the Interview block is ${back.top - back.line}px from 13:00`);
    }

    // ── 4. the public holiday is not deleted ────────────────────────────────
    await page.evaluate((ROOT) => document.querySelector(`${ROOT} [data-event="b-holiday"]`)?.focus(), ROOT);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300); // an absence: give a wrong toast time to appear
    if (await toastWith("Deleted “Public holiday”")) problems.push("holiday: a toast says the public holiday was deleted");
    if (!(await page.evaluate((ROOT) => Boolean(document.querySelector(`${ROOT} [data-event="b-holiday"]`)), ROOT))) problems.push("holiday: the bar is gone");
    if ((await state()).includes("delete b-holiday")) problems.push(`holiday: the demo prints "${await state()}"`);

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
  }

  if (problems.length) throw new Error(`dates-event-delete FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return "dates-event-delete OK";
}
