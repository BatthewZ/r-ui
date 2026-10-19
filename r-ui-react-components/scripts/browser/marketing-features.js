// @covers   marketing/FeatureRows, marketing/HowItWorks, marketing/FeatureGrid, marketing/CallToAction,
//           marketing/EmailCapture
// @sections marketing-featurerows marketing-howitworks marketing-featuregrid marketing-calltoaction
//           marketing-emailcapture
// @tier     component
//
// Browser check: FeatureGrid, FeatureRows, HowItWorks, CallToAction and EmailCapture layout.
//
// Run it through `bun run browser:check marketing-features`.
//
// jsdom lays nothing out: it proves the DOM order and the classes, not that the media is
// DRAWN on the other side, that a list becomes a row by its container, or that a band meets
// its shell's edges. On the marketing sections, each opened alone (all four together at 375),
// it asserts:
//   1. harness: --r-steps-marker resolves to --ICON + 2 × --R-SIZE-5 (the Stepper's source)
//      and a HowItWorks marker is drawn at that size; the CTA shell's padding is non-zero;
//   2. FeatureRows (`rows-alternating`, 1280): three rows, each text THEN media in the DOM,
//      while the media is drawn end, start, end (right, left, right of the text, side by
//      side); RTL (`rows-rtl`) draws the first row's media on the LEFT; `rows-narrow`
//      (stacked, media last) draws the media under the text; at 375 the alternating rows
//      stack with the media ABOVE the text, the DOM order unchanged;
//   3. HowItWorks: `how-wide` (four steps in a list over 48rem) is an <ol> drawn as a row:
//      markers on one line, left to right, each connector a horizontal line through the
//      marker's centre from --R-SIZE-5 after its marker to --R-SIZE-5 before the next
//      (±1px), none after the last; `how-narrow` (same viewport, a narrow column) is a
//      column: markers on one vertical axis, top to bottom, each connector a vertical line
//      through the marker's centre from --R-SIZE-5 below it to --R-SIZE-5 above the next;
//      at 375 `how-wide` is a column too (its container decided at 1280, not the viewport);
//      RTL (`how-rtl`) runs right to left; under forced colours markers and connectors
//      keep a visible edge;
//   4. FeatureGrid (`features-plain`): as many columns as predicted from the grid's own
//      width (3 from 56rem, 2 from 36rem, else 1); a press on a linked item's icon, title
//      or text hit-tests to its one link; an unlinked item has none;
//   5. CallToAction (`cta-shell`): the band (a region named by its title) meets the shell's
//      inner edges on all four sides (±0.5px) and paints its own fill and hairlines, at
//      1280 and at 375;
//   6. EmailCapture at 1280, by the form's own width: the wide `email-flaky` form draws its
//      field and button on one row (same top, the button after the field's frame); the
//      `email-narrow` form (a --COLUMN-MD box) stacks them (the button under the frame);
//   7. no console or page error. (Coarse floors and sideways spill at 375 are sweep-overview's
//      geometry sweep, for every section in every View.)
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const SECTIONS = ["marketing-featuregrid", "marketing-featurerows", "marketing-howitworks", "marketing-calltoaction"];
  let email = null;

  /** Opens one section, or a list (scrolled to the first), by themselves. */
  const open = async (ids, { width = 1280, input = "fine" } = {}) => {
    const section = await openSection(page, ids, { width, view: { theme: "default", density: "comfortable", input } });
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
  };
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

  /** Each row of a FeatureRows demo: the DOM order of its parts and where each is drawn. */
  const rowsOf = (sc) =>
    page.evaluate((sc) => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return [...document.querySelectorAll(`[data-sc="${sc}"] [data-media-side]`)].map((row) => ({
        side: row.dataset.mediaSide,
        dom: [...row.children].map((el) => el.dataset.part),
        text: box(row.querySelector(':scope > [data-part="text"]')),
        media: box(row.querySelector(':scope > [data-part="media"]')),
      }));
    }, sc);

  /** A HowItWorks demo: the list's tag, --R-SIZE-5 in px, and each marker and connector as drawn. */
  const stepsOf = (sc) =>
    page.evaluate((sc) => {
      const list = document.querySelector(`[data-sc="${sc}"] ol`);
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--R-SIZE-5)";
      list.append(probe);
      const gap = probe.getBoundingClientRect().width;
      probe.remove();
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        tag: list.tagName,
        gap,
        steps: [...list.children].map((li) => {
          const connector = li.querySelector(".r-marketing-how-connector");
          const cs = connector && getComputedStyle(connector);
          return {
            marker: box(li.querySelector(".r-steps-marker")),
            title: box(li.querySelector(".r-marketing-how-title")),
            connector: connector && {
              ...box(connector),
              left: Number.parseFloat(cs.borderLeftWidth),
              right: Number.parseFloat(cs.borderRightWidth),
              topWidth: Number.parseFloat(cs.borderTopWidth),
              x: connector.getBoundingClientRect().left,
              xEnd: connector.getBoundingClientRect().right,
            },
          };
        }),
      };
    }, sc);

  /** Asserts a HowItWorks demo is drawn as a row (`row`) or a column, in reading direction. */
  const checkSteps = (name, data, { row, rtl = false }) => {
    const markers = data.steps.map((s) => s.marker);
    if (markers.length < 3 || !(data.gap > 0)) return fail.push(`${name}: harness: ${markers.length} steps, gap ${data.gap}px`);
    if (data.tag !== "OL") fail.push(`${name}: the steps are a <${data.tag}>, not an ordered list`);
    for (let i = 1; i < markers.length; i++) {
      const [a, b] = [markers[i - 1], markers[i]];
      const ok = row ? near(a.top, b.top) && (rtl ? b.right < a.left : b.left > a.right) : near(a.left, b.left) && b.top > a.bottom;
      if (!ok) fail.push(`${name}: marker ${i + 1} is not ${row ? (rtl ? "left of" : "right of") : "under"} marker ${i} (${JSON.stringify([a, b])})`);
    }
    // In a row every title starts on one line, however many lines a neighbour's title takes.
    if (row && data.steps.some((s) => !near(s.title.top, data.steps[0].title.top))) {
      fail.push(`${name}: the titles start at ${data.steps.map((s) => s.title.top.toFixed(1)).join(", ")}, not on one line`);
    }
    data.steps.forEach((step, i) => {
      const c = step.connector;
      if (i === data.steps.length - 1) {
        if (c) fail.push(`${name}: the last step draws a connector`);
        return;
      }
      if (!c) return fail.push(`${name}: step ${i + 1} has no connector`);
      const m = step.marker;
      const next = markers[i + 1];
      if (row) {
        // Only the top edge draws: a horizontal line through the marker's centre.
        if (!(c.topWidth > 0) || c.left !== 0 || c.right !== 0) return fail.push(`${name}: connector ${i + 1} is not horizontal (${JSON.stringify(c)})`);
        const y = c.top + c.topWidth / 2;
        if (!near(y, m.top + m.height / 2)) fail.push(`${name}: connector ${i + 1} at y ${y.toFixed(1)}, marker centre ${(m.top + m.height / 2).toFixed(1)}`);
        const after = rtl ? m.left - c.xEnd : c.x - m.right;
        const before = rtl ? c.x - next.right : next.left - c.xEnd;
        if (!near(after, data.gap) || !near(before, data.gap)) {
          fail.push(`${name}: connector ${i + 1} leaves ${after.toFixed(1)} / ${before.toFixed(1)}px, --R-SIZE-5 is ${data.gap}px`);
        }
      } else {
        // Only the inline-start edge draws: a vertical line through the marker's centre.
        const width = rtl ? c.right : c.left;
        if (!(width > 0) || c.topWidth !== 0) return fail.push(`${name}: connector ${i + 1} is not vertical (${JSON.stringify(c)})`);
        const x = rtl ? c.xEnd - width / 2 : c.x + width / 2;
        if (!near(x, m.left + m.width / 2)) fail.push(`${name}: connector ${i + 1} at x ${x.toFixed(1)}, marker centre ${(m.left + m.width / 2).toFixed(1)}`);
        if (!near(c.top - m.bottom, data.gap) || !near(next.top - c.bottom, data.gap)) {
          fail.push(`${name}: connector ${i + 1} leaves ${(c.top - m.bottom).toFixed(1)} / ${(next.top - c.bottom).toFixed(1)}px, --R-SIZE-5 is ${data.gap}px`);
        }
      }
    });
  };

  /** The CTA band against its shell's inner edges. */
  const band = () =>
    page.evaluate(() => {
      const shell = document.querySelector('[data-sc="cta-shell"]');
      const section = shell.querySelector("section");
      const s = shell.getBoundingClientRect();
      const cs = getComputedStyle(shell);
      const b = section.getBoundingClientRect();
      const own = getComputedStyle(section);
      const title = document.getElementById(section.getAttribute("aria-labelledby") ?? "");
      return {
        padding: Number.parseFloat(cs.paddingLeft),
        named: title?.textContent ?? null,
        gaps: {
          left: b.left - (s.left + Number.parseFloat(cs.borderLeftWidth)),
          right: s.right - Number.parseFloat(cs.borderRightWidth) - b.right,
          top: b.top - (s.top + Number.parseFloat(cs.borderTopWidth)),
          bottom: s.bottom - Number.parseFloat(cs.borderBottomWidth) - b.bottom,
        },
        fill: own.backgroundColor,
        hairlines: [Number.parseFloat(own.borderTopWidth), Number.parseFloat(own.borderBottomWidth)],
      };
    });
  const checkBand = (label, data) => {
    if (!(data.padding > 0)) fail.push(`${label}: harness: the shell has no padding to cancel`);
    if (data.named !== "Your next release is already merged.") fail.push(`${label}: the band is named ${JSON.stringify(data.named)}`);
    for (const [edge, gap] of Object.entries(data.gaps)) {
      if (!near(gap, 0, 0.5)) fail.push(`${label}: the band is ${gap.toFixed(1)}px off the shell's ${edge} edge`);
    }
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(data.fill)) fail.push(`${label}: the band paints no fill`);
    if (!data.hairlines.every((w) => w > 0)) fail.push(`${label}: the band's hairlines are ${data.hairlines.join("/")}`);
  };

  try {
    // ── 1 + 3: HowItWorks at 1280 ─────────────────────────────────────────
    await open("marketing-howitworks");
    const harness = await page.evaluate(() => {
      const root = document.querySelector('[data-sc="how-wide"]');
      const size = (expr) => {
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${expr}`;
        root.append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      return {
        token: size("var(--r-steps-marker)"),
        predicted: size("calc(var(--ICON) + 2 * var(--R-SIZE-5))"),
        drawn: root.querySelector(".r-steps-marker").getBoundingClientRect().width,
        listWidth: root.getBoundingClientRect().width,
      };
    });
    if (!(harness.predicted > 20) || !near(harness.token, harness.predicted, 0.5) || !near(harness.drawn, harness.predicted, 0.5)) {
      fail.push(`harness: marker token ${harness.token}px, drawn ${harness.drawn}px, --ICON + 2 × --R-SIZE-5 = ${harness.predicted}px`);
    }
    if (!(harness.listWidth >= 768)) fail.push(`harness: how-wide is ${harness.listWidth}px wide at 1280, under the 48rem its row needs`);
    checkSteps("how-wide @1280", await stepsOf("how-wide"), { row: true });
    checkSteps("how-narrow @1280", await stepsOf("how-narrow"), { row: false });
    checkSteps("how-rtl @1280", await stepsOf("how-rtl"), { row: true, rtl: true });

    await page.emulateMedia({ forcedColors: "active" });
    const forced = await page.evaluate(() =>
      [...document.querySelectorAll('[data-sc="how-wide"] li')].map((li) => {
        const marker = getComputedStyle(li.querySelector(".r-steps-marker"));
        const connector = li.querySelector(".r-marketing-how-connector");
        const c = connector && getComputedStyle(connector);
        return {
          ring: Number.parseFloat(marker.borderTopWidth) > 0 && marker.borderTopColor !== marker.backgroundColor && !/^rgba\(.*,\s*0\)$/.test(marker.borderTopColor),
          line: c ? Number.parseFloat(c.borderTopWidth) > 0 && !/^rgba\(.*,\s*0\)$/.test(c.borderTopColor) : null,
        };
      }),
    );
    await page.emulateMedia({ forcedColors: "none" });
    if (forced.length !== 4) fail.push(`forced: harness: ${forced.length} steps`);
    forced.forEach((f, i) => {
      if (!f.ring) fail.push(`forced: marker ${i + 1} loses its ring`);
      if (f.line === false) fail.push(`forced: connector ${i + 1} loses its line`);
    });

    // ── 2: FeatureRows at 1280 ────────────────────────────────────────────
    await open("marketing-featurerows");
    const rows = await rowsOf("rows-alternating");
    if (rows.length !== 3) fail.push(`rows: harness: ${rows.length} rows, the demo has 3`);
    const drawn = rows.map((r) => {
      const beside = r.media.bottom > r.text.top && r.text.bottom > r.media.top;
      return !beside ? "stacked" : r.media.left >= r.text.right - 1 ? "right" : r.media.right <= r.text.left + 1 ? "left" : "overlap";
    });
    if (drawn.join(" ") !== "right left right") fail.push(`rows: media drawn ${drawn.join(", ")}, expected right, left, right`);
    if (rows.map((r) => r.side).join(" ") !== "end start end") fail.push(`rows: sides ${rows.map((r) => r.side).join(", ")}`);
    for (const [i, r] of rows.entries()) if (r.dom.join(",") !== "text,media") fail.push(`rows: row ${i + 1} DOM order is ${r.dom.join(", ")}`);
    const rtl = await rowsOf("rows-rtl");
    if (rtl.length !== 2 || !(rtl[0].media.right <= rtl[0].text.left + 1) || !(rtl[1].media.left >= rtl[1].text.right - 1)) {
      fail.push(`rows rtl: ${JSON.stringify(rtl.map((r) => ({ media: r.media, text: r.text })))}`);
    }
    const narrow = await rowsOf("rows-narrow");
    if (narrow.length !== 1 || !(narrow[0].media.top >= narrow[0].text.bottom - 1)) fail.push(`rows narrow: media is not under the text: ${JSON.stringify(narrow)}`);

    // ── 4: FeatureGrid at 1280 ────────────────────────────────────────────
    await open("marketing-featuregrid");
    const grid = await page.evaluate(() => {
      const list = document.querySelector('[data-sc="features-plain"]');
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const width = list.getBoundingClientRect().width;
      const items = [...list.children];
      const columns = new Set(items.map((li) => Math.round(li.getBoundingClientRect().left))).size;
      const hit = (el) => {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      };
      const linked = items[4];
      const link = linked.querySelector("a");
      const parts = [linked.querySelector("[aria-hidden]"), linked.querySelector("h4"), linked.querySelector("h4 + div")];
      return {
        count: items.length,
        width,
        rem,
        columns,
        links: items.map((li) => li.querySelectorAll("a").length),
        hits: parts.map((p) => (p ? hit(p) === link : "missing")),
        unlinked: hit(items[0].querySelector("h4 + div")).closest("a") === null,
      };
    });
    const expected = grid.width >= 56 * grid.rem ? 3 : grid.width >= 36 * grid.rem ? 2 : 1;
    if (grid.count !== 6) fail.push(`grid: harness: ${grid.count} items, the demo lists 6`);
    if (grid.columns !== expected) fail.push(`grid: ${grid.columns} columns at ${grid.width}px, expected ${expected}`);
    if (grid.links.join("") !== "000011") fail.push(`grid: links per item ${grid.links.join(",")}, expected the last two linked once each`);
    grid.hits.forEach((ok, i) => {
      if (ok !== true) fail.push(`grid: a press on the linked item's ${["icon", "title", "text"][i]} ${ok === "missing" ? "(missing)" : "misses its link"}`);
    });
    if (!grid.unlinked) fail.push("grid: an unlinked item's text hit-tests to a link");

    // ── 5: CallToAction at 1280 ───────────────────────────────────────────
    await open("marketing-calltoaction");
    checkBand("cta @1280", await band());

    // ── 6: EmailCapture at 1280 ───────────────────────────────────────────
    await open("marketing-emailcapture");
    email = await page.evaluate(() => {
      const pair = (sc) => {
        const root = document.querySelector(`[data-sc="${sc}"]`);
        const frame = root?.querySelector('input[type="email"]')?.parentElement?.getBoundingClientRect();
        const button = root?.querySelector('button[type="submit"]')?.getBoundingClientRect();
        if (!frame || !button) return null;
        return { width: root.getBoundingClientRect().width, frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom }, button: { left: button.left, top: button.top } };
      };
      return { flaky: pair("email-flaky"), narrow: pair("email-narrow") };
    });
    if (!email.flaky || !email.narrow) fail.push(`email: harness: a form has no field or button ${JSON.stringify(email)}`);
    else {
      if (!(near(email.flaky.frame.top, email.flaky.button.top) && email.flaky.button.left >= email.flaky.frame.right)) {
        fail.push(`email: the wide form's field and button are not on one row ${JSON.stringify(email.flaky)}`);
      }
      if (!(email.narrow.button.top >= email.narrow.frame.bottom)) fail.push(`email: the narrow form does not stack ${JSON.stringify(email.narrow)}`);
    }

    // ── 2, 3, 5 at 375 (coarse) ────────────────────────────────────────────
    await open(["marketing-featurerows", ...SECTIONS.filter((id) => id !== "marketing-featurerows")], { width: 375, input: "coarse" });
    const phoneRows = await rowsOf("rows-alternating");
    phoneRows.forEach((r, i) => {
      if (!(r.media.bottom <= r.text.top + 1)) fail.push(`375: row ${i + 1}'s media is not above its text`);
      if (r.dom.join(",") !== "text,media") fail.push(`375: row ${i + 1} DOM order is ${r.dom.join(", ")}`);
    });
    checkSteps("how-wide @375", await stepsOf("how-wide"), { row: false });
    checkBand("cta @375", await band());
  } finally {
    await page.emulateMedia({ forcedColors: "none" });
  }

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`marketing-features:\n  - ${fail.join("\n  - ")}`);
  return `marketing-features: OK (rows alternate by placement only, steps row/column by container, grid columns and stretched links, CTA edge to edge, 375; email inline at ${Math.round(email.flaky.width)}px, stacked at ${Math.round(email.narrow.width)}px)`;
};
