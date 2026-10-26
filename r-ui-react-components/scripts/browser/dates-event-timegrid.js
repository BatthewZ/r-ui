// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: the EventCalendar's week and day time grid, which jsdom cannot lay out.
//
// Run it through `bun run browser:check dates-event-timegrid`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print dates-event-timegrid)"
//
// Asserts, on the EventCalendar section's week demo (`event-calendar-week`, Sunday 11 –
// Saturday 17 October 2026, the clock at Thursday 15 10:40) and its compact day demo
// (`event-calendar-compact`); names, keys and the custom properties' values are
// EventTimeGrid.test.tsx's:
//   1. harness: `--ROW-H` at the week grid resolves to 40px (comfortable + fine, from source),
//      and the grid holds the seven days with Thursday's five events;
//   2. an hour is exactly 2 × `--ROW-H` (each hour line's box, and hour 9's top from hour 8's);
//   3. every block's top and height match its minutes (`--r-dates-start` / `--r-dates-end`)
//      at two `--ROW-H` an hour, ±1px, and three blocks match their source times read
//      independently (the review 10:00–11:00, the stand-up drawn its 30-minute minimum, the
//      migration's Friday part 23:00–24:00);
//   4. the three overlapping Thursday meetings sit side by side in their column, in column
//      order, none overlapping another and each inside the column;
//   5. the now line sits in Thursday only, centred at 10:40 (±1px);
//   6. on load the grid is scrolled so 08:00 is at its top, just under the sticky header (±1px);
//   7. scrolled down (and back part way up) the header stays on the grid's top edge, painted
//      over the days; End moves focus to Saturday's 00:00 block and scrolls it into view
//      below the header, not under it;
//   8. at 375: the grid scrolls sideways and the page does not; scrolled to its end (and back
//      part way) the hour gutter and the header's corner stay on the inline start edge, painted
//      over the days; Home brings Monday's block back into view clear of the gutter;
//   9. compact: the day demo's `--ROW-H` is 30px (harness) and its hour 60px, shorter than the
//      week's;
//  10. coarse: every target in the week grid (blocks, bars, day headers) is at least `--HIT-MIN`
//      on both axes, the 30-minute stand-up exactly one `--ROW-H`, and Thursday's three
//      overlapping blocks each at least `--HIT-MIN` wide;
//  11. RTL: with `dir="rtl"` the gutter sits right of the days (Sunday next to it) and the
//      first overlap column is the rightmost;
//  12. forced colours: every Thursday block keeps a visible edge, the now line a visible
//      border, and a block focused by keys a solid ring.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /eventcalendar|timegrid|time grid/i.test(text) });
  const WEEK = '[data-sc="event-calendar-week"] [data-timegrid]';
  const COMPACT = '[data-sc="event-calendar-compact"] [data-timegrid]';
  const view = (input = "fine") => ({ theme: "default", density: "comfortable", input });
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

  const load = async (width, input) => {
    await openSection(page, "dates-eventcalendar", { width, view: view(input) });
    await page.locator(WEEK).waitFor();
  };
  // The grid's top edge a fifth of the way down the viewport, whatever scrolls the page:
  // the points hit tested below are then clear of the showcase's own sticky chrome and
  // inside the viewport. (Centring the header cannot: it sticks to the top of a grid
  // taller than the viewport, which lands the grid's top under the showcase's bar.)
  const centre = () =>
    page.evaluate((sel) => {
      const grid = document.querySelector(sel);
      grid.scrollIntoView({ block: "start" });
      // The page's scroller: the nearest ancestor that scrolls vertically, else the document.
      let scroller = grid.parentElement;
      while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) {
        scroller = scroller.parentElement;
      }
      (scroller ?? document.scrollingElement).scrollTop += grid.getBoundingClientRect().top - innerHeight / 5;
    }, WEEK);

  /** The week grid's geometry, measured in the page. */
  const measure = (sel) =>
    page.evaluate((sel) => {
      const tokenPx = (el, name) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;block-size:var(${name})`;
        el.appendChild(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        return h;
      };
      const root = document.querySelector(sel);
      const body = root.querySelector(".r-dates-timegrid-body");
      const col = (iso) => body.querySelector(`[data-day="${iso}"]`);
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const blocks = [...body.querySelectorAll("[data-block]")].map((el) => {
        const c = el.closest("[data-day]");
        const cr = c.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.block,
          event: el.dataset.event,
          day: c.dataset.day,
          start: Number(el.style.getPropertyValue("--r-dates-start")),
          end: Number(el.style.getPropertyValue("--r-dates-end")),
          column: Number(el.style.getPropertyValue("--r-dates-column")),
          top: r.top - cr.top,
          height: r.height,
          box: box(el),
          col: box(c),
        };
      });
      const now = [...body.querySelectorAll("[data-now]")].map((el) => {
        const c = el.closest("[data-day]");
        const r = el.getBoundingClientRect();
        return { day: c.dataset.day, centre: r.top + r.height / 2 - c.getBoundingClientRect().top };
      });
      const hours = [...body.querySelectorAll("[data-hour]")].map((el) => box(el));
      return {
        rowH: Number.parseFloat(getComputedStyle(body).getPropertyValue("--ROW-H")),
        rowHProbe: tokenPx(body, "--ROW-H"),
        hit: tokenPx(body, "--HIT-MIN"),
        gap: tokenPx(body, "--R-SIZE-6"),
        days: [...body.querySelectorAll("[data-day]")].map((c) => c.dataset.day),
        hours,
        blocks,
        now,
        region: { ...box(root), clientTop: root.clientTop, clientLeft: root.clientLeft, scrollTop: root.scrollTop },
        head: box(root.querySelector("[data-timegrid-head]")),
        hour8: box(body.querySelector('[data-hour="8"]')),
        thursday: col("2026-10-15") && box(col("2026-10-15")),
      };
    }, sel);

  try {
    // ── 1. harness ──────────────────────────────────────────────────────────
    await load(1280, "fine");
    const g = await measure(WEEK);
    if (g.rowH !== 40 || !near(g.rowHProbe, 40, 0.01)) problems.push(`harness: --ROW-H at the week grid is ${g.rowH}px (probe ${g.rowHProbe}px), source predicts 40px`);
    if (g.days.join() !== "2026-10-11,2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-17") problems.push(`harness: week days ${g.days.join()}`);
    const thursday = g.blocks.filter((b) => b.day === "2026-10-15").map((b) => b.event);
    if (thursday.join() !== "standup-15,incident-review,design-sync,one-on-one,capacity") problems.push(`harness: Thursday holds ${thursday.join()}`);
    summary.rowH = g.rowH;

    // ── 2. an hour is two --ROW-H ───────────────────────────────────────────
    if (g.hours.length !== 24) problems.push(`hours: ${g.hours.length} hour lines, expected 24`);
    const badHours = g.hours.filter((h) => !near(h.height, 2 * g.rowH, 0.5));
    if (badHours.length) problems.push(`hours: ${badHours.length} hour(s) not 2 × --ROW-H = ${2 * g.rowH}px (${badHours[0]?.height}px)`);
    if (!near(g.hours[9].top - g.hours[8].top, 2 * g.rowH, 0.5)) problems.push(`hours: 09:00 is ${g.hours[9].top - g.hours[8].top}px below 08:00`);
    summary.hour = g.hours[8].height;

    // ── 3. blocks from their minutes ────────────────────────────────────────
    const perMinute = g.rowH / 30;
    if (g.blocks.length < 10) problems.push(`blocks: only ${g.blocks.length} drawn in the week`);
    for (const b of g.blocks) {
      if (!near(b.top, b.start * perMinute) || !near(b.height, (b.end - b.start) * perMinute)) {
        problems.push(`blocks: ${b.id} at ${b.top.toFixed(1)}px, ${b.height.toFixed(1)}px tall; minutes ${b.start}–${b.end} predict ${(b.start * perMinute).toFixed(1)}px, ${((b.end - b.start) * perMinute).toFixed(1)}px`);
      }
    }
    const known = [
      ["2026-10-15|incident-review", 600, 660],
      ["2026-10-15|standup-15", 570, 600],
      ["2026-10-16|migration", 1380, 1440],
    ];
    for (const [id, start, end] of known) {
      const b = g.blocks.find((x) => x.id === id);
      if (!b) problems.push(`blocks: harness: no ${id}`);
      else if (!near(b.top, start * perMinute) || !near(b.height, (end - start) * perMinute)) problems.push(`blocks: ${id} drawn at ${b.top}px × ${b.height}px, its source time predicts ${start * perMinute}px × ${(end - start) * perMinute}px`);
    }
    summary.blocks = g.blocks.length;

    // ── 4. overlaps side by side ────────────────────────────────────────────
    const trio = ["incident-review", "design-sync", "one-on-one"].map((id) => g.blocks.find((b) => b.id === `2026-10-15|${id}`));
    if (trio.some((b) => !b)) problems.push("overlap: harness: a Thursday meeting is missing");
    else {
      for (let i = 0; i < trio.length; i += 1) {
        const a = trio[i];
        if (a.column !== i) problems.push(`overlap: ${a.event} in column ${a.column}, expected ${i}`);
        if (a.box.left < a.col.left - 0.5 || a.box.right > a.col.right + 0.5) problems.push(`overlap: ${a.event} reaches outside Thursday's column`);
        for (const b of trio.slice(i + 1)) {
          const apart = a.box.right <= b.box.left + 0.5 || b.box.right <= a.box.left + 0.5;
          if (!apart) problems.push(`overlap: ${a.event} and ${b.event} overlap sideways`);
        }
      }
      if (!(trio[0].box.left < trio[1].box.left && trio[1].box.left < trio[2].box.left)) problems.push("overlap: the three are not left to right in column order");
    }

    // ── 5. the now line ─────────────────────────────────────────────────────
    if (g.now.length !== 1 || g.now[0].day !== "2026-10-15") problems.push(`now: ${JSON.stringify(g.now)}, expected one line on Thursday`);
    else if (!near(g.now[0].centre, 640 * perMinute)) problems.push(`now: centred ${g.now[0].centre.toFixed(1)}px down Thursday, 10:40 is ${(640 * perMinute).toFixed(1)}px`);

    // ── 6. scrolled to 08:00 on load ────────────────────────────────────────
    if (!(g.region.scrollTop > 0) || !near(g.hour8.top, g.head.bottom)) {
      problems.push(`scroll: 08:00's line is ${(g.hour8.top - g.head.bottom).toFixed(1)}px below the header (scrollTop ${g.region.scrollTop}), expected at it`);
    }
    summary.scrollTop = g.region.scrollTop;

    // ── 7. sticky header, scrolling down and back; End scrolls clear of it ──
    const stuckHead = (top) =>
      page.evaluate(
        ({ sel, top }) => {
          const root = document.querySelector(sel);
          root.scrollTop = top;
          const r = root.getBoundingClientRect();
          const head = root.querySelector("[data-timegrid-head]").getBoundingClientRect();
          const thu = root.querySelector('.r-dates-timegrid-body [data-day="2026-10-15"]').getBoundingClientRect();
          const hit = document.elementFromPoint(thu.left + thu.width / 2, head.top + head.height / 2);
          return { edge: r.top + root.clientTop, top: head.top, scrollTop: root.scrollTop, painted: Boolean(hit?.closest("[data-timegrid-head]")) };
        },
        { sel: WEEK, top },
      );
    await centre();
    // To the end of the day, then back part way.
    for (const top of [100_000, 600]) {
      const s = await stuckHead(top);
      if (top === 600 && !near(s.scrollTop, top)) problems.push(`sticky: harness: scrollTop ${s.scrollTop}, asked ${top}`);
      if (!near(s.top, s.edge)) problems.push(`sticky @${top}: the header is ${(s.top - s.edge).toFixed(1)}px from the grid's top edge`);
      if (!s.painted) problems.push(`sticky @${top}: the header does not paint over the days scrolled under it`);
    }
    await page.evaluate((sel) => document.querySelector(sel).querySelector('[data-block="2026-10-15|standup-15"]').focus(), WEEK);
    await page.keyboard.press("End");
    const end = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const a = document.activeElement;
      const r = a.getBoundingClientRect();
      return {
        id: a.dataset.block,
        top: r.top,
        headBottom: root.querySelector("[data-timegrid-head]").getBoundingClientRect().bottom,
        regionBottom: root.getBoundingClientRect().bottom,
      };
    }, WEEK);
    if (end.id !== "2026-10-17|migration") problems.push(`End: focus on ${end.id}, expected Saturday's migration`);
    else if (end.top < end.headBottom - 1 || end.top > end.regionBottom) problems.push(`End: the block's top is ${(end.top - end.headBottom).toFixed(1)}px from the header's bottom, expected in view below it`);

    // ── 12. forced colours (at 1280, fine) ──────────────────────────────────
    await setView(page, { forced: true });
    await page.evaluate((sel) => document.querySelector(sel).querySelector('[data-block="2026-10-15|standup-15"]').focus(), WEEK);
    await page.keyboard.press("ArrowDown");
    const forced = await page.evaluate((sel) => {
      const opaque = (c) => c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const root = document.querySelector(sel);
      const thu = root.querySelector('.r-dates-timegrid-body [data-day="2026-10-15"]');
      const edges = [...thu.querySelectorAll("[data-block]")].map((el) => {
        const cs = getComputedStyle(el);
        return Number.parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && cs.borderTopColor !== bgOf(el.parentElement);
      });
      const now = thu.querySelector("[data-now]");
      const ncs = getComputedStyle(now);
      const a = document.activeElement;
      const acs = getComputedStyle(a);
      return {
        forced: matchMedia("(forced-colors: active)").matches,
        edges,
        now: Number.parseFloat(ncs.borderTopWidth) > 0 && ncs.borderTopStyle === "solid" && ncs.borderTopColor !== bgOf(thu),
        focus: { id: a.dataset.block, visible: a.matches(":focus-visible"), style: acs.outlineStyle, width: Number.parseFloat(acs.outlineWidth) },
      };
    }, WEEK);
    if (!forced.forced) problems.push("forced colours: harness: the media query does not match");
    if (forced.edges.length !== 5) problems.push(`forced colours: harness: ${forced.edges.length} Thursday blocks, expected 5`);
    if (forced.edges.some((ok) => !ok)) problems.push(`forced colours: ${forced.edges.filter((ok) => !ok).length} block(s) without a visible edge`);
    if (!forced.now) problems.push("forced colours: the now line draws no visible border");
    if (forced.focus.id !== "2026-10-15|incident-review" || !forced.focus.visible || forced.focus.style !== "solid" || !(forced.focus.width > 0)) {
      problems.push(`forced colours: the focused block's ring ${JSON.stringify(forced.focus)}`);
    }
    await setView(page, { forced: false });

    // ── 11. RTL ─────────────────────────────────────────────────────────────
    await page.evaluate(() => document.querySelector('[data-sc="event-calendar-week"]').setAttribute("dir", "rtl"));
    await settle(page);
    const rtl = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const body = root.querySelector(".r-dates-timegrid-body");
      const label = body.querySelector("[data-timegrid-hour]").getBoundingClientRect();
      const sunday = body.querySelector('[data-day="2026-10-11"]').getBoundingClientRect();
      const saturday = body.querySelector('[data-day="2026-10-17"]').getBoundingClientRect();
      const at = (id) => body.querySelector(`[data-block="2026-10-15|${id}"]`).getBoundingClientRect();
      return {
        direction: getComputedStyle(root).direction,
        gutterRight: label.left >= sunday.right - 0.5,
        sundayFirst: sunday.left > saturday.left,
        order: [at("incident-review").right, at("design-sync").right, at("one-on-one").right],
      };
    }, WEEK);
    await page.evaluate(() => document.querySelector('[data-sc="event-calendar-week"]').removeAttribute("dir"));
    if (rtl.direction !== "rtl") problems.push(`RTL: harness: the grid's direction is ${rtl.direction}`);
    if (!rtl.gutterRight || !rtl.sundayFirst) problems.push(`RTL: gutter right of the days ${rtl.gutterRight}, Sunday rightmost ${rtl.sundayFirst}`);
    if (!(rtl.order[0] > rtl.order[1] && rtl.order[1] > rtl.order[2])) problems.push(`RTL: overlap columns not right to left (${rtl.order.map(Math.round).join(", ")})`);

    // ── 9. compact: a shorter hour ──────────────────────────────────────────
    const compact = await measure(COMPACT);
    if (compact.rowH !== 30) problems.push(`compact: harness: --ROW-H at the day demo is ${compact.rowH}px, source predicts 30px`);
    if (compact.days.join() !== "2026-10-15") problems.push(`compact: harness: the day demo shows ${compact.days.join()}`);
    if (!near(compact.hours[8].height, 2 * compact.rowH, 0.5) || !(compact.hours[8].height < g.hours[8].height)) {
      problems.push(`compact: an hour is ${compact.hours[8].height}px, expected 2 × ${compact.rowH}px and shorter than the week's ${g.hours[8].height}px`);
    }
    if (!compact.now.length || !near(compact.now[0].centre, 640 * (compact.rowH / 30))) problems.push(`compact: now line ${JSON.stringify(compact.now)}`);
    summary.compactHour = compact.hours[8]?.height;

    // ── 10. coarse: targets at the floor ────────────────────────────────────
    await setView(page, { input: "coarse" });
    const coarse = await page.evaluate((sel) => {
      const tokenPx = (el, name) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;block-size:var(${name})`;
        el.appendChild(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        return h;
      };
      const root = document.querySelector(sel);
      const targets = [...root.querySelectorAll("a[href], button")].map((el) => {
        const r = el.getBoundingClientRect();
        return { what: el.dataset.block ?? el.dataset.event ?? el.dataset.day ?? el.textContent.trim().slice(0, 20), w: r.width, h: r.height };
      });
      const standup = root.querySelector('[data-block="2026-10-15|standup-15"]').getBoundingClientRect().height;
      const trio = ["incident-review", "design-sync", "one-on-one"].map((id) => root.querySelector(`[data-block="2026-10-15|${id}"]`).getBoundingClientRect().width);
      return { hit: tokenPx(root, "--HIT-MIN"), rowH: tokenPx(root, "--ROW-H"), targets, standup, trio };
    }, WEEK);
    if (coarse.hit !== 44) problems.push(`coarse: harness: --HIT-MIN ${coarse.hit}px, source predicts 44px`);
    if (coarse.targets.length < 15) problems.push(`coarse: harness: only ${coarse.targets.length} targets in the week grid`);
    const small = coarse.targets.filter((t) => t.w < coarse.hit - 0.5 || t.h < coarse.hit - 0.5);
    for (const t of small) problems.push(`coarse: ${t.what} is ${t.w.toFixed(1)} × ${t.h.toFixed(1)}px, under --HIT-MIN ${coarse.hit}px`);
    if (!near(coarse.standup, coarse.rowH, 0.5) || coarse.standup < coarse.hit - 0.5) problems.push(`coarse: the 30-minute stand-up is ${coarse.standup}px, expected one --ROW-H (${coarse.rowH}px) ≥ --HIT-MIN`);
    if (coarse.trio.some((w) => w < coarse.hit - 0.5)) problems.push(`coarse: Thursday's overlapping blocks are ${coarse.trio.map((w) => w.toFixed(1)).join(", ")}px wide`);
    summary.coarseTargets = coarse.targets.length;

    // ── 8. 375: the grid scrolls sideways, the page does not ────────────────
    await load(375, "fine");
    const narrow = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      return {
        grid: root.scrollWidth - root.clientWidth,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        right: root.getBoundingClientRect().right - innerWidth,
      };
    }, WEEK);
    if (!(narrow.grid > 0)) problems.push(`375: the week grid does not scroll sideways (${narrow.grid}px over)`);
    if (narrow.page > 0) problems.push(`375: the page scrolls sideways by ${narrow.page}px`);
    if (narrow.right > 0.5) problems.push(`375: the grid ends ${narrow.right.toFixed(1)}px past the viewport`);
    const stuckGutter = (left) =>
      page.evaluate(
        ({ sel, left }) => {
          const root = document.querySelector(sel);
          root.scrollLeft = left;
          const r = root.getBoundingClientRect();
          const label = root.querySelector("[data-timegrid-hour]");
          const hour = [...root.querySelectorAll("[data-timegrid-hour]")][10].getBoundingClientRect();
          const corner = root.querySelector(".r-dates-timegrid-corner").getBoundingClientRect();
          const hit = document.elementFromPoint(hour.left + hour.width / 2, hour.top + hour.height / 2);
          return {
            edge: r.left + root.clientLeft,
            label: hour.left,
            corner: corner.left,
            scrollLeft: root.scrollLeft,
            painted: Boolean(hit?.closest("[data-timegrid-hour]")),
            found: Boolean(label),
          };
        },
        { sel: WEEK, left },
      );
    // Hour 10 at the grid's top, so its gutter label can be hit tested.
    await centre();
    await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const head = root.querySelector("[data-timegrid-head]").getBoundingClientRect();
      const ten = root.querySelector('[data-hour="10"]').getBoundingClientRect();
      root.scrollTop += ten.top - head.bottom;
    }, WEEK);
    for (const left of [10_000, 120]) {
      const s = await stuckGutter(left);
      if (!s.found) problems.push("375: harness: no gutter label");
      if (left === 120 && !near(s.scrollLeft, 120)) problems.push(`375: harness: scrollLeft ${s.scrollLeft}, asked 120`);
      if (!near(s.label, s.edge) || !near(s.corner, s.edge)) problems.push(`375 @${s.scrollLeft}: gutter at ${(s.label - s.edge).toFixed(1)}px, corner at ${(s.corner - s.edge).toFixed(1)}px from the grid's start edge`);
      if (!s.painted) problems.push(`375 @${s.scrollLeft}: the gutter does not paint over the days scrolled under it`);
    }
    await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      root.scrollLeft = 10_000;
      root.querySelector('[data-block="2026-10-15|standup-15"]').focus({ preventScroll: true });
    }, WEEK);
    await page.keyboard.press("Home");
    const home = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const a = document.activeElement.getBoundingClientRect();
      const gutter = root.querySelector(".r-dates-timegrid-corner").getBoundingClientRect();
      const head = root.querySelector("[data-timegrid-head]").getBoundingClientRect();
      return { id: document.activeElement.dataset.block, left: a.left, gutter: gutter.right, top: a.top, head: head.bottom };
    }, WEEK);
    if (home.id !== "2026-10-12|standup-12") problems.push(`375 Home: focus on ${home.id}, expected Monday's stand-up`);
    else if (home.left < home.gutter - 1 || home.top < home.head - 1) problems.push(`375 Home: the block is ${(home.left - home.gutter).toFixed(1)}px from the gutter and ${(home.top - home.head).toFixed(1)}px below the header, expected clear of both`);
    summary.narrowScroll = narrow.grid;

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`dates-event-timegrid FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-timegrid OK (${JSON.stringify(summary)})`;
}
