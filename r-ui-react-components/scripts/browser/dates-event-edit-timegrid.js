// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: moving and resizing events in the EventCalendar's week time grid, by a real
// mouse and by real keys, where jsdom has no layout (which slot is under the pointer, where a
// draft is drawn, the grips' press areas, edge scrolling, forced colours). The key model,
// names and exact calls are EventTimeGrid.edit.test.tsx's.
//
// On the editable demo (`[data-sc="event-calendar-edit"]`, the week of 11–17 October 2026,
// its events in app state, `[data-sc="event-calendar-edit-state"]` printing "… · last: …"),
// it asserts:
//   1. harness: `--ROW-H` is 40px (comfortable + fine, from source), and the Interview block
//      (Thursday 13:00–14:00) is drawn 1040px down its day and 80px tall, from its minutes;
//      nothing changed yet;
//   2. coarse, before anything moves: every block's bottom grip and the offsite bar's end grip
//      are inside their event and min(`--HIT-MIN`, half the event inside its edge) deep, so
//      Design review's is 44px, and the stand-up's (drawn one `--ROW-H` tall) is its lower
//      half, the body above it taking a press itself;
//   3. a mouse drag of Interview from Thursday 13:00 to Friday 15:00 (pressed near its top):
//      mid-drag the block is faded in place and one draft sits in Friday's column at 15:00,
//      an hour tall (±1px); on release "last: move b-interview" and the block is redrawn in
//      Friday's column at 15:00;
//   4. Design review's bottom grip (shown on hover) dragged into the 12:00 slot: "last:
//      resize b-review" and the block 10:00–12:30 tall;
//   5. the offsite bar's end grip dragged from Friday to Saturday: "last: resize b-offsite",
//      the bar now ends in Saturday's column; then the bar dragged one day later: "last: move
//      b-offsite", the bar starts in Friday's column and goes on past the week;
//   6. the public holiday (editable: false) has no grip, and a drag of it draws no draft, never
//      fades it and changes nothing;
//   7. keys: Tab from the region reaches a block; Space, ArrowDown ×2, Enter moves it two
//      slots (an hour) with focus still on it and no click on it; Space, ArrowDown, Escape
//      leaves it where it was, no draft;
//   8. edge scrolling: a block held at the region's bottom edge scrolls the region down;
//      Escape then cancels and nothing changes;
//   9. forced colours: mid-drag, the moving block's grip mark and the draft's dashed edge keep
//      a colour other than what is behind them;
//  10. RTL: Friday's column is left of Thursday's, and dragging Interview one column left
//      moves it one day later.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|timegrid|time grid/i.test(text) });
  const EDIT = '[data-sc="event-calendar-edit"]';
  const GRID = `${EDIT} [data-timegrid]`;
  const STATE = '[data-sc="event-calendar-edit-state"]';
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  const last = async () => ((await page.locator(STATE).textContent()) ?? "").replace(/\s+/g, " ").split("last:")[1]?.trim();
  const until = (text) =>
    page
      .waitForFunction(([sel, text]) => document.querySelector(sel)?.textContent.includes(text), [STATE, text], { timeout: 2000 })
      // Bounded, and not the verdict: the assertion after it names what is wrong.
      .catch(() => {});

  /** The grid as laid out, in page px: day columns, blocks, bars, drafts, grips. */
  const measure = () =>
    page.evaluate((GRID) => {
      const box = (el) => {
        const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const px = (el, value) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;block-size:${value}`;
        el.appendChild(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        return h;
      };
      const root = document.querySelector(GRID);
      const body = root.querySelector(".r-dates-timegrid-body");
      const zero = body.querySelector('[data-hour="0"]').getBoundingClientRect().top;
      const one = body.querySelector('[data-hour="1"]').getBoundingClientRect().top;
      const cols = Object.fromEntries([...body.querySelectorAll(".r-dates-timegrid-day[data-day]")].map((c) => [c.dataset.day, box(c)]));
      const grip = (el) => {
        const g = el.querySelector("[data-grip]");
        return g ? box(g) : null;
      };
      const blocks = [...body.querySelectorAll("[data-block]")].map((el) => ({
        id: el.dataset.event,
        day: el.closest("[data-day]").dataset.day,
        moving: el.hasAttribute("data-moving"),
        opacity: Number(getComputedStyle(el).opacity),
        grip: grip(el),
        // Inside its edge: the grip's containing block (and the clip of its press area).
        inner: el.clientHeight,
        ...box(el),
      }));
      const bars = [...root.querySelectorAll("[data-allday] [data-event]")].map((el) => ({
        id: el.dataset.event,
        moving: el.hasAttribute("data-moving"),
        after: el.hasAttribute("data-continues-after"),
        grip: grip(el),
        inner: el.clientWidth,
        ...box(el),
      }));
      const drafts = [...root.querySelectorAll(".r-dates-timegrid-draft, .r-dates-timegrid-bar-draft")].map((el) => ({ day: el.closest("[data-day]")?.dataset.day ?? null, ...box(el) }));
      return {
        rowH: px(body, "var(--ROW-H)"),
        hit: px(body, "var(--HIT-MIN)"),
        zero,
        perMin: (one - zero) / 60,
        cols,
        blocks,
        bars,
        drafts,
        head: box(root.querySelector("[data-timegrid-head]")),
        region: box(root),
        scrollTop: root.scrollTop,
      };
    }, GRID);
  const block = (g, id) => g.blocks.find((b) => b.id === id);
  const bar = (g, id) => g.bars.find((b) => b.id === id);
  const yAt = (g, minute) => g.zero + minute * g.perMin;
  const midX = (g, iso) => (g.cols[iso].left + g.cols[iso].right) / 2;
  /** The region in the page's view, with `minute` at the top of its body (under the sticky header). */
  const showFrom = async (minute) => {
    await page.evaluate((GRID) => document.querySelector(GRID).scrollIntoView({ block: "center" }), GRID);
    await page.evaluate(
      ({ GRID, minute }) => {
        const root = document.querySelector(GRID);
        const head = root.querySelector("[data-timegrid-head]").getBoundingClientRect();
        const zero = root.querySelector('[data-hour="0"]').getBoundingClientRect().top;
        const one = root.querySelector('[data-hour="1"]').getBoundingClientRect().top;
        root.scrollTop += zero + ((one - zero) / 60) * minute - head.bottom;
      },
      { GRID, minute },
    );
    await settle(page);
  };
  /** A real mouse drag; `during` measures before the release. */
  const drag = async (from, to, { during } = {}) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 2, from.y + 3);
    await page.mouse.move(to.x, to.y, { steps: 10 });
    const seen = during ? await during() : undefined;
    await page.mouse.up();
    await settle(page);
    return seen;
  };

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, height: 1100, view: { theme: "default", density: "comfortable", input: "fine" } });
    await page.locator(GRID).waitFor();
    await showFrom(12 * 60);
    let g = await measure();
    const interview = block(g, "b-interview");
    if (g.rowH !== 40) problems.push(`harness: --ROW-H at the grid is ${g.rowH}px, source predicts 40px`);
    if (!interview || interview.day !== "2026-10-15") problems.push(`harness: Interview is ${interview ? `on ${interview.day}` : "missing"}, expected on Thursday`);
    else if (!near(interview.top - g.cols["2026-10-15"].top, 780 * (40 / 30)) || !near(interview.height, 80)) {
      problems.push(`harness: Interview drawn ${(interview.top - g.cols["2026-10-15"].top).toFixed(1)}px down Thursday, ${interview.height.toFixed(1)}px tall; 13:00–14:00 predicts 1040px, 80px`);
    }
    if ((await last()) !== "—") problems.push(`harness: the state reads "last: ${await last()}" before anything moved`);

    // ── 2. coarse grips, before anything moves ─────────────────────────────
    await setView(page, { input: "coarse" });
    await showFrom(9 * 60);
    g = await measure();
    if (g.hit !== 44) problems.push(`coarse: harness: --HIT-MIN ${g.hit}px, source predicts 44px`);
    const gripped = [...g.blocks, ...g.bars].filter((e) => e.grip);
    // Positive control for the depth rule: Design review (10:00–11:30) is over two floors tall inside.
    if (!(block(g, "b-review")?.grip?.height >= g.hit - 0.5)) problems.push(`coarse: Design review's grip is ${block(g, "b-review")?.grip?.height}px deep, expected --HIT-MIN`);
    if (gripped.length !== 4) problems.push(`coarse: harness: ${gripped.length} events with a grip, expected the three blocks and the offsite bar`);
    for (const e of gripped) {
      const inside = e.grip.left >= e.left - 0.5 && e.grip.right <= e.right + 0.5 && e.grip.top >= e.top - 0.5 && e.grip.bottom <= e.bottom + 0.5;
      const isBar = g.bars.includes(e);
      const deep = isBar ? e.grip.width : e.grip.height;
      const span = e.inner;
      const want = Math.min(g.hit, span / 2);
      if (!inside) problems.push(`coarse: ${e.id}'s grip reaches outside it`);
      if (!near(deep, want, 0.5)) problems.push(`coarse: ${e.id}'s grip is ${deep.toFixed(1)}px deep in an event ${span}px inside its edge, expected ${want.toFixed(1)}px`);
    }
    // A stand-up is drawn one --ROW-H (44px) tall: its grip is the lower half, its body takes a press above it.
    const standup = block(g, "b-standup");
    if (!standup?.grip) problems.push("coarse: harness: no Stand-up grip");
    else {
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return { block: el?.closest("[data-block]")?.dataset.event, grip: Boolean(el?.closest("[data-grip]")) };
      }, { x: (standup.left + standup.right) / 2, y: standup.top + standup.height / 4 });
      if (hit.block !== "b-standup" || hit.grip) problems.push(`coarse: a press on the Stand-up's upper half hits ${JSON.stringify(hit)}, expected its body`);
    }
    summary.coarseGrips = gripped.length;
    await setView(page, { input: "fine" });
    await showFrom(12 * 60);
    g = await measure();

    // ── 3. Interview, Thursday 13:00 → Friday 15:00 ─────────────────────────
    const thursday = block(g, "b-interview");
    if (thursday) {
      const interview = thursday;
      const from = { x: (interview.left + interview.right) / 2, y: interview.top + 8 };
      const mid = await drag(from, { x: midX(g, "2026-10-16"), y: yAt(g, 15 * 60) + 8 }, { during: measure });
      const source = block(mid, "b-interview");
      if (!source?.moving || !(source.opacity < 1)) problems.push(`move: mid-drag the source is ${source?.moving ? "" : "not "}marked moving, opacity ${source?.opacity}`);
      const fri = mid.drafts.filter((d) => d.day === "2026-10-16");
      if (mid.drafts.length !== 1 || fri.length !== 1) problems.push(`move: mid-drag ${mid.drafts.length} draft(s), ${fri.length} on Friday`);
      else if (!near(fri[0].top, yAt(mid, 900)) || !near(fri[0].height, 60 * mid.perMin)) {
        problems.push(`move: the draft is ${(fri[0].top - yAt(mid, 900)).toFixed(1)}px from 15:00 and ${fri[0].height.toFixed(1)}px tall, expected at it and ${60 * mid.perMin}px`);
      }
      await until("last: move b-interview");
      g = await measure();
      const moved = block(g, "b-interview");
      if ((await last()) !== "move b-interview") problems.push(`move: the state reads "last: ${await last()}"`);
      if (moved?.day !== "2026-10-16" || !near(moved.top, yAt(g, 900))) problems.push(`move: Interview redrawn on ${moved?.day}, ${moved ? (moved.top - yAt(g, 900)).toFixed(1) : "?"}px from 15:00`);
      if (g.drafts.length) problems.push(`move: ${g.drafts.length} draft(s) left after the drop`);
    }

    // ── 4. Design review's end, 11:30 → 12:30 ───────────────────────────────
    await showFrom(9 * 60);
    g = await measure();
    const review = block(g, "b-review");
    if (!review?.grip) problems.push(`resize: Design review ${review ? "has no grip" : "is missing"}`);
    else {
      await page.mouse.move((review.left + review.right) / 2, review.top + 10);
      // The mark fades in over --DURATION-FAST: wait for it, bounded, rather than read it mid-fade.
      await page
        .waitForFunction((GRID) => getComputedStyle(document.querySelector(`${GRID} [data-block$="|b-review"] [data-grip]`), "::after").opacity === "1", GRID, { timeout: 2000 })
        .catch(() => {});
      const shown = await page.evaluate((GRID) => getComputedStyle(document.querySelector(`${GRID} [data-block$="|b-review"] [data-grip]`), "::after").opacity, GRID);
      if (shown !== "1") problems.push(`resize: the grip mark's opacity on hover is ${shown}`);
      await drag({ x: (review.grip.left + review.grip.right) / 2, y: (review.grip.top + review.grip.bottom) / 2 }, { x: midX(g, "2026-10-14"), y: yAt(g, 12 * 60) + 10 });
      await until("last: resize b-review");
      g = await measure();
      const resized = block(g, "b-review");
      if ((await last()) !== "resize b-review") problems.push(`resize: the state reads "last: ${await last()}"`);
      if (!resized || !near(resized.top, yAt(g, 600)) || !near(resized.bottom, yAt(g, 750))) {
        problems.push(`resize: Design review runs ${resized ? `${((resized.top - g.zero) / g.perMin).toFixed(0)}–${((resized.bottom - g.zero) / g.perMin).toFixed(0)}` : "?"} minutes, expected 600–750`);
      }
    }

    // ── 5. the offsite bar: its end grip to Saturday, then a day later ──────
    g = await measure();
    let offsite = bar(g, "b-offsite");
    if (!offsite?.grip || !near(offsite.right, g.cols["2026-10-16"].right, 8)) problems.push(`all-day: harness: the offsite bar ${offsite ? `ends at ${offsite.right.toFixed(1)}px, Friday at ${g.cols["2026-10-16"].right.toFixed(1)}px, grip ${Boolean(offsite.grip)}` : "is missing"}`);
    if (offsite?.grip) {
      await page.mouse.move(offsite.left + 10, (offsite.top + offsite.bottom) / 2);
      await drag({ x: (offsite.grip.left + offsite.grip.right) / 2, y: (offsite.grip.top + offsite.grip.bottom) / 2 }, { x: midX(g, "2026-10-17"), y: (offsite.top + offsite.bottom) / 2 });
      await until("last: resize b-offsite");
      g = await measure();
      offsite = bar(g, "b-offsite");
      if ((await last()) !== "resize b-offsite") problems.push(`all-day resize: the state reads "last: ${await last()}"`);
      if (!offsite || !(offsite.right > g.cols["2026-10-17"].left && offsite.right <= g.cols["2026-10-17"].right + 1)) problems.push(`all-day resize: the bar ends at ${offsite?.right.toFixed(1)}px, not in Saturday's column`);
    }
    if (offsite) {
      const y = (offsite.top + offsite.bottom) / 2;
      await drag({ x: midX(g, "2026-10-15"), y }, { x: midX(g, "2026-10-16"), y });
      await until("last: move b-offsite");
      g = await measure();
      offsite = bar(g, "b-offsite");
      if ((await last()) !== "move b-offsite") problems.push(`all-day move: the state reads "last: ${await last()}"`);
      if (!offsite || !(offsite.left >= g.cols["2026-10-16"].left - 1 && offsite.left < g.cols["2026-10-16"].right) || !offsite.after) {
        problems.push(`all-day move: the bar starts at ${offsite?.left.toFixed(1)}px (Friday ${g.cols["2026-10-16"].left.toFixed(1)}px) and goes on past the week: ${offsite?.after}`);
      }
    }

    // ── 6. the public holiday stays ─────────────────────────────────────────
    g = await measure();
    const holiday = bar(g, "b-holiday");
    const before5 = await last();
    if (!holiday) problems.push("holiday: harness: no public holiday bar");
    else {
      if (holiday.grip) problems.push("holiday: an event that cannot move has a grip");
      const y = (holiday.top + holiday.bottom) / 2;
      const mid = await drag({ x: (holiday.left + holiday.right) / 2, y }, { x: midX(g, "2026-10-14"), y }, { during: measure });
      if (mid.drafts.length || bar(mid, "b-holiday")?.moving) problems.push(`holiday: mid-drag ${mid.drafts.length} draft(s), moving ${bar(mid, "b-holiday")?.moving}`);
      if ((await last()) !== before5) problems.push(`holiday: the state went from "${before5}" to "${await last()}"`);
    }

    // ── 7. keys ─────────────────────────────────────────────────────────────
    await showFrom(9 * 60);
    await page.evaluate((GRID) => document.querySelector(GRID).focus({ preventScroll: true }), GRID);
    let reached = null;
    for (let i = 0; i < 20 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate((GRID) => (document.activeElement?.closest(GRID) && document.activeElement.dataset.block) || null, GRID);
    }
    if (!reached) problems.push("keys: Tab from the region never reached a block");
    else {
      const startOf = () => page.evaluate((id) => Number(document.querySelector(`[data-block="${id}"]`)?.style.getPropertyValue("--r-dates-start")), reached);
      const event = reached.split("|")[1];
      const start = await startOf();
      await page.evaluate(() => {
        window.__tgClicks = 0;
        document.activeElement.addEventListener("click", () => (window.__tgClicks += 1));
      });
      const before6 = await last();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await until(`last: move ${event}`);
      await settle(page);
      const after = await page.evaluate(() => ({ block: document.activeElement?.dataset.block, event: document.activeElement?.dataset.event, clicks: window.__tgClicks }));
      const moved = await page.evaluate((id) => Number(document.querySelector(`[data-block="${id}"]`)?.style.getPropertyValue("--r-dates-start")), after.block);
      if ((await last()) !== `move ${event}` || (await last()) === before6) problems.push(`keys: the state reads "last: ${await last()}", expected "move ${event}"`);
      if (after.event !== event || moved !== start + 60) problems.push(`keys: focus on ${after.block} starting at minute ${moved}, expected ${event} at ${start + 60}`);
      if (after.clicks !== 0) problems.push(`keys: Space / Enter pressed the block ${after.clicks} time(s) while moving it`);
      const before = await page.evaluate(() => document.activeElement.dataset.block);
      const startNow = await page.evaluate((id) => Number(document.querySelector(`[data-block="${id}"]`).style.getPropertyValue("--r-dates-start")), before);
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
      await settle(page);
      const kept = await page.evaluate((GRID) => ({ block: document.activeElement?.dataset.block, drafts: document.querySelectorAll(`${GRID} .r-dates-timegrid-draft`).length }), GRID);
      const startKept = await page.evaluate((id) => Number(document.querySelector(`[data-block="${id}"]`)?.style.getPropertyValue("--r-dates-start")), before);
      if (kept.block !== before || kept.drafts || startKept !== startNow || (await last()) !== `move ${event}`) {
        problems.push(`keys Escape: focus ${kept.block}, ${kept.drafts} draft(s), start ${startKept} (was ${startNow}), state "${await last()}"`);
      }
      summary.keys = event;
    }

    // ── 8. edge scrolling ───────────────────────────────────────────────────
    await showFrom(9 * 60);
    g = await measure();
    const held = block(g, "b-review");
    const before7 = await last();
    if (!held) problems.push("edge: harness: no Design review block");
    else {
      await page.mouse.move((held.left + held.right) / 2, held.top + 8);
      await page.mouse.down();
      await page.mouse.move((held.left + held.right) / 2 + 2, held.top + 12);
      await page.mouse.move((held.left + held.right) / 2, g.region.bottom - 6, { steps: 8 });
      await page.waitForFunction(([GRID, top]) => document.querySelector(GRID).scrollTop > top + 50, [GRID, g.scrollTop], { timeout: 1500 }).catch(() => {});
      const scrolled = await page.evaluate((GRID) => document.querySelector(GRID).scrollTop, GRID);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await settle(page);
      if (!(scrolled > g.scrollTop + 50)) problems.push(`edge: held at the region's bottom edge it scrolled ${scrolled - g.scrollTop}px`);
      if ((await last()) !== before7 || (await measure()).drafts.length) problems.push("edge: Escape and the release after it changed something");
      summary.edgeScroll = scrolled - g.scrollTop;
    }

    // ── 9. forced colours ───────────────────────────────────────────────────
    await setView(page, { forced: true });
    await showFrom(9 * 60);
    g = await measure();
    const fcBlock = block(g, "b-review");
    if (fcBlock) {
      await page.mouse.move((fcBlock.left + fcBlock.right) / 2, fcBlock.top + 8);
      const seen = await drag(
        { x: (fcBlock.left + fcBlock.right) / 2, y: fcBlock.top + 8 },
        { x: midX(g, "2026-10-13"), y: fcBlock.top + 8 + 2 * 60 * g.perMin },
        {
          during: () =>
            page.evaluate((GRID) => {
              const opaque = (c) => c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
              const bgOf = (el) => {
                for (let n = el; n; n = n.parentElement) {
                  const c = getComputedStyle(n).backgroundColor;
                  if (opaque(c)) return c;
                }
                return getComputedStyle(document.documentElement).backgroundColor;
              };
              const draft = document.querySelector(`${GRID} .r-dates-timegrid-draft`);
              const grip = document.querySelector(`${GRID} [data-block$="|b-review"] [data-grip]`);
              const d = draft && getComputedStyle(draft);
              const m = grip && getComputedStyle(grip, "::after");
              return {
                forced: matchMedia("(forced-colors: active)").matches,
                draft: d && { style: d.borderTopStyle, width: Number.parseFloat(d.borderTopWidth), visible: d.borderTopColor !== bgOf(draft.parentElement) },
                grip: m && { opacity: m.opacity, style: m.borderBottomStyle, width: Number.parseFloat(m.borderBottomWidth), visible: m.borderBottomColor !== bgOf(grip.parentElement) },
              };
            }, GRID),
        },
      );
      // The drop moved Design review to Tuesday; nothing below depends on where it is.
      if (!seen.forced) problems.push("forced colours: harness: the media query does not match");
      if (!seen.draft || seen.draft.style !== "dashed" || !(seen.draft.width > 0) || !seen.draft.visible) problems.push(`forced colours: the draft's edge ${JSON.stringify(seen.draft)}`);
      if (!seen.grip || seen.grip.opacity !== "1" || seen.grip.style !== "solid" || !(seen.grip.width > 0) || !seen.grip.visible) problems.push(`forced colours: the moving block's grip mark ${JSON.stringify(seen.grip)}`);
    } else problems.push("forced colours: harness: no Design review block");
    await setView(page, { forced: false });

    // ── 10. RTL ─────────────────────────────────────────────────────────────
    await page.evaluate((EDIT) => document.querySelector(EDIT).setAttribute("dir", "rtl"), EDIT);
    await showFrom(12 * 60);
    g = await measure();
    const rtlInterview = block(g, "b-interview");
    if (!(g.cols["2026-10-16"].right <= g.cols["2026-10-15"].left + 1)) problems.push("RTL: harness: Friday is not left of Thursday");
    if (!rtlInterview) problems.push("RTL: harness: no Interview block");
    else {
      const day = rtlInterview.day;
      const next = `2026-10-${String(Number(day.slice(8)) + 1).padStart(2, "0")}`;
      const y = rtlInterview.top + 8;
      if (!g.cols[next]) throw new Error(`RTL: harness: Interview is on ${day}, the week's last day`);
      await drag({ x: (rtlInterview.left + rtlInterview.right) / 2, y }, { x: midX(g, next), y });
      await until("last: move b-interview");
      g = await measure();
      if (block(g, "b-interview")?.day !== next) problems.push(`RTL: dragged one column left from ${day}, Interview is on ${block(g, "b-interview")?.day}, expected ${next}`);
    }
    await page.evaluate((EDIT) => document.querySelector(EDIT).removeAttribute("dir"), EDIT);

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`dates-event-edit-timegrid FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-edit-timegrid OK (${JSON.stringify(summary)})`;
}
