// @covers   data/Timeline
// @sections data-timeline
// @tier     component
//
// Browser check: the Timeline's layout claims, which jsdom cannot see.
//
// Run it through `bun run browser:check data-timeline`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print data-timeline)"
//
// Asserts, on the Timeline section's demos (`[data-sc^="timeline-"]`):
//   1. harness: the comfortable incidents demo holds the five events its source lists, and a
//      mark is exactly `--ICON + 2 × --R-SIZE-5` (read from the tokens) on a side;
//   2. Tab onto an event's <time> shows its full reading (year included) in a Tooltip, open
//      in the top layer, that describes it (each event an <li> of an <ol> named by its day
//      header, with a focusable <time> whose `datetime` is ISO, is Timeline.test.tsx's);
//   3. sticky day headers: scrolling the deploy history's own scroller pins the header of
//      the day passing its top edge to that edge (halfway into the first day, then into the
//      second: harness, each offset lands in its day), while
//      the header of a day already scrolled past is not left behind on screen;
//   4. marks: every toned event's mark holds a glyph and its row a visible status word, and
//      every stateless one draws a dot; under forced colours the glyph, the disc's edge, the
//      dot and the connector each paint in a colour other than the background behind them;
//   5. density: the compact incidents demo (same events) is shorter than the comfortable one,
//      and its marks smaller;
//   6. at 375 (and coarse input), no demo, list or event is wider than its box;
//   7. RTL: in the right-to-left demo the rail (mark and connector) sits on the inline-start
//      (right) side of the body, and on the left in the LTR demo.
//   8. threads: in every list of every demo, for each event and the next, the connector starts
//      exactly one --R-SIZE-6 below the mark's drawn edge (an icon disc's box, or the small
//      dot) and ends one --R-SIZE-6 above the next mark's drawn top, centred on both (±1px),
//      and every list's last event shows no connector; at comfortable and compact, and with
//      the mixed demo (icon → dot, dot → dot, dot → icon, icon → icon) also turned RTL.
async (page) => {
  const problems = [];
  // sweep-overview owns errors in general, this check only the ones a Timeline demo raises.
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /timeline|activityfeed/i.test(text) });

  const load = async (width, view) => {
    await openSection(page, "data-timeline", { width, view });
    await page.locator('[data-sc="timeline-deploys"]').waitFor();
    await page.locator('[data-sc="timeline-deploys"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  };

  // 8: the thread between consecutive marks, in every list under `scope` (default: every demo).
  const threads = (scope) =>
    page.evaluate((sel) => {
      const tokenPx = (el, name) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${name})`;
        el.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      const out = { pairs: 0, kinds: {}, gap: null, bad: [], lasts: 0 };
      const cx = (r) => (r.left + r.right) / 2;
      for (const ol of document.querySelectorAll(`${sel} ol`)) {
        if (ol.closest('[aria-hidden="true"]')) continue;
        const items = [...ol.children].filter((li) => li.tagName === "LI");
        const name = ol.closest("[data-sc]")?.dataset.sc ?? "?";
        items.forEach((li, i) => {
          const line = li.querySelector(".r-data-timeline-line");
          const mark = li.querySelector("[data-timeline-mark]");
          const next = items[i + 1];
          if (!next) {
            out.lasts += 1;
            const r = line.getBoundingClientRect();
            if (getComputedStyle(line).visibility !== "hidden" && r.height > 0) out.bad.push(`${name}: the last event's connector is visible`);
            return;
          }
          const nextMark = next.querySelector("[data-timeline-mark]");
          const gap = tokenPx(li, "--R-SIZE-6");
          out.gap = gap;
          const m = mark.getBoundingClientRect();
          const l = line.getBoundingClientRect();
          const n = nextMark.getBoundingClientRect();
          const kind = `${mark.dataset.timelineMark}→${nextMark.dataset.timelineMark}`;
          out.kinds[kind] = (out.kinds[kind] ?? 0) + 1;
          out.pairs += 1;
          const where = `${name} #${i} (${kind})`;
          if (!(l.height > 0)) out.bad.push(`${where}: no connector drawn`);
          if (Math.abs(l.top - (m.bottom + gap)) > 1) out.bad.push(`${where}: connector starts ${(l.top - m.bottom).toFixed(1)}px below the mark, gap is ${gap}px`);
          if (Math.abs(n.top - (l.bottom + gap)) > 1) out.bad.push(`${where}: connector ends ${(n.top - l.bottom).toFixed(1)}px above the next mark, gap is ${gap}px`);
          if (Math.abs(cx(l) - cx(m)) > 1 || Math.abs(cx(l) - cx(n)) > 1) {
            out.bad.push(`${where}: connector centre ${cx(l).toFixed(1)} vs marks ${cx(m).toFixed(1)} / ${cx(n).toFixed(1)}`);
          }
        });
      }
      return out;
    }, scope);
  const checkThreads = (t, label, { mixed }) => {
    if (!(t.gap > 0)) problems.push(`threads ${label}: harness: --R-SIZE-6 resolved to ${t.gap}`);
    if (t.pairs < (mixed ? 5 : 20)) problems.push(`threads ${label}: harness: only ${t.pairs} consecutive pairs measured`);
    for (const kind of ["disc→dot", "dot→dot", "dot→disc", "disc→disc"]) {
      if (!t.kinds[kind]) problems.push(`threads ${label}: harness: no ${kind} pair found (the mixed demo lists every pairing)`);
    }
    if (t.lasts === 0) problems.push(`threads ${label}: harness: no list's last event found`);
    for (const b of t.bad) problems.push(`threads ${label}: ${b}`);
  };

  const summary = {};
  try {
    await load(1280, { theme: "default", density: "comfortable", input: "fine" });

    // 1 + 4 (normal colours) + 5 + 7: one read of the page.
    const facts = await page.evaluate(() => {
      const tokenPx = (el, name) => {
        // Resolve a token where it is painted by sizing a probe with it.
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${name})`;
        el.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      const demo = (sc) => document.querySelector(`[data-sc="${sc}"]`);
      const incidents = demo("timeline-incidents");
      const compact = demo("timeline-compact");
      const firstMark = incidents.querySelector("[data-timeline-mark]");
      const markWant = tokenPx(firstMark.parentElement, "--ICON") + 2 * tokenPx(firstMark.parentElement, "--R-SIZE-5");
      const compactMark = compact.querySelector("[data-timeline-mark]");

      const all = [...document.querySelectorAll('[data-sc^="timeline-"]')];
      const items = all.flatMap((d) => [...d.querySelectorAll("li")]).filter((li) => !li.closest('[aria-hidden="true"]'));

      const marks = items.map((li) => {
        const mark = li.querySelector("[data-timeline-mark]");
        const tone = li.dataset.tone ?? "neutral";
        const hasGlyph = !!mark?.querySelector("svg");
        const dot = !!mark?.querySelector(".r-data-timeline-dot");
        const word = li.querySelector("[data-timeline-status]")?.textContent.trim() ?? "";
        return { tone, hasGlyph, dot, word, custom: hasGlyph && tone === "neutral" };
      });

      const side = (sc) => {
        const li = demo(sc).querySelector("li");
        const rail = li.querySelector(".r-data-timeline-rail").getBoundingClientRect();
        const line = li.querySelector(".r-data-timeline-line").getBoundingClientRect();
        const body = li.querySelector(".r-data-timeline-body").getBoundingClientRect();
        return {
          railRight: rail.left >= body.right - 0.5,
          railLeft: rail.right <= body.left + 0.5,
          lineInRail: line.left >= rail.left - 0.5 && line.right <= rail.right + 0.5 && line.height > 4,
        };
      };

      return {
        incidentItems: incidents.querySelectorAll("li").length,
        mark: firstMark.getBoundingClientRect().width,
        markH: firstMark.getBoundingClientRect().height,
        markWant,
        compactMark: compactMark.getBoundingClientRect().width,
        heights: { comfortable: incidents.getBoundingClientRect().height, compact: compact.getBoundingClientRect().height },
        compactItems: compact.querySelectorAll("li").length,
        marks,
        ltr: side("timeline-incidents"),
        rtl: side("timeline-rtl"),
      };
    });

    if (facts.incidentItems !== 5) problems.push(`harness: incidents demo has ${facts.incidentItems} events, source lists 5`);
    if (!(facts.markWant > 10) || Math.abs(facts.mark - facts.markWant) > 0.5 || Math.abs(facts.markH - facts.markWant) > 0.5) {
      problems.push(`harness: mark ${facts.mark}×${facts.markH}px, tokens say ${facts.markWant}px`);
    }
    summary.mark = `${facts.mark}px`;

    if (facts.marks.length < 30) problems.push(`harness: only ${facts.marks.length} events found across the demos`);
    summary.events = facts.marks.length;

    const toned = facts.marks.filter((m) => m.tone !== "neutral");
    if (toned.length < 10) problems.push(`marks: only ${toned.length} toned events found`);
    for (const m of toned) {
      if (!m.hasGlyph) problems.push(`marks: a ${m.tone} event's mark has no glyph`);
      if (!m.word) problems.push(`marks: a ${m.tone} event shows no status word`);
    }
    const stateless = facts.marks.filter((x) => x.tone === "neutral" && !x.custom);
    // Positive control: the audit log alone lists four stateless events.
    if (stateless.length < 4) problems.push(`marks: only ${stateless.length} stateless events found, the audit demo lists 4`);
    for (const m of stateless) {
      if (!m.dot) problems.push("marks: a stateless event draws no dot");
    }
    summary.toned = toned.length;
    summary.stateless = stateless.length;

    if (facts.compactItems !== facts.incidentItems) problems.push(`density: compact demo has ${facts.compactItems} events, comfortable ${facts.incidentItems}`);
    if (!(facts.heights.compact < facts.heights.comfortable)) {
      problems.push(`density: compact ${facts.heights.compact}px is not shorter than comfortable ${facts.heights.comfortable}px`);
    }
    if (!(facts.compactMark < facts.mark)) problems.push(`density: compact mark ${facts.compactMark}px is not smaller than ${facts.mark}px`);
    summary.density = `${Math.round(facts.heights.comfortable)}→${Math.round(facts.heights.compact)}px`;

    if (!facts.ltr.railLeft || !facts.ltr.lineInRail) problems.push(`LTR: rail ${JSON.stringify(facts.ltr)}, expected on the left with the connector in it`);
    if (!facts.rtl.railRight || !facts.rtl.lineInRail) problems.push(`RTL: rail ${JSON.stringify(facts.rtl)}, expected on the right with the connector in it`);

    // 8: threads at comfortable, LTR, then the mixed demo turned RTL.
    const ltrThreads = await threads('[data-sc^="timeline-"]');
    checkThreads(ltrThreads, "comfortable", { mixed: false });
    await page.evaluate(() => document.querySelector('[data-sc="timeline-threads"]').setAttribute("dir", "rtl"));
    const rtlThreads = await threads('[data-sc="timeline-threads"]');
    checkThreads(rtlThreads, "comfortable RTL", { mixed: true });
    const rtlSide = await page.evaluate(() => {
      const li = document.querySelector('[data-sc="timeline-threads"] li');
      const rail = li.querySelector(".r-data-timeline-rail").getBoundingClientRect();
      const body = li.querySelector(".r-data-timeline-body").getBoundingClientRect();
      return rail.left >= body.right - 0.5;
    });
    if (!rtlSide) problems.push("threads RTL: harness: the mixed demo's rail is not on the right after dir=rtl");
    await page.evaluate(() => document.querySelector('[data-sc="timeline-threads"]').removeAttribute("dir"));
    summary.threads = `${ltrThreads.pairs} pairs, gap ${ltrThreads.gap}px`;

    // 2: the full reading is reachable by keyboard: Tab onto a time opens its Tooltip,
    // which describes it.
    const firstTime = page.locator('[data-sc="timeline-incidents"] li time').first();
    await firstTime.evaluate((el) => {
      const before = document.createElement("button");
      before.dataset.probe = "";
      el.closest("li").prepend(before);
      before.focus();
    });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    const full = await firstTime.evaluate((el) => {
      document.querySelector("[data-probe]")?.remove();
      const tip = [...(el.getAttribute("aria-describedby") ?? "").split(" ")].map((id) => document.getElementById(id)).find((t) => t?.role === "tooltip");
      return {
        focused: document.activeElement === el,
        text: tip?.textContent ?? null,
        shown: Boolean(tip?.matches(":popover-open")),
        year: new Date(el.getAttribute("datetime")).getFullYear(),
      };
    });
    if (!full.focused || !full.shown || !full.text?.includes(String(full.year))) {
      problems.push(`full time: Tab onto a <time> did not show its full reading ${JSON.stringify(full)}`);
    }
    await page.keyboard.press("Escape");

    // 3: sticky day headers inside the deploy history's own scroller.
    const scroller = page.locator('[data-sc="timeline-deploys"]');
    const stick = (scrollTop) =>
      scroller.evaluate((el, top) => {
        el.scrollTop = top;
        const box = el.getBoundingClientRect();
        const edge = box.top + el.clientTop;
        const headers = [...el.querySelectorAll("[data-timeline-day]")].map((h) => {
          const r = h.getBoundingClientRect();
          const group = h.parentElement.getBoundingClientRect();
          return { text: h.textContent.trim(), top: r.top, groupTop: group.top, groupBottom: group.bottom, height: r.height };
        });
        // The day whose group spans the scroller's top edge.
        const current = headers.find((h) => h.groupTop <= edge + 0.5 && h.groupBottom > edge + h.height);
        return { edge, scrollTop: el.scrollTop, scrollable: el.scrollHeight > el.clientHeight + 50, headers, current };
      }, scrollTop);
    const atTop = await stick(0);
    if (!atTop.scrollable) problems.push("sticky: the deploy history does not scroll (harness)");
    if (atTop.headers.length < 3) problems.push(`sticky: ${atTop.headers.length} day headers, expected 3+`);
    const firstGroupH = atTop.headers[1] ? atTop.headers[1].groupTop - atTop.headers[0].groupTop : 0;
    for (const [day, offset] of [Math.round(firstGroupH / 2), Math.round(firstGroupH * 1.6)].entries()) {
      const s = await stick(offset);
      if (!s.current) {
        problems.push(`sticky @${offset}px: no day spans the scroller's top edge`);
        continue;
      }
      if (s.current.text !== atTop.headers[day]?.text) problems.push(`sticky @${offset}px: harness: "${s.current.text}" spans the top edge, expected day ${day + 1} ("${atTop.headers[day]?.text}")`);
      if (Math.abs(s.current.top - s.edge) > 1) {
        problems.push(`sticky @${offset}px: "${s.current.text}" header is at ${Math.round(s.current.top - s.edge)}px from the scroller's top, expected pinned at 0`);
      }
      for (const h of s.headers.filter((x) => x.groupBottom <= s.edge)) {
        if (h.top + h.height > s.edge + 0.5) problems.push(`sticky @${offset}px: a scrolled-past header ("${h.text}") is still on screen`);
      }
      summary[`stuck${offset}`] = s.current.text;
    }
    await stick(0);

    // 4: forced colours.
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(150);
    const forced = await page.evaluate(() => {
      const opaque = (c) => !/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent";
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (opaque(c)) return c;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      };
      const demo = document.querySelector('[data-sc="timeline-incidents"]');
      const out = { glyph: [], edge: [], dot: [], line: [] };
      for (const li of demo.querySelectorAll("li")) {
        const mark = li.querySelector("[data-timeline-mark]");
        const behind = bgOf(mark);
        const svg = mark.querySelector("svg");
        if (svg) {
          out.glyph.push(getComputedStyle(svg).color !== behind && getComputedStyle(svg).color !== bgOf(mark.parentElement));
          out.edge.push(getComputedStyle(mark).borderTopColor !== bgOf(mark.parentElement) && Number.parseFloat(getComputedStyle(mark).borderTopWidth) > 0);
        }
        const line = li.querySelector(".r-data-timeline-line");
        if (getComputedStyle(line).visibility === "visible") {
          const cs = getComputedStyle(line);
          out.line.push(cs.borderInlineStartColor !== bgOf(line) && Number.parseFloat(cs.borderInlineStartWidth) > 0);
        }
      }
      const dot = document.querySelector('[data-sc="timeline-audit"] .r-data-timeline-dot');
      if (dot) out.dot.push(getComputedStyle(dot).borderTopColor !== bgOf(dot) && Number.parseFloat(getComputedStyle(dot).borderTopWidth) > 0);
      return out;
    });
    for (const [part, list] of Object.entries(forced)) {
      if (list.length === 0) problems.push(`forced colours: found no ${part} to measure`);
      const bad = list.filter((ok) => !ok).length;
      if (bad) problems.push(`forced colours: ${bad} of ${list.length} ${part}(s) paint in the background's colour`);
    }
    summary.forced = Object.entries(forced).map(([k, v]) => `${v.length} ${k}`).join(", ");
    await page.emulateMedia({ forcedColors: "none" });

    // 8 again at compact, LTR and the mixed demo RTL.
    await load(1280, { theme: "default", density: "compact", input: "fine" });
    const compactThreads = await threads('[data-sc^="timeline-"]');
    checkThreads(compactThreads, "compact", { mixed: false });
    await page.evaluate(() => document.querySelector('[data-sc="timeline-threads"]').setAttribute("dir", "rtl"));
    checkThreads(await threads('[data-sc="timeline-threads"]'), "compact RTL", { mixed: true });

    // 6: narrow, both inputs.
    for (const input of ["fine", "coarse"]) {
      for (const density of ["comfortable", "compact"]) {
        await load(375, { theme: "default", density, input });
        const spill = await page.evaluate(() => {
          const out = [];
          const els = [...document.querySelectorAll('[data-sc^="timeline-"]')].flatMap((d) => [d, ...d.querySelectorAll("ol, li, .r-data-timeline-body, .r-data-timeline-body > *")]);
          for (const el of els) {
            if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()} in ${el.closest("[data-sc]")?.dataset.sc}: ${el.scrollWidth} > ${el.clientWidth}`);
          }
          for (const d of document.querySelectorAll('[data-sc^="timeline-"]')) {
            const box = d.getBoundingClientRect();
            if (box.right > innerWidth + 0.5) out.push(`${d.dataset.sc} ends ${Math.round(box.right - innerWidth)}px past the viewport`);
          }
          return out;
        });
        for (const s of spill) problems.push(`375/${density}/${input}: ${s}`);
      }
    }
    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`data-timeline FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `data-timeline OK (${JSON.stringify(summary)})`;
}
