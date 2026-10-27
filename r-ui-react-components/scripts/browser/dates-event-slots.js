// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: the EventCalendar's slot layer (TimeGridSlots), where a range is picked in
// the week and day views, which jsdom cannot lay out, hit test or drag. The key model, the
// names and the commit counts are TimeGridSlots.test.tsx's.
//
// On the EventCalendar section's editable demo (`event-calendar-edit`: a week, Sunday 11 –
// Saturday 17 October 2026, 30-minute slots, its app state printed as "selection: <ISO> →
// <ISO> · last: …" or "selection: none"), it asserts:
//   1. harness: `--ROW-H` at the slot layer is 40px (comfortable + fine, from source), the
//      layer holds 48 rows of 7 gridcells, and every cell is 2 × --ROW-H × 30/60 = 40px tall;
//   2. every cell's column is its day's column and every hour's first cell starts on that
//      hour's line (±1px); a fine pointer over a cell washes it, and nothing else;
//   3. Tab reaches the slot grid; the cursor's cell then shows a solid ring of --FOCUS-WIDTH
//      (its ::after; the layer itself none), in view below the sticky header, and ArrowDown
//      moves it;
//   4. Shift+ArrowDown ×3 draws one draft piece over exactly Thursday 08:00–10:00; Enter
//      prints that range; Escape prints "selection: none"; Shift+ArrowLeft then Enter picks
//      Wednesday 09:30 – Thursday 10:00, drawn as two pieces (over midnight) over exactly
//      those slots;
//   5. a real mouse drag from Thursday 10:00 to the 11:30 slot draws its draft while held and
//      picks 10:00–12:00; a drag from Wednesday 14:00 forward to Thursday 10:00 draws two
//      pieces (over midnight) and picks 14:00 – 10:30, and one from Thursday 11:00 back to
//      Wednesday 15:00 picks 15:00 – 11:30;
//   5b. with a range picked, a new press shows only its own slot the moment the button goes
//      down (the old range gone), and its release picks that slot;
//   6. a press on an event (the Interview, Thursday 13:00) is the event's, and abandons the
//      range picked in 5b: the state reads no range;
//   7. edge auto-scroll: a drag held at the region's bottom edge scrolls the region and the
//      range it picks ends past the slot that was at the edge before;
//   8. RTL: with `dir="rtl"` on the demo, ArrowLeft moves the cursor to the next day, drawn
//      left of the one before;
//   9. forced colours: a keyboard draft keeps a visible dashed edge and the cursor a solid ring;
//  10. coarse: a cell is 2 × --ROW-H × 30/60 at the coarse --ROW-H (44px), and a press still
//      picks its slot.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /event|calendar|slot|timegrid/i.test(text) });
  const ROOT = '[data-sc="event-calendar-edit"]';
  const REGION = `${ROOT} [data-timegrid]`;
  const LAYER = `${ROOT} [data-slots]`;
  const OUT = '[data-sc="event-calendar-edit-state"]';
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  const view = { theme: "default", density: "comfortable", input: "fine" };

  /** A cell's box (client px) and centre. */
  const cellBox = (iso, minute) =>
    page.evaluate(
      ({ LAYER, iso, minute }) => {
        const el = document.querySelector(`${LAYER} [data-slot-day="${iso}"][data-slot-minute="${minute}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      { LAYER, iso, minute },
    );
  /** The ISO instants the demo prints for 2026-10-<d> at h:m, built in the page's zone. */
  const iso = (d, h, m = 0) => page.evaluate(([d, h, m]) => new Date(2026, 9, d, h, m).toISOString(), [d, h, m]);
  const selectionText = async (from, to) => (from ? `selection: ${await iso(...from)} → ${await iso(...to)}` : "selection: none");
  /** Waits (at most 2s) for the demo to print `want`, then says what it printed instead. */
  const expectState = async (label, from, to) => {
    const want = await selectionText(from, to);
    await page.waitForFunction(({ OUT, want }) => document.querySelector(OUT)?.textContent.includes(want), { OUT, want }, { timeout: 2000 }).catch(() => {});
    const text = await page.evaluate((OUT) => document.querySelector(OUT)?.textContent ?? "", OUT);
    if (!text.includes(want)) problems.push(`${label}: the demo prints "${text}", expected "${want}"`);
  };
  /**
   * The draft pieces of `kind` against `expected` ([iso, fromMinute, toMinute] per day): each
   * piece inside its day's column, its top on the first slot's top and its bottom on the
   * last slot's bottom (±1px).
   */
  const checkPieces = async (label, kind, expected) => {
    const found = await page.evaluate(
      ({ ROOT, LAYER, kind, expected }) => {
        const columns = [...document.querySelectorAll(`${ROOT} .r-dates-timegrid-day[data-day]`)].map((c) => ({ iso: c.dataset.day, r: c.getBoundingClientRect() }));
        const cell = (iso, minute) => document.querySelector(`${LAYER} [data-slot-day="${iso}"][data-slot-minute="${minute}"]`)?.getBoundingClientRect();
        const slot = Number(getComputedStyle(document.querySelector(LAYER)).getPropertyValue("--r-dates-slot"));
        const pieces = [...document.querySelectorAll(`${LAYER} [data-slots-draft="${kind}"]`)].map((el) => {
          const r = el.getBoundingClientRect();
          const col = columns.find((c) => r.left + r.width / 2 >= c.r.left && r.left + r.width / 2 <= c.r.right);
          return { iso: col?.iso, top: r.top, bottom: r.bottom, inside: Boolean(col) && r.left >= col.r.left - 1 && r.right <= col.r.right + 1 };
        });
        const out = [];
        if (pieces.length !== expected.length) out.push(`${pieces.length} piece(s), expected ${expected.length}`);
        for (const [iso, from, to] of expected) {
          const p = pieces.find((x) => x.iso === iso);
          const first = cell(iso, from);
          const last = cell(iso, to - slot);
          if (!p) out.push(`no piece on ${iso}`);
          else if (!first || !last) out.push(`harness: no cell ${iso} ${from}/${to - slot}`);
          else {
            if (!p.inside) out.push(`the ${iso} piece reaches outside its column`);
            if (Math.abs(p.top - first.top) > 1 || Math.abs(p.bottom - last.bottom) > 1) {
              out.push(`the ${iso} piece spans ${p.top.toFixed(1)}–${p.bottom.toFixed(1)}px, its slots ${first.top.toFixed(1)}–${last.bottom.toFixed(1)}px`);
            }
          }
        }
        return out;
      },
      { ROOT, LAYER, kind, expected },
    );
    for (const f of found) problems.push(`${label}: ${f}`);
  };
  /** Tab from the region until the slot layer has focus (at most 30 presses). */
  const tabToSlots = async () => {
    await page.evaluate((REGION) => document.querySelector(REGION).focus({ preventScroll: true }), REGION);
    for (let i = 0; i < 30; i += 1) {
      if (await page.evaluate((LAYER) => document.activeElement === document.querySelector(LAYER), LAYER)) return true;
      await page.keyboard.press("Tab");
    }
    return false;
  };
  /** The cursor's cell and its ring, and the layer's own outline. */
  const cursor = () =>
    page.evaluate(
      ({ LAYER, REGION }) => {
        const layer = document.querySelector(LAYER);
        const cell = document.getElementById(layer.getAttribute("aria-activedescendant"));
        // The ring is the cell's ::after (raised, so it shows over an event, and press-through).
        const cs = getComputedStyle(cell, "::after");
        const r = cell.getBoundingClientRect();
        const region = document.querySelector(REGION).getBoundingClientRect();
        const head = document.querySelector(`${REGION} [data-timegrid-head]`).getBoundingClientRect();
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--FOCUS-WIDTH)";
        layer.appendChild(probe);
        const focusWidth = probe.getBoundingClientRect().width;
        probe.remove();
        return {
          day: cell.dataset.slotDay,
          minute: Number(cell.dataset.slotMinute),
          left: r.left,
          ring: { style: cs.outlineStyle, width: Number.parseFloat(cs.outlineWidth) },
          focusWidth,
          layerOutline: Number.parseFloat(getComputedStyle(layer).outlineWidth) || 0,
          focused: document.activeElement === layer && layer.matches(":focus-visible"),
          inView: r.top >= head.bottom - 1 && r.bottom <= region.bottom + 1,
        };
      },
      { LAYER, REGION },
    );
  /** Region scrolled so `minute` is just under the header. */
  const scrollTo = (minute) =>
    page.evaluate(
      ({ REGION, LAYER, minute }) => {
        const region = document.querySelector(REGION);
        const head = region.querySelector("[data-timegrid-head]").getBoundingClientRect();
        const cell = document.querySelector(`${LAYER} [data-slot-minute="${minute}"]`).getBoundingClientRect();
        region.scrollTop += cell.top - head.bottom;
      },
      { REGION, LAYER, minute },
    );
  /** A real mouse drag in small steps, `during` measured before the release. */
  const drag = async (from, to, during) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 6, { steps: 2 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    if (during) await during();
    await page.mouse.up();
  };
  const clearByKeys = async () => {
    await page.evaluate((LAYER) => document.querySelector(LAYER).focus({ preventScroll: true }), LAYER);
    await page.keyboard.press("Escape");
    await expectState("clear", null);
  };

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await openSection(page, "dates-eventcalendar", { width: 1280, height: 1100, view });
    await page.locator(LAYER).waitFor();
    // The demo's top a little under the page's top, whatever scrolls the page: everything
    // pressed below is then inside the viewport and clear of the showcase's sticky bar.
    await page.evaluate((ROOT) => {
      const root = document.querySelector(ROOT);
      root.scrollIntoView({ block: "start" });
      let scroller = root.parentElement;
      while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
      (scroller ?? document.scrollingElement).scrollTop += root.getBoundingClientRect().top - 120;
    }, ROOT);
    const h = await page.evaluate(
      ({ LAYER, ROOT }) => {
        const layer = document.querySelector(LAYER);
        const rows = [...layer.querySelectorAll('[role="row"]')];
        const cells = [...layer.querySelectorAll('[role="gridcell"]')];
        const columns = [...document.querySelectorAll(`${ROOT} .r-dates-timegrid-day[data-day]`)].map((c) => ({ iso: c.dataset.day, r: c.getBoundingClientRect() }));
        const lines = [...document.querySelectorAll(`${ROOT} .r-dates-timegrid-body [data-hour]`)].map((l) => l.getBoundingClientRect().top);
        const misplaced = [];
        for (const el of cells) {
          const r = el.getBoundingClientRect();
          const col = columns.find((c) => c.iso === el.dataset.slotDay);
          if (!col || Math.abs(r.left - col.r.left) > 1 || Math.abs(r.right - col.r.right) > 1) misplaced.push(`${el.dataset.slotDay} ${el.dataset.slotMinute}: column`);
          const minute = Number(el.dataset.slotMinute);
          if (minute % 60 === 0 && Math.abs(r.top - lines[minute / 60]) > 1) misplaced.push(`${el.dataset.slotDay} ${minute}: ${(r.top - lines[minute / 60]).toFixed(1)}px off its hour line`);
        }
        return {
          rowH: Number.parseFloat(getComputedStyle(layer).getPropertyValue("--ROW-H")),
          rows: rows.length,
          perRow: rows[0]?.querySelectorAll('[role="gridcell"]').length,
          heights: cells.map((el) => el.getBoundingClientRect().height),
          columns: columns.length,
          lines: lines.length,
          misplaced,
          hover: matchMedia("(hover: hover)").matches,
        };
      },
      { LAYER, ROOT },
    );
    const cellH = 2 * h.rowH * (30 / 60);
    if (h.rowH !== 40) problems.push(`harness: --ROW-H at the slot layer is ${h.rowH}px, source predicts 40px`);
    if (h.rows !== 48 || h.perRow !== 7) problems.push(`harness: ${h.rows} rows of ${h.perRow} cells, expected 48 of 7`);
    const offHeight = h.heights.filter((x) => !near(x, cellH, 0.5));
    if (!h.heights.length || offHeight.length) problems.push(`rows: ${offHeight.length} of ${h.heights.length} cells not ${cellH}px tall (${offHeight[0]}px)`);
    summary.cellH = cellH;

    // ── 2. cells on the days' columns and hour lines; the hover wash ────────
    if (h.columns !== 7 || h.lines !== 24) problems.push(`align: harness: ${h.columns} day columns, ${h.lines} hour lines`);
    for (const m of h.misplaced.slice(0, 5)) problems.push(`align: ${m}`);
    if (h.misplaced.length > 5) problems.push(`align: … ${h.misplaced.length - 5} more`);
    if (!h.hover) problems.push("hover: harness: (hover: hover) does not match");
    const wash = async (point) => {
      await page.mouse.move(point.x, point.y);
      return page.evaluate((LAYER) => [...document.querySelectorAll(`${LAYER} [role="gridcell"]`)].filter((el) => !/rgba\(.*,\s*0\)$|transparent/.test(getComputedStyle(el).backgroundColor)).map((el) => `${el.dataset.slotDay} ${el.dataset.slotMinute}`), LAYER);
    };
    const c9 = await cellBox("2026-10-16", 540);
    const washed = await wash(c9);
    if (washed.join() !== "2026-10-16 540") problems.push(`hover: washed cells under Friday 09:00: ${JSON.stringify(washed)}`);
    const region = await page.evaluate((REGION) => {
      const r = document.querySelector(REGION).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }, REGION);
    const away = await wash({ x: region.right + 40, y: region.top - 40 });
    if (away.length) problems.push(`hover: ${away.length} cell(s) still washed with the pointer away`);

    // ── 3. Tab to the slots; the cursor's ring moves ────────────────────────
    if (!(await tabToSlots())) problems.push("keys: Tab never reached the slot grid");
    const c0 = await cursor();
    if (!c0.focused) problems.push("keys: the slot grid is not keyboard-focused (:focus-visible) after Tab");
    if (`${c0.day} ${c0.minute}` !== "2026-10-15 480") problems.push(`keys: the cursor starts on ${c0.day} ${c0.minute}, expected Thursday 08:00`);
    if (c0.ring.style !== "solid" || !near(c0.ring.width, c0.focusWidth, 0.5) || !(c0.ring.width > 0)) problems.push(`keys: the cursor's ring ${JSON.stringify(c0.ring)}, expected solid --FOCUS-WIDTH (${c0.focusWidth}px)`);
    if (c0.layerOutline !== 0) problems.push(`keys: the layer draws its own ${c0.layerOutline}px outline around the whole day`);
    if (!c0.inView) problems.push("keys: the cursor's cell is not in view below the header");
    await page.keyboard.press("ArrowDown");
    const c1 = await cursor();
    if (`${c1.day} ${c1.minute}` !== "2026-10-15 510" || c1.ring.style !== "solid") problems.push(`keys: ArrowDown put the cursor on ${c1.day} ${c1.minute} with ring ${c1.ring.style}`);
    const stale = await page.evaluate((LAYER) => getComputedStyle(document.querySelector(`${LAYER} [data-slot-day="2026-10-15"][data-slot-minute="480"]`), "::after").outlineStyle, LAYER);
    if (stale !== "none") problems.push(`keys: the cell the cursor left still draws a ${stale} ring`);
    await page.keyboard.press("ArrowUp");

    // ── 4. Shift+arrows, Enter, Escape; over midnight ───────────────────────
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Shift+ArrowDown");
    await checkPieces("keys draft", "draft", [["2026-10-15", 480, 600]]);
    await page.keyboard.press("Enter");
    await expectState("keys Enter", [15, 8], [15, 10]);
    await checkPieces("keys picked", "selection", [["2026-10-15", 480, 600]]);
    await page.keyboard.press("Escape");
    await expectState("keys Escape", null);
    await page.keyboard.press("Shift+ArrowLeft");
    await checkPieces("keys over midnight", "draft", [
      ["2026-10-14", 570, 1440],
      ["2026-10-15", 0, 600],
    ]);
    await page.keyboard.press("Enter");
    await expectState("keys over midnight", [14, 9, 30], [15, 10]);
    await page.keyboard.press("Escape");
    await expectState("keys Escape again", null);

    // ── 5. mouse drags ──────────────────────────────────────────────────────
    // 09:00 under the header before each: both ends of a drag then sit well inside the
    // region, out of its edge-scrolling bands.
    await scrollTo(540);
    await drag(await cellBox("2026-10-15", 600), await cellBox("2026-10-15", 690), () => checkPieces("drag (held)", "draft", [["2026-10-15", 600, 720]]));
    await expectState("drag 10:00 → 11:30", [15, 10], [15, 12]);
    await clearByKeys();
    await scrollTo(540);
    await drag(await cellBox("2026-10-14", 840), await cellBox("2026-10-15", 600), () =>
      checkPieces("drag Wed → Thu (held)", "draft", [
        ["2026-10-14", 840, 1440],
        ["2026-10-15", 0, 630],
      ]),
    );
    await expectState("drag Wed 14:00 → Thu 10:00", [14, 14], [15, 10, 30]);
    await clearByKeys();
    await scrollTo(540);
    await drag(await cellBox("2026-10-15", 660), await cellBox("2026-10-14", 900));
    await expectState("drag Thu 11:00 → Wed 15:00", [14, 15], [15, 11, 30]);

    // ── 5b. a new press replaces that range the moment the button goes down ──
    const other = await cellBox("2026-10-16", 600);
    await page.mouse.move(other.x, other.y);
    await page.mouse.down();
    const held = await page.evaluate(
      (LAYER) => ({
        old: document.querySelectorAll(`${LAYER} [data-slots-draft="selection"]`).length,
        draft: document.querySelectorAll(`${LAYER} [data-slots-draft="draft"]`).length,
      }),
      LAYER,
    );
    if (held.old !== 0 || held.draft !== 1) {
      problems.push(`press: with the button down, ${held.old} piece(s) of the old range and ${held.draft} of the new, expected 0 and 1`);
    }
    await page.mouse.up();
    await expectState("press Fri 10:00", [16, 10], [16, 10, 30]);
    // Left picked: the next step's press on an event must clear it.

    // ── 6. a press on an event is the event's ───────────────────────────────
    await scrollTo(720);
    const ev = await page.evaluate((ROOT) => {
      const el = [...document.querySelectorAll(`${ROOT} .r-dates-timegrid-body [data-event]`)].find((e) => /Interview/.test(e.getAttribute("aria-label") ?? e.textContent));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest("[data-event]")) };
    }, ROOT);
    if (!ev) problems.push("event press: harness: no Interview block in the demo");
    else {
      if (!ev.hit) problems.push("event press: the Interview block is not what a press at its centre hits");
      // A range is picked (5b): opening an event abandons it.
      await page.mouse.click(ev.x, ev.y);
      await expectState("event press", null);
    }

    // ── 7. edge auto-scroll ─────────────────────────────────────────────────
    await scrollTo(480);
    const edge = await page.evaluate(
      ({ REGION, LAYER }) => {
        const region = document.querySelector(REGION);
        const r = region.getBoundingClientRect();
        const y = r.bottom - 8;
        const lines = [...document.querySelectorAll(`${REGION} .r-dates-timegrid-body [data-hour]`)].map((l) => l.getBoundingClientRect().top);
        const thu = document.querySelector(`${LAYER} [data-slot-day="2026-10-15"]`).getBoundingClientRect();
        return { x: thu.left + thu.width / 2, y, minute: ((y - lines[0]) / (lines[1] - lines[0])) * 60, scrollTop: region.scrollTop };
      },
      { REGION, LAYER },
    );
    const start = await cellBox("2026-10-15", 600);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 6, { steps: 2 });
    await page.mouse.move(edge.x, edge.y, { steps: 12 });
    const scrolled = await page
      .waitForFunction(({ REGION, before }) => document.querySelector(REGION).scrollTop > before + 120, { REGION, before: edge.scrollTop }, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    await page.mouse.up();
    if (!scrolled) problems.push(`edge scroll: holding the drag at the region's bottom edge did not scroll it 120px within 3s (scrollTop was ${edge.scrollTop})`);
    const picked = await page.evaluate(
      ({ OUT }) => {
        const m = document.querySelector(OUT)?.textContent.match(/selection: (\S+) → (\S+)/);
        if (!m) return null;
        const end = new Date(m[2]);
        return { start: new Date(m[1]).getTime() === new Date(2026, 9, 15, 10).getTime(), endMinute: (end.getTime() - new Date(2026, 9, 15).getTime()) / 60_000 };
      },
      { OUT },
    );
    if (!picked) problems.push("edge scroll: no range picked");
    else if (!picked.start || !(picked.endMinute > edge.minute + 60)) {
      problems.push(`edge scroll: picked from 10:00 ${picked.start} to minute ${picked.endMinute}; the edge was at minute ${edge.minute.toFixed(0)} before scrolling`);
    }
    summary.edgeEnd = picked?.endMinute;
    await clearByKeys();

    // ── 8. RTL ──────────────────────────────────────────────────────────────
    await page.evaluate((ROOT) => document.querySelector(ROOT).setAttribute("dir", "rtl"), ROOT);
    await settle(page);
    if (!(await tabToSlots())) problems.push("RTL: Tab never reached the slot grid");
    const r0 = await cursor();
    await page.keyboard.press("ArrowLeft");
    const r1 = await cursor();
    const dir = await page.evaluate((LAYER) => getComputedStyle(document.querySelector(LAYER)).direction, LAYER);
    await page.evaluate((ROOT) => document.querySelector(ROOT).removeAttribute("dir"), ROOT);
    if (dir !== "rtl") problems.push(`RTL: harness: the layer's direction is ${dir}`);
    if (r0.day === "2026-10-17") problems.push("RTL: harness: the cursor starts on the view's last day");
    const next = new Date(`${r0.day}T12:00:00`);
    next.setDate(next.getDate() + 1);
    const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    if (r1.day !== nextIso || !(r1.left < r0.left)) problems.push(`RTL: ArrowLeft moved the cursor from ${r0.day} to ${r1.day} (x ${r0.left.toFixed(0)} → ${r1.left.toFixed(0)}), expected ${nextIso} to its left`);
    await settle(page);

    // ── 9. forced colours ───────────────────────────────────────────────────
    await setView(page, { forced: true });
    if (!(await tabToSlots())) problems.push("forced colours: Tab never reached the slot grid");
    await page.keyboard.press("Shift+ArrowDown");
    const forced = await page.evaluate((LAYER) => {
      const opaque = (c) => c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const layer = document.querySelector(LAYER);
      const piece = layer.querySelector('[data-slots-draft="draft"]');
      const ps = piece && getComputedStyle(piece);
      const cell = document.getElementById(layer.getAttribute("aria-activedescendant"));
      const cs = getComputedStyle(cell, "::after");
      return {
        forced: matchMedia("(forced-colors: active)").matches,
        piece: ps && { style: ps.borderTopStyle, width: Number.parseFloat(ps.borderTopWidth), differs: ps.borderTopColor !== bgOf(layer) },
        ring: { style: cs.outlineStyle, width: Number.parseFloat(cs.outlineWidth) },
      };
    }, LAYER);
    await page.keyboard.press("Escape");
    await setView(page, { forced: false });
    if (!forced.forced) problems.push("forced colours: harness: the media query does not match");
    if (!forced.piece || forced.piece.style !== "dashed" || !(forced.piece.width > 0) || !forced.piece.differs) problems.push(`forced colours: the draft's edge ${JSON.stringify(forced.piece)}`);
    if (forced.ring.style !== "solid" || !(forced.ring.width > 0)) problems.push(`forced colours: the cursor's ring ${JSON.stringify(forced.ring)}`);

    // ── 10. coarse ──────────────────────────────────────────────────────────
    await setView(page, { input: "coarse" });
    const coarse = await page.evaluate((LAYER) => {
      const layer = document.querySelector(LAYER);
      const cell = layer.querySelector('[data-slot-day="2026-10-15"][data-slot-minute="900"]');
      return { rowH: Number.parseFloat(getComputedStyle(layer).getPropertyValue("--ROW-H")), h: cell.getBoundingClientRect().height };
    }, LAYER);
    if (coarse.rowH !== 44) problems.push(`coarse: harness: --ROW-H ${coarse.rowH}px, source predicts 44px`);
    if (!near(coarse.h, 2 * coarse.rowH * (30 / 60), 0.5)) problems.push(`coarse: a cell is ${coarse.h}px, expected ${2 * coarse.rowH * (30 / 60)}px`);
    await scrollTo(840);
    const c15 = await cellBox("2026-10-15", 900);
    await page.mouse.click(c15.x, c15.y);
    await expectState("coarse press", [15, 15], [15, 15, 30]);
    await clearByKeys();
    await setView(page, { input: "fine" });

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`dates-event-slots FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-slots OK (${JSON.stringify(summary)})`;
}
