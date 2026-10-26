// @covers   dates/EventCalendar
// @sections dates-eventcalendar
// @tier     component
//
// Browser check: the EventCalendar's agenda and toolbar, which jsdom cannot lay out.
//
// Run it through `bun run browser:check dates-event-agenda`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print dates-event-agenda)"
//
// Asserts, on the EventCalendar section (default theme; the agenda's day grouping, names
// and keys are EventAgenda.test.tsx's):
//   1. harness: `--ROW-H` at the agenda resolves to 40px (comfortable + fine, from source),
//      and the agenda demo lists October 2026 with Thursday the 15th holding the six events
//      its source gives it, the all-day on-call first;
//   2. every agenda row is at least `--ROW-H` tall; at coarse input `--ROW-H` reaches
//      `--HIT-MIN` and every row is at least that;
//   3. wide (1280): each row's time sits beside its title, before it on the inline start, the
//      tops level, and every row's time and title start on the same two edges (one column);
//      narrow (375): the time sits above the title, sharing its start edge;
//   4. at 375: nothing in the agenda demo is wider than its box or ends past the viewport, and
//      the long QBR title wraps onto more lines inside its row;
//   5. every event in the linked agenda is a real `<a>` with its `?event=` href;
//   6. the main demo's toolbar at 375, squeezed to 240px, wraps onto more than one line, neither it nor the month
//      grid reaching past the calendar's own box, and
//      Today, previous and next are exactly `--CONTROL-H` tall;
//   7. the main demo's view switch moves to the agenda (the state output and an agenda list
//      follow) and back to the month;
//   8. paging the linked agenda to an empty month shows the empty state inside the demo; the
//      loading demo says "Loading events", is busy, and shows no empty state;
//   9. forced colours: every status glyph paints in a colour other than the row behind it,
//      and every mark keeps a visible fill or edge (the slot-less ones included);
//  10. RTL: with `dir="rtl"` at 1280, each row's time sits right of its title;
//  11. print: no day header sticks.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /eventcalendar|agenda|calendar/i.test(text) });
  const AGENDA = '[data-sc="event-calendar-agenda"]';
  const MAIN = '[data-sc="event-calendar-main"]';
  const view = (input = "fine") => ({ theme: "default", density: "comfortable", input });

  const load = async (width, input) => {
    await openSection(page, "dates-eventcalendar", { width, view: view(input) });
    await page.locator(`${AGENDA} ol[data-agenda]`).waitFor();
  };

  /** Row geometry in the agenda demo: each row's box, time, title and the tokens at it. */
  const rows = () =>
    page.evaluate((sel) => {
      const tokenPx = (el, name) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;block-size:var(${name})`;
        el.appendChild(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        return h;
      };
      const agenda = document.querySelector(`${sel} ol[data-agenda]`);
      const out = [];
      for (const row of agenda.querySelectorAll("[data-event]")) {
        const box = row.getBoundingClientRect();
        const time = row.querySelector("[data-agenda-time]").getBoundingClientRect();
        const title = row.querySelector("[data-agenda-title]").getBoundingClientRect();
        out.push({
          key: row.dataset.event,
          tag: row.tagName,
          href: row.getAttribute("href"),
          h: box.height,
          box: { left: box.left, right: box.right },
          time: { left: time.left, right: time.right, top: time.top, bottom: time.bottom },
          title: { left: title.left, right: title.right, top: title.top, bottom: title.bottom, height: title.height },
          titleLine: Number.parseFloat(getComputedStyle(row.querySelector("[data-agenda-title]")).lineHeight),
        });
      }
      return { rowH: tokenPx(agenda, "--ROW-H"), hitMin: tokenPx(agenda, "--HIT-MIN"), name: agenda.getAttribute("aria-label"), rows: out };
    }, AGENDA);

  try {
    // 1. harness
    await load(1280, "fine");
    const wide = await rows();
    if (wide.rowH !== 40) problems.push(`harness: --ROW-H at the agenda is ${wide.rowH}px, source predicts 40px at comfortable + fine`);
    if (wide.name !== "October 2026") problems.push(`harness: the agenda demo's list is named "${wide.name}", expected "October 2026"`);
    const the15th = await page.evaluate((sel) => {
      const list = document.querySelector(`${sel} [data-agenda-day="2026-10-15"]`)?.nextElementSibling;
      return [...(list?.querySelectorAll("[data-event]") ?? [])].map((el) => el.dataset.event);
    }, AGENDA);
    if (the15th.length !== 6 || the15th[0] !== "oncall-ada") problems.push(`harness: the 15th lists ${JSON.stringify(the15th)}, source gives six with oncall-ada first`);
    if (wide.rows.length < 40) problems.push(`harness: only ${wide.rows.length} agenda rows found`);
    summary.rows = wide.rows.length;

    // 2. rows at least --ROW-H
    const short = wide.rows.filter((r) => r.h < wide.rowH - 0.5);
    if (short.length) problems.push(`rows: ${short.length} rows under --ROW-H (${wide.rowH}px), e.g. ${short[0].key} at ${short[0].h}px`);

    // 3. wide: the time beside the title, one column
    const besideBad = wide.rows.filter((r) => !(r.time.right <= r.title.left + 0.5) || Math.abs(r.time.top - r.title.top) > 2);
    if (besideBad.length) problems.push(`wide: ${besideBad.length} rows without the time beside the title, e.g. ${JSON.stringify(besideBad[0])}`);
    const edges = (list, pick) => new Set(list.map((r) => Math.round(pick(r)))).size;
    if (edges(wide.rows, (r) => r.time.left) !== 1 || edges(wide.rows, (r) => r.title.left) !== 1) {
      problems.push(`wide: times start on ${edges(wide.rows, (r) => r.time.left)} edges and titles on ${edges(wide.rows, (r) => r.title.left)}, expected one each`);
    }

    // 5. linked events are real anchors
    const notLinks = wide.rows.filter((r) => r.tag !== "A" || !/\?event=/.test(r.href ?? ""));
    if (notLinks.length) problems.push(`links: ${notLinks.length} rows are not anchors with an event href, e.g. ${notLinks[0].key} (${notLinks[0].tag}, ${notLinks[0].href})`);

    // 7. the view switch moves the main demo to the agenda and back
    const main = page.locator(MAIN);
    const state = () => main.locator('[data-sc="event-calendar-state"]').textContent();
    await main.getByRole("radio", { name: "Agenda" }).check({ force: true });
    await page.waitForFunction((sel) => document.querySelector(`${sel} ol[data-agenda]`), MAIN, { timeout: 3_000 }).catch(() => {});
    const toAgenda = { state: (await state()).trim(), list: await main.locator("ol[data-agenda]").count() };
    if (!toAgenda.state.startsWith("agenda ·") || toAgenda.list !== 1) problems.push(`switch: to the agenda → ${JSON.stringify(toAgenda)}`);
    await main.getByRole("radio", { name: "Month" }).check({ force: true });
    await page.waitForFunction((sel) => !document.querySelector(`${sel} ol[data-agenda]`), MAIN, { timeout: 3_000 }).catch(() => {});
    const toMonth = { state: (await state()).trim(), list: await main.locator("ol[data-agenda]").count() };
    if (!toMonth.state.startsWith("month ·") || toMonth.list !== 0) problems.push(`switch: back to the month → ${JSON.stringify(toMonth)}`);

    // 8. the empty month and the loading demo
    const agendaDemo = page.locator(AGENDA);
    for (let i = 0; i < 2; i += 1) await agendaDemo.getByRole("button", { name: "Next month" }).click();
    const empty = await page.evaluate((sel) => {
      const demo = document.querySelector(sel);
      const text = [...demo.querySelectorAll("p")].find((p) => p.textContent.trim() === "Nothing scheduled");
      const d = demo.getBoundingClientRect();
      const r = text?.getBoundingClientRect();
      return {
        title: demo.querySelector('[aria-live="polite"]')?.textContent,
        shown: Boolean(text?.checkVisibility()),
        inside: Boolean(r && r.left >= d.left && r.right <= d.right),
        list: demo.querySelectorAll("ol[data-agenda]").length,
      };
    }, AGENDA);
    if (empty.title !== "December 2026" || !empty.shown || !empty.inside || empty.list !== 0) problems.push(`empty: December in the linked agenda → ${JSON.stringify(empty)}`);
    for (let i = 0; i < 2; i += 1) await agendaDemo.getByRole("button", { name: "Previous month" }).click();
    const loading = await page.evaluate(() => {
      const cal = document.querySelector('[role="group"][aria-label="Loading"]');
      const status = cal?.querySelector('[role="status"]');
      return {
        found: Boolean(cal),
        status: status?.textContent,
        busy: status?.parentElement.getAttribute("aria-busy"),
        empty: Boolean(cal && [...cal.querySelectorAll("p")].some((p) => p.textContent.trim() === "Nothing scheduled")),
      };
    });
    if (!loading.found || loading.status !== "Loading events" || loading.busy !== "true" || loading.empty) problems.push(`loading: ${JSON.stringify(loading)}`);

    // 11. print: no sticky day header
    await page.emulateMedia({ media: "print" });
    const sticky = await page.evaluate((sel) => {
      const headers = [...document.querySelectorAll(`${sel} [data-agenda-day]`)];
      return { count: headers.length, sticky: headers.filter((h) => ["sticky", "fixed"].includes(getComputedStyle(h).position)).length };
    }, AGENDA);
    await page.emulateMedia({ media: "screen" });
    if (sticky.count === 0) problems.push("print: harness: no day header found");
    if (sticky.sticky) problems.push(`print: ${sticky.sticky} day headers stick`);

    // 9. forced colours: glyphs and marks keep their paint
    await setView(page, { forced: true });
    const forced = await page.evaluate((sel) => {
      const opaque = (c) => c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const agenda = document.querySelector(`${sel} ol[data-agenda]`);
      const glyphs = [...agenda.querySelectorAll("[data-agenda-status] svg")].map((svg) => getComputedStyle(svg).color !== bgOf(svg.parentElement));
      const marks = [...agenda.querySelectorAll(".r-dates-event-stripe")].map((m) => {
        const cs = getComputedStyle(m);
        const behind = bgOf(m.parentElement);
        const fill = opaque(cs.backgroundColor) && cs.backgroundColor !== behind;
        const edge = Number.parseFloat(cs.borderTopWidth) > 0 && opaque(cs.borderTopColor) && cs.borderTopColor !== behind;
        return { slot: [...m.classList].some((c) => c.startsWith("bg-series-")), visible: fill || edge };
      });
      return { glyphs, marks };
    }, AGENDA);
    await setView(page, { forced: false });
    if (forced.glyphs.length < 3) problems.push(`forced: harness: only ${forced.glyphs.length} status glyphs found`);
    if (forced.glyphs.some((ok) => !ok)) problems.push(`forced: ${forced.glyphs.filter((ok) => !ok).length} status glyphs paint in the row's colour`);
    if (!forced.marks.some((m) => !m.slot) || !forced.marks.some((m) => m.slot)) problems.push("forced: harness: expected marks with and without a slot");
    const lost = forced.marks.filter((m) => !m.visible);
    if (lost.length) problems.push(`forced: ${lost.length} marks lose both fill and edge (${lost.filter((m) => !m.slot).length} slot-less)`);
    summary.forced = `${forced.glyphs.length} glyphs, ${forced.marks.length} marks`;

    // 10. RTL: the time on the inline start, now the right
    await setView(page, { dir: "rtl" });
    const rtl = await rows();
    await setView(page, { dir: "ltr" });
    const rtlBad = rtl.rows.filter((r) => !(r.time.left >= r.title.right - 0.5));
    if (rtl.rows.length === 0 || rtlBad.length) problems.push(`rtl: ${rtlBad.length} of ${rtl.rows.length} rows without the time right of the title`);

    // 2 (coarse) + 3 (narrow) + 4 + 6: at 375, fine and coarse.
    for (const input of ["fine", "coarse"]) {
      await load(375, input);
      const narrow = await rows();
      if (input === "coarse") {
        if (!(narrow.hitMin >= 44) || narrow.rowH < narrow.hitMin) problems.push(`coarse: --ROW-H ${narrow.rowH}px, --HIT-MIN ${narrow.hitMin}px`);
        const under = narrow.rows.filter((r) => r.h < narrow.hitMin - 0.5);
        if (under.length) problems.push(`coarse: ${under.length} rows under --HIT-MIN, e.g. ${under[0].key} at ${under[0].h}px`);
      }
      const aboveBad = narrow.rows.filter((r) => !(r.time.bottom <= r.title.top + 0.5) || Math.abs(r.time.left - r.title.left) > 1);
      if (narrow.rows.length < 40 || aboveBad.length) problems.push(`narrow/${input}: ${aboveBad.length} of ${narrow.rows.length} rows without the time above the title, e.g. ${JSON.stringify(aboveBad[0])}`);
      const qbr = narrow.rows.find((r) => r.key === "qbr");
      if (!qbr) problems.push(`narrow/${input}: harness: no QBR row`);
      else {
        if (!(qbr.title.height > qbr.titleLine * 1.5)) problems.push(`narrow/${input}: the QBR title is ${qbr.title.height}px tall, one ${qbr.titleLine}px line: it does not wrap`);
        if (qbr.title.right > qbr.box.right + 0.5) problems.push(`narrow/${input}: the QBR title ends ${qbr.title.right - qbr.box.right}px past its row`);
      }
      // The agenda demo only: the month view inside the main demo is the month check's.
      const spill = await page.evaluate((sel) => {
        const out = [];
        const demo = document.querySelector(sel);
        for (const el of [demo, ...demo.querySelectorAll("*")]) {
          if (el.closest(".sr-only") || el.tagName === "INPUT") continue;
          // A box that clips content it cannot show (a hit area's overhang is meant to reach out).
          const cs = getComputedStyle(el);
          const clips = cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis";
          if (clips && el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}[${el.dataset.event ?? el.className}]: ${el.scrollWidth} > ${el.clientWidth}`);
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > innerWidth + 0.5) out.push(`${el.tagName.toLowerCase()} ends ${Math.round(r.right - innerWidth)}px past the viewport`);
        }
        return out.slice(0, 5);
      }, AGENDA);
      for (const s of spill) problems.push(`375/${input}: ${s}`);

      const bar = await page.evaluate((sel) => {
        // Narrower than the view switch's natural width in any font, so a column that
        // grows to the toolbar's min-content would show here (the claim needs the squeeze).
        document.querySelector(sel).style.maxInlineSize = "240px";
        const toolbar = document.querySelector(`${sel} .r-dates-event-toolbar`);
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;block-size:var(--CONTROL-H)";
        toolbar.appendChild(probe);
        const controlH = probe.getBoundingClientRect().height;
        probe.remove();
        // The calendar's own box, not the toolbar's: a toolbar that grows its column
        // (an `auto` track at its min-content) stays inside itself and still spills.
        const box = toolbar.closest(".r-dates-event-calendar").getBoundingClientRect();
        const tops = new Set([...toolbar.children].map((c) => Math.round(c.getBoundingClientRect().top)));
        const buttons = ["Today", "Previous month", "Next month"].map((name) => {
          const b = [...toolbar.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") ?? x.textContent.trim()) === name);
          return { name, h: b?.getBoundingClientRect().height ?? null };
        });
        const out = [toolbar, ...toolbar.querySelectorAll("*"), ...toolbar.closest(".r-dates-event-calendar").querySelectorAll("[role=grid]")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < box.left - 0.5 || r.right > box.right + 0.5);
        }).length;
        document.querySelector(sel).style.maxInlineSize = "";
        return { controlH, lines: tops.size, buttons, out, width: Math.round(box.width), spills: toolbar.scrollWidth > toolbar.clientWidth + 1 };
      }, MAIN);
      if (!(bar.width <= 240)) problems.push(`toolbar/${input}: harness: the squeezed calendar is ${bar.width}px`);
      if (!(bar.controlH >= 36)) problems.push(`toolbar/${input}: harness: --CONTROL-H resolved to ${bar.controlH}px`);
      if (bar.lines < 2) problems.push(`toolbar/${input}: on ${bar.lines} line at 375, expected it to wrap`);
      if (bar.out || bar.spills) problems.push(`toolbar/${input}: ${bar.out} parts past the calendar's box (scrolls: ${bar.spills})`);
      for (const b of bar.buttons) if (b.h !== bar.controlH) problems.push(`toolbar/${input}: ${b.name} is ${b.h}px, --CONTROL-H is ${bar.controlH}px`);
      summary[`toolbar375${input}`] = `${bar.lines} lines`;
    }
    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none", media: "screen" });
  }

  if (problems.length) throw new Error(`dates-event-agenda FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dates-event-agenda OK (${JSON.stringify(summary)})`;
}
