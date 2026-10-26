// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: the EventCalendar's month view, where jsdom sees nothing (layout,
// container queries, the top layer, forced colours). The key model, names and the
// panel's contents are EventMonthView.test.tsx's.
//
// On the EventCalendar section's demos (`[data-sc^="event-calendar-"]`; October 2026,
// today Thursday 15, the showcase's ops schedule), it asserts:
//   1. harness: the main demo's grid is "October 2026" with 35 day cells, and a lane is
//      24px at comfortable + fine (max(1lh + 2 × --R-SIZE-6, --HIT-MIN): 16 + 8 and 24,
//      predicted from source), equal to the formula over the tokens read in the page;
//   2. chips at 1280 (the calendar wider than --MEASURE): chips shown, dots not; the
//      6–8 October maintenance bar spans exactly the cells of 6 and 8 October (±1px);
//      every chip is one lane tall; on the busy Wednesday (21 October) the on-call bar,
//      the stand-up and "+4 more" sit in lanes 0, 1, 2, one lane apart, inside the cell;
//   3. RTL: the main demo turned `dir="rtl"` draws the same bar from the cell of 6 October
//      on the right to the cell of 8 October on the left, and ArrowLeft moves to the
//      next day; the ar-EG demo's weeks run from the right and its ArrowLeft goes forward;
//   4. dots in the narrow demo (inside --COLUMN-LG): no chip is rendered visible, dots are,
//      the busy Wednesday shows three and "+3", and every cell is at least --HIT-MIN tall;
//   5. the day panel: a press on 21 October's cell opens a dialog in the top layer
//      (`:popover-open`), named by the day, listing its six events, centred under (or
//      over, when flipped) the cell at --R-SIZE-4 (±1px); Escape closes it and focus is
//      back on the cell;
//   6. keyboard paging keeps focus: from 21 October PageDown, ArrowDown twice and
//      Shift+PageUp land on 21 November, 5 December, 5 December 2025, each focused in the
//      grid that shows it, and the demo's controlled date follows;
//   7. coarse input: a lane is --HIT-MIN (44px), every chip and "+n more" that tall;
//   8. forced colours: every shown chip's face keeps an edge in a colour other than what
//      is behind it, today's badge differs from its cell, a keyboard-focused cell shows
//      a solid ring;
//   9. at 375: the main demo is dots; a press on 31 October (the last column) opens the
//      panel inside the viewport, the page does not scroll sideways and no cell's content
//      reaches past its cell.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|r-dates-month/i.test(text) });
  const MAIN = '[data-sc="event-calendar-main"]';
  const NARROW = '[data-sc="event-calendar-narrow"]';
  const open = (width, view = {}) =>
    openSection(page, "dates-eventcalendar", { width, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
  const cell = (scope, iso) => page.locator(`${scope} [role="gridcell"][data-day="${iso}"]`);
  const focused = () => page.evaluate(() => document.activeElement?.dataset?.day ?? document.activeElement?.tagName);

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await open(1280);
    const harness = await page.evaluate(
      (MAIN) => {
        const px = (el, value) => {
          // A token resolved where it is read: a probe sized by it.
          const probe = document.createElement("span");
          probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
          el.appendChild(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        };
        const grid = document.querySelector(`${MAIN} [role="grid"]`);
        const cell = grid.querySelector('[role="gridcell"]');
        const lh = Number.parseFloat(getComputedStyle(cell).lineHeight);
        const r6 = px(cell, "var(--R-SIZE-6)");
        const hit = px(cell, "var(--HIT-MIN)");
        return {
          name: grid.getAttribute("aria-label"),
          cells: grid.querySelectorAll('[role="gridcell"]').length,
          lane: px(cell, "var(--r-dates-month-lane)"),
          formula: Math.max(lh + 2 * r6, hit),
        };
      },
      MAIN,
    );
    if (harness.name !== "October 2026" || harness.cells !== 35) problems.push(`harness: main grid "${harness.name}" with ${harness.cells} cells, expected "October 2026" with 35`);
    if (harness.lane !== 24 || harness.formula !== 24) problems.push(`harness: lane ${harness.lane}px, formula over the tokens ${harness.formula}px, source predicts 24px`);
    summary.lane = `${harness.lane}px`;

    // ── 2. chips at 1280 ────────────────────────────────────────────────────
    const chips = await page.evaluate(
      (MAIN) => {
        const box = (el) => {
          // A plain object: a DOMRect's sides are prototype getters, which do not cross back to the check.
          const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const shown = (el) => el.checkVisibility();
        const root = document.querySelector(MAIN);
        const c = (iso) => root.querySelector(`[role="gridcell"][data-day="${iso}"]`);
        const all = [...root.querySelectorAll(".r-dates-month-chip")];
        const visible = all.filter(shown);
        const dots = [...root.querySelectorAll(".r-dates-month-dots")].filter(shown);
        const bar = root.querySelector('.r-dates-month-chip[data-event="maintenance"]');
        const wed = c("2026-10-21");
        const oncall = [...root.querySelectorAll('.r-dates-month-chip[data-event="oncall-grace"]')].find((el) => c("2026-10-19").contains(el));
        const standup = wed.querySelector('.r-dates-month-chip[data-event="standup-21"]');
        const more = [...wed.querySelectorAll(".r-dates-month-chip:not([data-event])")][0];
        return {
          total: all.length,
          visible: visible.length,
          dots: dots.length,
          heights: visible.map((el) => box(el).height),
          bar: bar && { b: box(bar), from: box(c("2026-10-06")), to: box(c("2026-10-08")) },
          wed: oncall && standup && more && {
            oncall: box(oncall).top,
            standup: box(standup).top,
            more: box(more).top,
            moreBottom: box(more).bottom,
            moreText: more.textContent.trim(),
            moreLeft: box(more).left,
            moreRight: box(more).right,
            cell: box(wed),
          },
        };
      },
      MAIN,
    );
    if (!(chips.total > 20 && chips.visible === chips.total)) problems.push(`chips: ${chips.visible} of ${chips.total} chips shown at 1280, expected all (more than 20)`);
    if (chips.dots !== 0) problems.push(`chips: ${chips.dots} dot rows shown at 1280, expected none`);
    const offLane = chips.heights.filter((h) => Math.abs(h - harness.lane) > 0.5);
    if (offLane.length) problems.push(`chips: ${offLane.length} chips not one lane (${harness.lane}px) tall: ${offLane.slice(0, 4).join(", ")}`);
    if (!chips.bar) problems.push("chips: no maintenance bar found");
    else {
      const { b, from, to } = chips.bar;
      if (Math.abs(b.left - from.left) > 1 || Math.abs(b.right - to.right) > 1) {
        problems.push(`chips: the maintenance bar runs ${b.left.toFixed(1)}–${b.right.toFixed(1)}, its days' cells ${from.left.toFixed(1)}–${to.right.toFixed(1)}`);
      }
    }
    if (!chips.wed) problems.push("chips: on 21 October the on-call bar, the stand-up or '+n more' is missing");
    else {
      const w = chips.wed;
      const lane = harness.lane;
      if (w.moreText !== "+4 more") problems.push(`chips: 21 October shows "${w.moreText}", the schedule predicts "+4 more"`);
      if (Math.abs(w.standup - w.oncall - lane) > 0.5 || Math.abs(w.more - w.standup - lane) > 0.5) {
        problems.push(`chips: lanes on 21 October at ${w.oncall}, ${w.standup}, ${w.more}: not one ${lane}px lane apart`);
      }
      if (w.moreBottom > w.cell.bottom + 0.5 || w.moreLeft < w.cell.left - 0.5 || w.moreRight > w.cell.right + 0.5) {
        problems.push(`chips: "+4 more" (${w.moreLeft}–${w.moreRight}, bottom ${w.moreBottom}) is not inside its cell ${JSON.stringify(w.cell)}`);
      }
    }
    summary.chips = chips.visible;

    // ── 3. RTL: the bar mirrored, arrows follow the reading direction ───────
    await page.evaluate((MAIN) => document.querySelector(MAIN).setAttribute("dir", "rtl"), MAIN);
    await settle(page);
    const rtl = await page.evaluate((MAIN) => {
      const root = document.querySelector(MAIN);
      const r = (sel) => {
        const { left, right } = root.querySelector(sel).getBoundingClientRect();
        return { left, right };
      };
      return {
        bar: r('.r-dates-month-chip[data-event="maintenance"]'),
        from: r('[role="gridcell"][data-day="2026-10-06"]'),
        to: r('[role="gridcell"][data-day="2026-10-08"]'),
      };
    }, MAIN);
    if (!(rtl.from.left > rtl.to.left)) problems.push(`RTL: harness: 6 October's cell is not right of 8 October's (${rtl.from.left} vs ${rtl.to.left})`);
    if (Math.abs(rtl.bar.right - rtl.from.right) > 1 || Math.abs(rtl.bar.left - rtl.to.left) > 1) {
      problems.push(`RTL: the bar runs ${rtl.bar.left.toFixed(1)}–${rtl.bar.right.toFixed(1)}, expected ${rtl.to.left.toFixed(1)}–${rtl.from.right.toFixed(1)}`);
    }
    await cell(MAIN, "2026-10-15").focus();
    await page.keyboard.press("ArrowLeft");
    const rtlNext = await focused();
    await page.keyboard.press("ArrowRight");
    const rtlBack = await focused();
    if (rtlNext !== "2026-10-16" || rtlBack !== "2026-10-15") problems.push(`RTL: ArrowLeft from 15 October → ${rtlNext}, ArrowRight back → ${rtlBack}`);
    await page.evaluate((MAIN) => document.querySelector(MAIN).removeAttribute("dir"), MAIN);
    await settle(page);
    // The ar-EG demo, right to left in its own markup: each week runs from the right.
    const RTL = '[data-sc="event-calendar-rtl"]';
    const arWeek = await page.evaluate((RTL) => {
      const cells = [...document.querySelector(`${RTL} [role="row"]:nth-child(2)`).querySelectorAll('[role="gridcell"]')];
      const left = cells.map((c) => c.getBoundingClientRect().left);
      return { count: cells.length, fromRight: left.every((x, i) => i === 0 || x < left[i - 1]) };
    }, RTL);
    if (arWeek.count !== 7 || !arWeek.fromRight) problems.push(`RTL: the ar-EG demo's first week (${arWeek.count} cells) does not run right to left`);
    await cell(RTL, "2026-10-15").focus();
    await page.keyboard.press("ArrowLeft");
    const arNext = await focused();
    if (arNext !== "2026-10-16") problems.push(`RTL: ArrowLeft from 15 October in the ar-EG demo → ${arNext}`);

    // ── 4. dots in the narrow demo ──────────────────────────────────────────
    const dots = await page.evaluate(
      (NARROW) => {
        const px = (el, value) => {
          // A token resolved where it is read: a probe sized by it.
          const probe = document.createElement("span");
          probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
          el.appendChild(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        };
        const box = (el) => {
          // A plain object: a DOMRect's sides are prototype getters, which do not cross back to the check.
          const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const shown = (el) => el.checkVisibility();
        const root = document.querySelector(NARROW);
        const chips = [...root.querySelectorAll(".r-dates-month-chip")];
        const rows = [...root.querySelectorAll(".r-dates-month-dots")];
        const wed = root.querySelector('[role="gridcell"][data-day="2026-10-21"]');
        const cells = [...root.querySelectorAll('[role="gridcell"]')];
        return {
          chips: chips.length,
          chipsShown: chips.filter(shown).length,
          display: chips[0] && getComputedStyle(chips[0]).display,
          rows: rows.length,
          rowsShown: rows.filter(shown).length,
          wedDots: [...wed.querySelectorAll(".r-dates-event-dot")].filter(shown).length,
          wedText: wed.querySelector(".r-dates-month-dots").textContent.trim(),
          hit: px(wed, "var(--HIT-MIN)"),
          shortest: Math.min(...cells.map((c) => box(c).height)),
          cells: cells.length,
        };
      },
      NARROW,
    );
    if (!(dots.chips > 10)) problems.push(`dots: harness: the narrow demo renders ${dots.chips} chips (hidden), expected the month's`);
    if (dots.chipsShown !== 0 || dots.display !== "none") problems.push(`dots: ${dots.chipsShown} chips shown in the narrow demo (display ${dots.display})`);
    if (!(dots.rows > 0) || dots.rowsShown !== dots.rows) problems.push(`dots: ${dots.rowsShown} of ${dots.rows} dot rows shown in the narrow demo`);
    if (dots.wedDots !== 3 || dots.wedText !== "+3") problems.push(`dots: 21 October shows ${dots.wedDots} dots and "${dots.wedText}", expected 3 and "+3"`);
    if (!(dots.cells === 35 && dots.shortest >= dots.hit - 0.5)) problems.push(`dots: shortest of ${dots.cells} cells is ${dots.shortest}px, --HIT-MIN ${dots.hit}px`);

    // ── 5. the day panel ────────────────────────────────────────────────────
    const wed = cell(MAIN, "2026-10-21");
    await wed.scrollIntoViewIfNeeded();
    // On the day number, clear of every chip.
    await wed.click({ position: { x: 8, y: 8 } });
    await page.waitForFunction((MAIN) => document.querySelector(`${MAIN} [role="dialog"]`)?.contains(document.activeElement), MAIN, { timeout: 2000 });
    await settle(page);
    const panel = await page.evaluate(
      (MAIN) => {
        const px = (el, value) => {
          // A token resolved where it is read: a probe sized by it.
          const probe = document.createElement("span");
          probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
          el.appendChild(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        };
        const box = (el) => {
          // A plain object: a DOMRect's sides are prototype getters, which do not cross back to the check.
          const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const dialog = document.querySelector(`${MAIN} [role="dialog"]`);
        const c = document.querySelector(`${MAIN} [role="gridcell"][data-day="2026-10-21"]`);
        const p = box(dialog);
        const r = box(c);
        return {
          top: dialog.matches(":popover-open"),
          name: document.getElementById(dialog.getAttribute("aria-labelledby"))?.textContent,
          items: dialog.querySelectorAll("li").length,
          gap: px(c, "var(--R-SIZE-4)"),
          below: p.top - r.bottom,
          above: r.top - p.bottom,
          centre: (p.left + p.right) / 2 - (r.left + r.right) / 2,
          state: document.querySelector('[data-sc="event-calendar-state"]').textContent.trim(),
        };
      },
      MAIN,
    );
    if (!panel.top) problems.push("panel: the day panel is not in the top layer");
    if (!/October 21|21 October/.test(panel.name ?? "") || panel.items !== 6) problems.push(`panel: named "${panel.name}" with ${panel.items} events, expected 21 October's six`);
    if (!(Math.abs(panel.below - panel.gap) <= 1 || Math.abs(panel.above - panel.gap) <= 1)) {
      problems.push(`panel: ${panel.below.toFixed(1)}px below / ${panel.above.toFixed(1)}px above its cell, expected --R-SIZE-4 (${panel.gap}px)`);
    }
    if (Math.abs(panel.centre) > 1) problems.push(`panel: centred ${panel.centre.toFixed(1)}px off its cell`);
    if (!panel.state.startsWith("month · 2026-10-21")) problems.push(`panel: the demo's date reads "${panel.state}" after the press, expected 2026-10-21`);
    await page.keyboard.press("Escape");
    await settle(page);
    const afterEscape = { focus: await focused(), panel: await page.locator(`${MAIN} [role="dialog"]`).count() };
    if (afterEscape.focus !== "2026-10-21" || afterEscape.panel !== 0) problems.push(`panel: after Escape focus is on ${afterEscape.focus} and ${afterEscape.panel} panel(s) remain`);

    // ── 6. keyboard paging keeps focus ──────────────────────────────────────
    const at = async () => ({
      focus: await focused(),
      grid: await page.locator(`${MAIN} [role="grid"]`).getAttribute("aria-label"),
      state: (await page.locator('[data-sc="event-calendar-state"]').textContent()).trim(),
    });
    const steps = [
      [["PageDown"], "2026-11-21", "November 2026"],
      [["ArrowDown", "ArrowDown"], "2026-12-05", "December 2026"],
      [["Shift+PageUp"], "2025-12-05", "December 2025"],
    ];
    for (const [keys, day, month] of steps) {
      for (const key of keys) await page.keyboard.press(key);
      const now = await at();
      if (now.focus !== day || now.grid !== month || !now.state.startsWith(`month · ${day}`)) {
        problems.push(`paging: ${keys.join(", ")} → focus ${now.focus}, grid "${now.grid}", state "${now.state}"; expected ${day} in "${month}"`);
      }
    }

    // ── 7. coarse input ─────────────────────────────────────────────────────
    await open(1280, { input: "coarse" });
    const coarse = await page.evaluate(
      (MAIN) => {
        const px = (el, value) => {
          // A token resolved where it is read: a probe sized by it.
          const probe = document.createElement("span");
          probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
          el.appendChild(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        };
        const box = (el) => {
          // A plain object: a DOMRect's sides are prototype getters, which do not cross back to the check.
          const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const shown = (el) => el.checkVisibility();
        const root = document.querySelector(MAIN);
        const cellEl = root.querySelector('[role="gridcell"]');
        const visible = [...root.querySelectorAll(".r-dates-month-chip")].filter(shown);
        return {
          hit: px(cellEl, "var(--HIT-MIN)"),
          lane: px(cellEl, "var(--r-dates-month-lane)"),
          count: visible.length,
          more: visible.filter((el) => !el.dataset.event).length,
          short: visible.map((el) => box(el).height).filter((h) => h < px(cellEl, "var(--HIT-MIN)") - 0.5),
        };
      },
      MAIN,
    );
    if (coarse.hit !== 44 || coarse.lane !== 44) problems.push(`coarse: lane ${coarse.lane}px, --HIT-MIN ${coarse.hit}px, expected 44`);
    if (!(coarse.count > 20 && coarse.more > 0)) problems.push(`coarse: harness: ${coarse.count} chips (${coarse.more} "+n more") shown`);
    if (coarse.short.length) problems.push(`coarse: ${coarse.short.length} chips under --HIT-MIN: ${coarse.short.slice(0, 4).join(", ")}`);

    // ── 8. forced colours ───────────────────────────────────────────────────
    await setView(page, { forced: true, input: "fine" });
    await cell(MAIN, "2026-10-15").focus();
    await page.keyboard.press("ArrowRight");
    const forced = await page.evaluate((MAIN) => {
      const opaque = (c) => !/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent";
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const root = document.querySelector(MAIN);
      const faces = [...root.querySelectorAll(".r-dates-month-chip[data-event] .r-dates-month-chip-face")].filter((f) => f.checkVisibility());
      const edges = faces.map((f) => {
        const cs = getComputedStyle(f);
        return Number.parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor !== bgOf(f);
      });
      const badge = root.querySelector('[role="gridcell"][data-day="2026-10-15"] .r-dates-month-number');
      const focusedCell = document.activeElement;
      const ring = getComputedStyle(focusedCell);
      return {
        faces: faces.length,
        edgeless: edges.filter((ok) => !ok).length,
        badge: getComputedStyle(badge).backgroundColor !== bgOf(badge.parentElement),
        focus: focusedCell?.dataset?.day,
        ring: ring.outlineStyle === "solid" && Number.parseFloat(ring.outlineWidth) > 0 && ring.outlineColor !== bgOf(focusedCell),
      };
    }, MAIN);
    if (!(forced.faces > 20)) problems.push(`forced colours: harness: ${forced.faces} chip faces shown`);
    if (forced.edgeless) problems.push(`forced colours: ${forced.edgeless} of ${forced.faces} chips lose their edge`);
    if (!forced.badge) problems.push("forced colours: today's badge paints in its cell's colour");
    if (forced.focus !== "2026-10-16" || !forced.ring) problems.push(`forced colours: the focused cell (${forced.focus}) shows no solid ring`);
    await setView(page, { forced: false });

    // ── 9. at 375 ───────────────────────────────────────────────────────────
    await open(375);
    const last = cell(MAIN, "2026-10-31");
    await last.scrollIntoViewIfNeeded();
    await last.click({ position: { x: 4, y: 4 } });
    await page.waitForFunction((MAIN) => document.querySelector(`${MAIN} [role="dialog"]`)?.matches(":popover-open"), MAIN, { timeout: 2000 });
    await settle(page);
    const narrow = await page.evaluate(() => {
      const root = document.documentElement;
      const dialog = document.querySelector('[data-sc="event-calendar-main"] [role="dialog"]').getBoundingClientRect();
      const spills = [];
      for (const c of document.querySelectorAll('[data-sc^="event-calendar-"] .r-dates-month-cell')) {
        const r = c.getBoundingClientRect();
        for (const child of c.querySelectorAll("*")) {
          if (!child.checkVisibility() || child.closest(".r-dates-month-chip")) continue;
          const k = child.getBoundingClientRect();
          if (k.width === 0) continue;
          if (k.left < r.left - 0.5 || k.right > r.right + 0.5) spills.push(`${c.dataset.day}: ${child.className}`);
        }
      }
      return {
        scroll: root.scrollWidth - root.clientWidth,
        left: dialog.left,
        right: root.clientWidth - dialog.right,
        dots: [...document.querySelectorAll('[data-sc="event-calendar-main"] .r-dates-month-dots')].filter((d) => d.checkVisibility()).length,
        spills,
      };
    });
    if (narrow.dots === 0) problems.push("375: the main demo shows no dots (expected the narrow look)");
    if (narrow.scroll > 0) problems.push(`375: the page scrolls sideways by ${narrow.scroll}px with the panel open`);
    if (!(narrow.left >= 0 && narrow.right >= 0)) problems.push(`375: the panel is outside the viewport (left ${narrow.left}, right gap ${narrow.right})`);
    if (narrow.spills.length) problems.push(`375: content past its cell: ${narrow.spills.slice(0, 5).join("; ")}`);
    await page.keyboard.press("Escape");
  } finally {
    stopErrors();
  }

  if (errors.length) problems.push(...errors);
  if (problems.length) throw new Error(problems.join("\n"));
  return `event month ok: lane ${summary.lane}, ${summary.chips} chips at 1280; bar and lanes; RTL mirrored; dots narrow; panel in the top layer; paging keeps focus; coarse 44px; forced edges; 375 inside`;
}
