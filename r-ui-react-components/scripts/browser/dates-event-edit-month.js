// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: picking days and moving events in the EventCalendar's month view, by a
// real mouse, where jsdom has no layout (which cell is under the pointer, where a draft is
// drawn, the grip's press area, forced colours). The key model, names and exact calls are
// EventMonthView.edit.test.tsx's.
//
// On the editable demo (`[data-sc="event-calendar-edit"]`, October 2026, its events in app
// state, `[data-sc="event-calendar-edit-state"]` printing "selection: … · last: …"),
// switched to Month by its view switch, it asserts:
//   1. harness: the grid is "October 2026" with 35 cells, and a lane is 24px at comfortable
//      + fine (max(1lh + 2 × --R-SIZE-6, --HIT-MIN): 16 + 8 and 24, predicted from source),
//      equal to the formula over the tokens read in the page; nothing picked yet;
//   2. a mouse drag from 20 to 22 October: mid-drag one pick draft covering exactly those
//      cells (±1px); on release the state shows 20 → 22 all-day, the picked range is drawn
//      over the same cells and no panel opened;
//   3. a press without moving on 27 October opens its day panel; its New event picks that
//      day, the panel closes and focus is back on the cell; Escape there clears the pick;
//   4. the Interview chip dragged from Thursday 15 to Monday 19: faded in place with a move
//      draft over exactly the 19th mid-drag; then "last: move b-interview" and it renders in
//      the 19th's cell at 1:00 PM (the page's own time format);
//   5. the offsite bar's grip (shown on hover) dragged to the 17th: a resize draft over
//      15–17, "last: resize b-offsite", and the bar now spans the cells of 15 to 17 (±1px);
//   6. the public holiday (editable: false) dragged elsewhere: never faded, no draft, the
//      state unchanged, still in the 12th's cell;
//   7. coarse input: the grip's press area is at least --HIT-MIN (44px) on both axes and
//      inside its bar;
//   8. forced colours: a pick draft mid-drag keeps a dashed edge and the grip its lines,
//      each in a colour other than what is behind it; Escape cancels the drag;
//   9. RTL: 22 October is left of 20 October, and a drag rightward from the 22nd to the 20th
//      picks 20 → 22 (back in time).
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|r-dates-month/i.test(text) });
  const EDIT = '[data-sc="event-calendar-edit"]';
  const STATE = '[data-sc="event-calendar-edit-state"]';
  const cell = (iso) => page.locator(`${EDIT} [role="gridcell"][data-day="${iso}"]`);
  const state = async () => (await page.locator(STATE).textContent()).replace(/\s+/g, " ").trim();
  /** The state line's selection for an all-day range, as the demo prints it (local midnights as instants). */
  const allDayState = (from, to) =>
    page.evaluate(([from, to]) => `selection: all-day ${new Date(2026, 9, from).toISOString()} → ${new Date(2026, 9, to).toISOString()}`, [from, to]);
  /** Every box in page px: cells by day, the drafts by kind, a chip by event id. */
  const boxes = () =>
    page.evaluate((EDIT) => {
      const box = (el) => {
        // A plain object: a DOMRect's sides are prototype getters, which do not cross back to the check.
        const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const root = document.querySelector(EDIT);
      const cells = Object.fromEntries([...root.querySelectorAll('[role="gridcell"][data-day]')].map((c) => [c.dataset.day, box(c)]));
      const drafts = [...root.querySelectorAll(".r-dates-month-draft")].map((d) => ({ kind: d.dataset.draft, ...box(d) }));
      const chips = [...root.querySelectorAll(".r-dates-month-chip[data-event]")]
        .filter((c) => c.checkVisibility())
        .map((c) => ({
          id: c.dataset.event,
          day: c.closest('[role="gridcell"]').dataset.day,
          moving: c.hasAttribute("data-moving"),
          text: c.textContent.replace(/\s+/g, " ").trim(),
          ...box(c),
        }));
      return { cells, drafts, chips, dialogs: root.querySelectorAll('[role="dialog"]').length };
    }, EDIT);
  /** Whether `b` covers exactly the cells from `from` to `to` in one week (±1px). */
  const covers = (b, cells, from, to) =>
    b &&
    Math.abs(Math.min(b.left, b.right) - Math.min(cells[from].left, cells[to].left)) <= 1 &&
    Math.abs(Math.max(b.left, b.right) - Math.max(cells[from].right, cells[to].right)) <= 1 &&
    Math.abs(b.top - cells[from].top) <= 1 &&
    Math.abs(b.bottom - cells[from].bottom) <= 1;
  const fmt = (b) => (b ? `${b.left.toFixed(1)}–${b.right.toFixed(1)} × ${b.top.toFixed(1)}–${b.bottom.toFixed(1)}` : "none");
  /** A point on a day's cell clear of its chips: just under the day number's line, at the cell's centre line. */
  const onDay = (cells, iso) => ({ x: (cells[iso].left + cells[iso].right) / 2, y: cells[iso].top + 6 });
  const drag = async (from, to, { during } = {}) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 3, from.y + 2);
    await page.mouse.move(to.x, to.y, { steps: 10 });
    const seen = during ? await during() : undefined;
    await page.mouse.up();
    await settle(page);
    return seen;
  };
  const toMonth = async () => {
    await page.locator(EDIT).getByRole("radio", { name: "Month" }).check({ force: true });
    await page.waitForFunction((EDIT) => document.querySelector(`${EDIT} [role="grid"]`)?.getAttribute("aria-label") === "October 2026", EDIT, { timeout: 2000 });
    await page.locator(EDIT).scrollIntoViewIfNeeded();
    await settle(page);
  };

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, view: { theme: "default", density: "comfortable", input: "fine" } });
    await toMonth();
    const harness = await page.evaluate((EDIT) => {
      const px = (el, value) => {
        // A token resolved where it is read: a probe sized by it.
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
        el.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      const grid = document.querySelector(`${EDIT} [role="grid"]`);
      const c = grid.querySelector('[role="gridcell"]');
      const lh = Number.parseFloat(getComputedStyle(c).lineHeight);
      return {
        name: grid.getAttribute("aria-label"),
        cells: grid.querySelectorAll('[role="gridcell"]').length,
        lane: px(c, "var(--r-dates-month-lane)"),
        formula: Math.max(lh + 2 * px(c, "var(--R-SIZE-6)"), px(c, "var(--HIT-MIN)")),
      };
    }, EDIT);
    if (harness.name !== "October 2026" || harness.cells !== 35) problems.push(`harness: grid "${harness.name}" with ${harness.cells} cells, expected "October 2026" with 35`);
    if (harness.lane !== 24 || harness.formula !== 24) problems.push(`harness: lane ${harness.lane}px, formula ${harness.formula}px, source predicts 24px`);
    const initial = await state();
    if (!initial.startsWith("selection: none · last: —")) problems.push(`harness: the state reads "${initial}" before anything was done`);

    // ── 2. a drag picks 20–22 October ───────────────────────────────────────
    let b = await boxes();
    const picked = await drag(onDay(b.cells, "2026-10-20"), onDay(b.cells, "2026-10-22"), { during: boxes });
    const pickDrafts = picked.drafts.filter((d) => d.kind === "pick");
    if (pickDrafts.length !== 1 || !covers(pickDrafts[0], picked.cells, "2026-10-20", "2026-10-22")) {
      problems.push(`pick: mid-drag ${pickDrafts.length} pick draft(s), ${fmt(pickDrafts[0])}; the cells 20–22 are ${fmt({ ...picked.cells["2026-10-20"], right: picked.cells["2026-10-22"].right })}`);
    }
    const want2022 = await allDayState(20, 22);
    const afterPick = await state();
    b = await boxes();
    const selected = b.drafts.filter((d) => d.kind === "selection");
    if (!afterPick.startsWith(want2022)) problems.push(`pick: the state reads "${afterPick}", expected "${want2022}"`);
    if (selected.length !== 1 || !covers(selected[0], b.cells, "2026-10-20", "2026-10-22")) problems.push(`pick: the picked range is drawn as ${selected.length} band(s), ${fmt(selected[0])}`);
    if (b.dialogs !== 0) problems.push("pick: the drag's release opened a day panel");
    summary.pick = "20–22";

    // ── 3. a press opens the panel; New event; Escape ───────────────────────
    await cell("2026-10-27").click({ position: { x: 8, y: 6 } });
    await page.waitForFunction((EDIT) => document.querySelector(`${EDIT} [role="dialog"]`)?.matches(":popover-open"), EDIT, { timeout: 2000 });
    const panelName = await page.evaluate((EDIT) => {
      const d = document.querySelector(`${EDIT} [role="dialog"]`);
      return document.getElementById(d.getAttribute("aria-labelledby"))?.textContent;
    }, EDIT);
    if (!/27/.test(panelName ?? "")) problems.push(`panel: a press on 27 October opened "${panelName}"`);
    await page.locator(`${EDIT} [role="dialog"]`).getByRole("button", { name: "New event" }).click();
    // Bounded, and not the verdict: the assertions below name what is wrong if it never settles.
    await page
      .waitForFunction((EDIT) => document.activeElement?.dataset?.day === "2026-10-27" && !document.querySelector(`${EDIT} [role="dialog"]`), EDIT, { timeout: 2000 })
      .catch(() => {});
    const afterNew = { state: await state(), focus: await page.evaluate(() => document.activeElement?.dataset?.day ?? document.activeElement?.tagName), dialogs: (await boxes()).dialogs };
    const want27 = await allDayState(27, 27);
    if (!afterNew.state.startsWith(want27) || afterNew.focus !== "2026-10-27" || afterNew.dialogs !== 0) {
      problems.push(`new event: state "${afterNew.state}", focus ${afterNew.focus}, ${afterNew.dialogs} panel(s); expected "${want27}" with focus on the 27th and no panel`);
    }
    await page.keyboard.press("Escape");
    await settle(page);
    const afterEscape = await state();
    if (!afterEscape.startsWith("selection: none")) problems.push(`escape: the state reads "${afterEscape}", expected no selection`);
    if ((await boxes()).drafts.length !== 0) problems.push("escape: a band is still drawn after Escape");

    // ── 4. the Interview chip moves to Monday 19 ────────────────────────────
    b = await boxes();
    const interview = b.chips.find((c) => c.id === "b-interview");
    if (!interview || interview.day !== "2026-10-15") problems.push(`move: harness: the Interview chip is ${interview ? `on ${interview.day}` : "missing"}, expected on the 15th`);
    else {
      const grab = { x: (interview.left + interview.right) / 2, y: (interview.top + interview.bottom) / 2 };
      const to = { x: (b.cells["2026-10-19"].left + b.cells["2026-10-19"].right) / 2, y: (b.cells["2026-10-19"].top + b.cells["2026-10-19"].bottom) / 2 };
      const mid = await drag(grab, to, { during: boxes });
      const moving = mid.chips.find((c) => c.id === "b-interview");
      const moveDrafts = mid.drafts.filter((d) => d.kind === "move");
      if (!moving?.moving) problems.push("move: the Interview chip is not faded (data-moving) mid-drag");
      if (moveDrafts.length !== 1 || !covers(moveDrafts[0], mid.cells, "2026-10-19", "2026-10-19")) problems.push(`move: mid-drag ${moveDrafts.length} move draft(s), ${fmt(moveDrafts[0])}; the 19th is ${fmt(mid.cells["2026-10-19"])}`);
      const afterMove = await state();
      b = await boxes();
      const moved = b.chips.find((c) => c.id === "b-interview");
      const time = await page.evaluate(() => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 9, 19, 13)).replace(/\s+/g, " "));
      if (!afterMove.endsWith("last: move b-interview")) problems.push(`move: the state reads "${afterMove}", expected "last: move b-interview"`);
      if (moved?.day !== "2026-10-19" || !moved.text.startsWith(time)) problems.push(`move: the Interview chip is on ${moved?.day} reading "${moved?.text}", expected the 19th at ${time}`);
    }

    // ── 5. the offsite bar's grip extends it to the 17th ────────────────────
    b = await boxes();
    const offsite = b.chips.find((c) => c.id === "b-offsite");
    if (!offsite || Math.abs(offsite.right - b.cells["2026-10-16"].right) > 1) problems.push(`resize: harness: the offsite bar runs ${fmt(offsite)}, expected to end with the 16th's cell`);
    if (offsite) {
      await page.mouse.move((offsite.left + offsite.right) / 2, (offsite.top + offsite.bottom) / 2);
      const grip = await page.evaluate((EDIT) => {
        const g = document.querySelector(`${EDIT} .r-dates-month-chip[data-event="b-offsite"] .r-dates-month-grip`);
        if (!g) return null;
        const { left, right, top, bottom } = g.getBoundingClientRect();
        return { left, right, top, bottom, opacity: getComputedStyle(g).opacity };
      }, EDIT);
      if (!grip || grip.opacity !== "1") problems.push(`resize: the offsite bar's grip is ${grip ? `at opacity ${grip.opacity} on hover` : "missing"}`);
      else {
        const to = onDay(b.cells, "2026-10-17");
        const mid = await drag({ x: (grip.left + grip.right) / 2, y: (grip.top + grip.bottom) / 2 }, to, { during: boxes });
        const resizeDrafts = mid.drafts.filter((d) => d.kind === "resize");
        if (resizeDrafts.length !== 1 || !covers(resizeDrafts[0], mid.cells, "2026-10-15", "2026-10-17")) problems.push(`resize: mid-drag ${resizeDrafts.length} resize draft(s), ${fmt(resizeDrafts[0])}`);
        const afterResize = await state();
        b = await boxes();
        const bar = b.chips.find((c) => c.id === "b-offsite");
        if (!afterResize.endsWith("last: resize b-offsite")) problems.push(`resize: the state reads "${afterResize}", expected "last: resize b-offsite"`);
        // The chip's box is its lane across its days; its inline ends are the cells' (padding inside).
        if (!bar || Math.abs(bar.left - b.cells["2026-10-15"].left) > 1 || Math.abs(bar.right - b.cells["2026-10-17"].right) > 1) {
          problems.push(`resize: the offsite bar runs ${fmt(bar)}, the cells 15–17 ${fmt({ ...b.cells["2026-10-15"], right: b.cells["2026-10-17"].right })}`);
        }
      }
    }

    // ── 6. the public holiday stays put ─────────────────────────────────────
    b = await boxes();
    const holiday = b.chips.find((c) => c.id === "b-holiday");
    const before = await state();
    if (!holiday || holiday.day !== "2026-10-12") problems.push(`holiday: harness: the holiday chip is ${holiday ? `on ${holiday.day}` : "missing"}`);
    else {
      const mid = await drag({ x: (holiday.left + holiday.right) / 2, y: (holiday.top + holiday.bottom) / 2 }, onDay(b.cells, "2026-10-14"), { during: boxes });
      const still = mid.chips.find((c) => c.id === "b-holiday");
      if (still?.moving || mid.drafts.length !== 0) problems.push(`holiday: mid-drag it is ${still?.moving ? "faded" : "not faded"} with ${mid.drafts.length} draft(s), expected neither`);
      const after = await state();
      const now = (await boxes()).chips.find((c) => c.id === "b-holiday");
      if (after !== before || now?.day !== "2026-10-12") problems.push(`holiday: after a drag the state reads "${after}" (was "${before}") and it is on ${now?.day}`);
      if ((await boxes()).dialogs) await page.keyboard.press("Escape");
    }

    // ── 7. coarse: the grip's press area ────────────────────────────────────
    await setView(page, { input: "coarse" });
    const coarse = await page.evaluate((EDIT) => {
      const chip = document.querySelector(`${EDIT} .r-dates-month-chip[data-event="b-offsite"]`);
      const g = chip?.querySelector(".r-dates-month-grip");
      if (!g) return null;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--HIT-MIN)";
      chip.appendChild(probe);
      const hit = probe.getBoundingClientRect().width;
      probe.remove();
      const r = g.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      return { hit, width: r.width, height: r.height, inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5 };
    }, EDIT);
    if (!coarse) problems.push("coarse: no grip on the offsite bar");
    else if (coarse.hit !== 44 || coarse.width < coarse.hit - 0.5 || coarse.height < coarse.hit - 0.5 || !coarse.inside) {
      problems.push(`coarse: the grip is ${coarse.width}×${coarse.height}px (inside its bar: ${coarse.inside}), --HIT-MIN ${coarse.hit}px`);
    }
    await setView(page, { input: "fine" });

    // ── 8. forced colours: the draft's and the grip's edges ─────────────────
    await setView(page, { forced: true });
    b = await boxes();
    const from = onDay(b.cells, "2026-10-20");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 3, from.y + 2);
    await page.mouse.move(onDay(b.cells, "2026-10-21").x, from.y, { steps: 6 });
    const bar = b.chips.find((c) => c.id === "b-offsite");
    const forced = await page.evaluate((EDIT) => {
      const opaque = (c) => !/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent";
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const d = document.querySelector(`${EDIT} .r-dates-month-draft[data-draft="pick"]`);
      const ds = d && getComputedStyle(d);
      return d && {
        style: ds.borderTopStyle,
        width: Number.parseFloat(ds.borderTopWidth),
        differs: ds.borderTopColor !== bgOf(d.parentElement),
      };
    }, EDIT);
    if (!forced || forced.style !== "dashed" || !(forced.width > 0) || !forced.differs) problems.push(`forced colours: the pick draft's edge: ${JSON.stringify(forced)}`);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(page);
    if ((await state()).startsWith("selection: all-day")) problems.push("forced colours: Escape mid-drag still picked the range");
    if (bar) {
      await page.mouse.move((bar.left + bar.right) / 2, (bar.top + bar.bottom) / 2);
      const grip = await page.evaluate((EDIT) => {
        const g = document.querySelector(`${EDIT} .r-dates-month-chip[data-event="b-offsite"] .r-dates-month-grip`);
        if (!g) return null;
        const after = getComputedStyle(g, "::after");
        const face = g.closest(".r-dates-month-chip").querySelector(".r-dates-month-chip-face");
        return {
          opacity: getComputedStyle(g).opacity,
          style: after.borderInlineStartStyle,
          width: Number.parseFloat(after.borderInlineStartWidth),
          differs: after.borderInlineStartColor !== getComputedStyle(face).backgroundColor,
        };
      }, EDIT);
      if (!grip || grip.opacity !== "1" || grip.style !== "solid" || !(grip.width > 0) || !grip.differs) problems.push(`forced colours: the grip's lines: ${JSON.stringify(grip)}`);
    }
    await setView(page, { forced: false });

    // ── 9. RTL: a drag rightward goes back in time ──────────────────────────
    await setView(page, { dir: "rtl" });
    b = await boxes();
    if (!(b.cells["2026-10-20"].left > b.cells["2026-10-22"].left)) problems.push("RTL: harness: 20 October is not right of 22 October");
    else {
      await drag(onDay(b.cells, "2026-10-22"), onDay(b.cells, "2026-10-20"));
      const rtl = await state();
      if (!rtl.startsWith(want2022)) problems.push(`RTL: a drag from the 22nd rightward to the 20th reads "${rtl}", expected "${want2022}"`);
    }
    await setView(page, { dir: "ltr" });
  } finally {
    stopErrors();
  }

  if (errors.length) problems.push(...errors);
  if (problems.length) throw new Error(problems.join("\n"));
  return `event month editing ok: picked ${summary.pick} by drag; panel and New event; Escape clears; Interview moved to the 19th; offsite resized to the 17th; holiday stays; coarse grip ≥ 44px; forced edges; RTL drag back in time`;
}
