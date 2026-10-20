// @covers   *
// @tier     sweep
// @cost     100
//
// Browser check: every section, all on one page (`#/all`), renders cleanly on every axis.
//
// For every theme the showcase lists × comfortable / compact × fine / coarse at
// 1280 and 375 wide (all 32 combinations) it measures that page. Each width opens
// on a fresh load, and so do a few combinations chosen so that every theme and both
// values of density, input and width mount fresh (`viewMatrix`, rotated by the run's
// seed); every other combination is switched to live (`setView`), as a user switches.
// For each it asserts:
//   1. the harness reads what the source predicts: --HIT-MIN is 24px on fine and
//      44px on coarse, --CONTROL-PAD is the density's step 3 plus half of what the
//      floor adds to its named control height, and --CONTROL-H is max(the theme's named value for the
//      density, --HIT-MIN) (a theme may retune what a density means);
//   2. every discovered section rendered, and no section's error boundary tripped
//      (`[data-section-error]`), so one broken demo cannot hide behind the rest;
//   3. no console error and no uncaught page error during the load or the switch;
//   4. no horizontal page scroll (documentElement.scrollWidth <= clientWidth), and
//      nothing inside a demo scrolls or clips sideways: neither the demo frame
//      (`.sc-demo` is `overflow-x: auto`) nor any scroll container within it, since
//      a spill lands in the NEAREST scroller and an inner one hides it from the
//      frame. Exempt: text controls (their value scrolls by nature), truncated
//      text (`text-overflow: ellipsis`), a clip around no text and no control (a
//      drawing: a partial star, a progress sweep), and a scroller designed to scroll
//      (a code block's lines, a wide table, an overflowing tab strip) where the
//      demo marks it, or an ancestor inside the demo, with `data-sc-scrolls`;
//   5. at coarse input, every pointer target in every demo (a native control, a link, an
//      interactive role; not a bare `tabindex` stop, nothing inert, hidden or `aria-hidden`)
//      is at least --HIT-MIN on both axes, measured as what a press can land on: its box,
//      its own ::before/::after, its labels, a `hit-area` part drawn for it, a text field's
//      frame, a slider's control. Passes too: a link inline in a line of text (WCAG 2.5.8's
//      inline exception), and a `hit-area` that follows another `hit-area` sibling (it does
//      not grow toward it) whose centre is --HIT-MIN from that one's. A demo opts an element
//      out with `data-sc-hit-exempt="<why>"` on it or an ancestor inside the demo. The targets
//      under the floor today are listed in KNOWN_UNDER_FLOOR, each a finding, and each must
//      still be found (a fix removes it);
//   6. every `.h-control` in a demo is exactly the --CONTROL-H resolved at its parent (a
//      probe there, so a nested density boundary counts), every `.size-control` exactly
//      that on both axes, and every `.r-form-frame` and `.min-h-control` at least that;
//      and every text control padded by the contract (`.px-control-pad`) has exactly the
//      --CONTROL-PAD resolved at its parent on both sides.
//
// Run it through `bun run browser:check`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print sweep-overview)"
async (page) => {
  const THEMES = (await showcaseThemes(page)).map((t) => t.name);
  const INPUTS = { fine: 24, coarse: 44 };

  // Targets under the coarse floor today, each a finding waiting on a product decision. Like
  // stress-matrix's known bugs, each must still be found somewhere in the run (fixed: remove it),
  // and anything not listed fails. Matched against "section: <tag role .class> "name" in [where]".
  const KNOWN_UNDER_FLOOR = [
    // Components.
    { match: /<button \.r-form-stepper>/, short: "both", finding: "NumberInput's steppers are 40px inside the 44px frame" },
    { match: /<button \.r-form-icon-button> "Show options"/, short: "pitch", finding: "Combobox's toggle owns 29px from the field's input (its hit area does not grow toward it)" },
    { match: /^(form-radiogroup: <input \.r-form-radio-input>|form-checkbox: <input \.r-form-check-input>)/, short: "width", finding: "a Radio or Checkbox with a short label is narrower than --HIT-MIN (a narrow face shows the Checkbox's)" },
    { match: /^(content-codeblock|content-markdown): <button[^>]*icon-button> "Copy code"/, short: "pitch", finding: "CodeBlock's header actions sit under --HIT-MIN apart" },
    { match: /^marketing-mediacard: <button[^>]*icon-button> "Share"/, short: "pitch", finding: "MediaCard's actions sit under --HIT-MIN apart" },
    { match: /<div role=separator \.r-data-table-resize>/, short: "width", finding: "DataTable's resize handles are half the floor wide by design (data-datatable asserts it)" },
    { match: /^(data-table|data-datatable|data-datatablefeatures|data-datatableserver|data-virtualizedtable|filters-filterbar|filters-filterbardatatable): <button> /, short: "width", finding: "a narrow column's header (sort) button is narrower than --HIT-MIN" },
    { match: /^(data-datatable(features|server)|filters-filterbardatatable): <(select|input)[^>]*> "Filter /, short: "width", finding: "a narrow column's filter control is narrower than --HIT-MIN" },
    { match: /^marketing-footer: <a \.r-primitives-link> /, short: "width", finding: "Footer's column and legal links with short labels are narrower than --HIT-MIN" },
    { match: /^navigation-treeview: <a \.r-navigation-tree-label\.r-navigation-tree-link>/, short: "height", finding: "a TreeView row's link is one text line tall inside its row" },
    { match: /^marketing-siteheader: <a> /, short: "height", finding: "SiteHeader's brand link is one text line tall" },
    { match: /^overlays-hovercard: <a \.r-primitives-link> "@/, short: "both", finding: "a HoverCard trigger Link outside running text is one text line tall" },
    // Demos: the showcase's own layout.
    { match: /^(primitives-iconbutton|overlays-tooltip|form-useform): <button[^>]*icon-button>/, short: "pitch", finding: "the demo's IconButtons sit under --HIT-MIN apart" },
    { match: /^(overlays-contextmenu: <a> |navigation-routerprovider: <a> "Billing"|feedback-banner: <a \.r-primitives-link> "Read the plan"|marketing-featurerows: <a \.r-primitives-link> "Read the guide"|primitives-link: <a \.r-primitives-link> "View details")/, short: "both", finding: "a demo's Link outside running text is one text line tall" },
  ];
  const knownSeen = new Set();

  /**
   * The geometry of every demo at this View: at coarse input every pointer target's floor, and at
   * every View each control's --CONTROL-H. Runs in the page.
   */
  const measureGeometry =
  (coarse) => {
    const css = getComputedStyle(document.documentElement);
    const hit = Number.parseFloat(css.getPropertyValue("--HIT-MIN")) * Number.parseFloat(css.fontSize);
    // Pointer targets: native controls and interactive roles. A bare `tabindex` (a focusable
    // <time>, a tab panel, a scroller) is a keyboard stop, not something to press.
    const TARGETS = [
      "a[href]", "button", "input:not([type=hidden])", "select", "textarea", "summary",
      '[role="button"]', '[role="link"]', '[role="tab"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
      '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="option"]', '[role="slider"]',
      '[role="spinbutton"]', '[role="treeitem"]', '[role="combobox"]', '[role="separator"][tabindex]',
    ].join(", ");
    const rectOf = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    /** An absolutely positioned ::before / ::after's box: its containing block's padding box less its insets. */
    const pseudoBox = (el, which) => {
      const s = getComputedStyle(el, which);
      if (s.content === "none" || s.content === "normal" || s.display === "none") return null;
      if (s.position !== "absolute" && s.position !== "fixed") return null;
      const cb = getComputedStyle(el).position !== "static" ? el : el.offsetParent;
      if (!cb) return null;
      const r = cb.getBoundingClientRect();
      const c = getComputedStyle(cb);
      const pad = {
        left: r.left + Number.parseFloat(c.borderLeftWidth),
        top: r.top + Number.parseFloat(c.borderTopWidth),
        right: r.right - Number.parseFloat(c.borderRightWidth),
        bottom: r.bottom - Number.parseFloat(c.borderBottomWidth),
      };
      const n = (v) => (v === "auto" ? null : Number.parseFloat(v));
      const [t, l, b, rt] = [n(s.top), n(s.left), n(s.bottom), n(s.right)];
      const w = Number.parseFloat(s.width);
      const h = Number.parseFloat(s.height);
      const left = l !== null ? pad.left + l : rt !== null ? pad.right - rt - w : null;
      const top = t !== null ? pad.top + t : b !== null ? pad.bottom - b - h : null;
      if (left === null || top === null || !(w > 0) || !(h > 0)) return null;
      return { left, top, right: left + w, bottom: top + h };
    };
    const union = (boxes) =>
      boxes.filter(Boolean).reduce((a, b) => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      }));
    const describe = (el) => {
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
      const cls = typeof el.className === "string" ? el.className.split(" ").filter((c) => c.startsWith("r-")).slice(0, 2).join(".") : "";
      const where = el.closest("[data-testid], [data-sc]");
      const tag = where ? ` in ${where.dataset.testid ? `[data-testid=${where.dataset.testid}]` : `[data-sc=${where.dataset.sc}]`}` : "";
      return `<${el.tagName.toLowerCase()}${el.getAttribute("role") ? ` role=${el.getAttribute("role")}` : ""}${cls ? ` .${cls}` : ""}> "${name}"${tag}`;
    };
    /** What a press can land on for `el`: its box, its own hit areas, its labels, and the box it sits in for it. */
    const targetOf = (el, demo) => {
      const parts = [rectOf(el.getBoundingClientRect()), pseudoBox(el, "::before"), pseudoBox(el, "::after")];
      for (const label of el.labels ?? []) parts.push(rectOf(label.getBoundingClientRect()), pseudoBox(label, "::before"), pseudoBox(label, "::after"));
      // A `hit-area` part drawn for it: the box around it (a checkbox's) or one inside it (a splitter's gutter).
      const host = el.parentElement?.closest(".hit-area");
      if (host && demo.contains(host) && host.querySelectorAll(TARGETS).length === 1) parts.push(pseudoBox(host, "::before"));
      for (const part of el.querySelectorAll(".hit-area")) if (!part.querySelector(TARGETS)) parts.push(pseudoBox(part, "::before"));
      // A text field's frame: a press on its padding focuses the field.
      if (el.matches("input, textarea")) {
        const frame = el.closest(".r-form-text-frame");
        if (frame && frame.querySelectorAll("input, textarea").length === 1) parts.push(rectOf(frame.getBoundingClientRect()));
      }
      // A slider's thumb: a press anywhere on its control moves the thumb there and drags it.
      if (el.matches('[role="slider"]')) {
        const control = el.closest(".r-form-slider-control");
        if (control) parts.push(rectOf(control.getBoundingClientRect()));
      }
      return union(parts);
    };
    /** Inline in a line of text (WCAG 2.5.8's inline exception): an inline element in a block that holds other text. */
    const inlineInText = (el) => {
      if (getComputedStyle(el).display !== "inline") return false;
      let block = el.parentElement;
      while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
      return !!block && block.textContent.replace(/\s+/g, "").length > el.textContent.replace(/\s+/g, "").length;
    };
    const drawn = (el) => {
      if (!el.checkVisibility({ visibilityProperty: true })) return false;
      const r = el.getBoundingClientRect();
      // Visually hidden (a skip link until focused, a native input under its drawing): no press lands on it
      // unless a label or a drawn box carries it, which `targetOf` adds.
      return r.width > 2 && r.height > 2 ? true : (el.labels?.length ?? 0) > 0 || !!el.parentElement?.closest(".hit-area");
    };
    const under = [];
    let measured = 0;
    let exempt = 0;
    for (const demo of coarse ? document.querySelectorAll(".sc-section .sc-demo") : []) {
      const section = demo.closest(".sc-section").id;
      const all = [...demo.querySelectorAll(TARGETS)].filter((el) => !el.closest("[inert], [aria-hidden='true']") && drawn(el));
      const boxes = new Map();
      const small = [];
      const big = (r) => r.right - r.left >= hit - 0.5 && r.bottom - r.top >= hit - 0.5;
      for (const el of all) {
        if (el.closest("[data-sc-hit-exempt]")) {
          exempt++;
          continue;
        }
        measured++;
        // Its own box first: most targets meet the floor by themselves.
        if (big(el.getBoundingClientRect())) continue;
        const b = targetOf(el, demo);
        boxes.set(el, b);
        if (big(b)) continue;
        if (inlineInText(el)) continue;
        small.push(el);
      }
      // A hit area that directly follows another does not grow toward it (the contract's `hit-area`):
      // in such a row each target owns one --HIT-MIN pitch, so it passes when its centre is at least
      // --HIT-MIN from the previous one's and it is --HIT-MIN tall.
      const centre = (b) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });
      for (const el of small) {
        const b = boxes.get(el);
        const self = el.matches(".hit-area") ? el : el.parentElement?.closest(".hit-area");
        const prev = self?.previousElementSibling;
        if (prev?.matches(".hit-area") && b.bottom - b.top >= hit - 0.5) {
          const pb = prev.getBoundingClientRect();
          const pitch = Math.hypot(centre(b).x - centre(pb).x, centre(b).y - centre(pb).y);
          if (pitch >= hit - 0.5) continue;
          under.push({ key: `${section}: ${describe(el)}`, w: b.right - b.left, h: b.bottom - b.top, pitch });
          continue;
        }
        under.push({ key: `${section}: ${describe(el)}`, w: b.right - b.left, h: b.bottom - b.top });
      }
    }
    // --CONTROL-H: an .h-control is exactly the token where it sits; a frame or .min-h-control at least it.
    // One probe per parent, all placed before any is read: one layout, not one per control.
    const controls = [...document.querySelectorAll(".sc-section .sc-demo :is(.h-control, .size-control, .min-h-control, .r-form-frame)")].filter((el) =>
      el.checkVisibility({ visibilityProperty: true }),
    );
    const probes = new Map();
    for (const parent of new Set(controls.map((el) => el.parentElement))) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;block-size:var(--CONTROL-H);inline-size:0";
      parent.append(probe);
      probes.set(parent, probe);
    }
    const want = new Map([...probes].map(([parent, probe]) => [parent, probe.getBoundingClientRect().height]));
    for (const probe of probes.values()) probe.remove();
    const frames = [];
    const framesMeasured = controls.length;
    for (const el of controls) {
      const token = want.get(el.parentElement);
      const { width, height } = el.getBoundingClientRect();
      const square = el.classList.contains("size-control");
      const exact = square || el.classList.contains("h-control");
      const off = (px) => (exact ? Math.abs(px - token) > 0.5 : px < token - 0.5);
      if (off(height) || (square && off(width))) {
        frames.push(`${el.closest(".sc-section").id}: ${describe(el)} is ${square ? `${width}×` : ""}${height}px, --CONTROL-H ${token}px${exact ? "" : " at least"}`);
      }
    }
    // --CONTROL-PAD: a text control's inline padding is exactly the token where it sits.
    const padded = [...document.querySelectorAll(".sc-section .sc-demo .px-control-pad")].filter((el) =>
      el.checkVisibility({ visibilityProperty: true }),
    );
    const padProbes = new Map();
    for (const parent of new Set(padded.map((el) => el.parentElement))) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--CONTROL-PAD);block-size:0";
      parent.append(probe);
      padProbes.set(parent, probe);
    }
    const wantPad = new Map([...padProbes].map(([parent, probe]) => [parent, probe.getBoundingClientRect().width]));
    for (const probe of padProbes.values()) probe.remove();
    const pads = [];
    for (const el of padded) {
      const token = wantPad.get(el.parentElement);
      const cs = getComputedStyle(el);
      const start = Number.parseFloat(cs.paddingInlineStart);
      const end = Number.parseFloat(cs.paddingInlineEnd);
      if (Math.abs(start - token) > 0.5 || Math.abs(end - token) > 0.5)
        pads.push(`${el.closest(".sc-section").id}: ${describe(el)} pads ${start}/${end}px, --CONTROL-PAD ${token}px`);
    }
    return { measured, exempt, under, framesMeasured, frames, padsMeasured: padded.length, pads };
  };

  const problems = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  let sectionCount = null;
  let sweep;
  const geometry = { targets: 0, frames: 0 };
  try {
    sweep = await sweepViews(
      page,
      { themes: THEMES, widths: [1280, 375] },
      {
        load: async ({ width, ...view }) => {
          errors.length = 0;
          await openPage(page, "all", { view, width });
        },
        check: async ({ density, input }, label) => {
          const hitPx = INPUTS[input];
          const m = await page.evaluate((density) => {
            const html = document.documentElement;
            const css = getComputedStyle(html);
            const px = (name) => {
              const v = css.getPropertyValue(name).trim();
              if (v.endsWith("rem")) return Number.parseFloat(v) * Number.parseFloat(css.fontSize);
              return v.endsWith("px") ? Number.parseFloat(v) : Number.NaN;
            };
            return {
              hit: px("--HIT-MIN"),
              named: px(`--CONTROL-H-${density.toUpperCase()}`),
              step3: px(`--R-SIZE-3-${density.toUpperCase()}`),
              pad: Number.parseFloat(css.getPropertyValue("--CONTROL-PAD")),
              control: Number.parseFloat(css.getPropertyValue("--CONTROL-H")),
              sections: document.querySelectorAll(".sc-section").length,
              demos: [...document.querySelectorAll(".sc-section .sc-demo")].filter((d) => d.childElementCount > 0).length,
              tripped: [...document.querySelectorAll("[data-section-error]")].map((e) => e.getAttribute("data-section-error")),
              invalid: document.querySelectorAll(".sc-invalid:not([data-section-error])").length,
              overflowing: [...document.querySelectorAll(".sc-section .sc-demo")].flatMap((demo) => {
                const spills = [demo, ...demo.querySelectorAll("*")].filter((el) => {
                  if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth <= 1) return false;
                  if (el.matches("input, textarea, select") || el.closest("[data-sc-scrolls]")) return false;
                  // A clip around no text and no control is a drawing (a partial star, a
                  // progress track's sweep), not content cut off.
                  if (!el.textContent.trim() && !el.querySelector("button, a, input, select, textarea, [tabindex]")) return false;
                  const cs = getComputedStyle(el);
                  return cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis";
                });
                const describe = (el) =>
                  el === demo ? "the demo frame" : `<${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? ` class="${el.className.slice(0, 40)}…"` : ""}>`;
                return spills.map((el) => `${demo.closest(".sc-section").id} (${describe(el)} ${el.scrollWidth}/${el.clientWidth}px)`);
              }),
              scrollWidth: html.scrollWidth,
              clientWidth: html.clientWidth,
            };
          }, density);
          if (m.hit !== hitPx) problems.push(`${label}: harness --HIT-MIN ${m.hit}px, source predicts ${hitPx}px`);
          if (!(m.named > 0)) problems.push(`${label}: harness could not read --CONTROL-H-${density.toUpperCase()}`);
          if (m.control !== Math.max(m.named, hitPx)) {
            problems.push(`${label}: --CONTROL-H ${m.control}px, expected max(${m.named}, ${hitPx})`);
          }
          if (!(m.step3 > 0) || Math.abs(m.pad - (m.step3 + Math.max(0, hitPx - m.named) / 2)) > 0.01) {
            problems.push(`${label}: --CONTROL-PAD ${m.pad}px, expected ${m.step3} + max(0, ${hitPx} - ${m.named}) / 2`);
          }
          if (m.sections === 0) problems.push(`${label}: no sections rendered`);
          if (sectionCount === null) sectionCount = m.sections;
          else if (m.sections !== sectionCount) problems.push(`${label}: ${m.sections} sections, first load had ${sectionCount}`);
          if (m.demos !== m.sections) problems.push(`${label}: ${m.sections - m.demos} section(s) rendered an empty demo`);
          if (m.tripped.length) problems.push(`${label}: section error boundary tripped in ${m.tripped.join(", ")}`);
          if (m.invalid) problems.push(`${label}: ${m.invalid} invalid section file(s) reported`);
          if (m.scrollWidth > m.clientWidth) problems.push(`${label}: horizontal scroll (${m.scrollWidth} > ${m.clientWidth})`);
          if (m.overflowing.length) problems.push(`${label}: demo content wider than its box in ${m.overflowing.join(", ")}`);
          for (const e of errors) problems.push(`${label}: ${e}`);
          errors.length = 0;

          // 5 + 6: the geometry sweep.
          const g = await page.evaluate(measureGeometry, input === "coarse");
          geometry.targets += g.measured;
          geometry.frames += g.framesMeasured;
          if (!(g.framesMeasured > 100)) problems.push(`${label}: harness: only ${g.framesMeasured} controls measured for --CONTROL-H`);
          if (input === "coarse" && !(g.measured > 1000)) problems.push(`${label}: harness: only ${g.measured} pointer targets measured`);
          for (const f of g.frames) problems.push(`${label}: ${f}`);
          if (!(g.padsMeasured > 50)) problems.push(`${label}: harness: only ${g.padsMeasured} text controls measured for --CONTROL-PAD`);
          for (const p of g.pads) problems.push(`${label}: ${p}`);
          const floor = INPUTS[input] - 0.5;
          for (const u of g.under) {
            // A known finding covers only the shortfall it names: the same target short on its other axis is new.
            const short = u.pitch !== undefined ? "pitch" : u.w < floor && u.h < floor ? "both" : u.w < floor ? "width" : "height";
            const known = KNOWN_UNDER_FLOOR.find((k) => k.match.test(u.key) && (k.short === short || (k.short === "both" && short !== "pitch")));
            if (known) knownSeen.add(known);
            else {
              const size = `${Math.round(u.w)}×${Math.round(u.h)}${u.pitch !== undefined ? `, ${Math.round(u.pitch)}px from the hit area before it` : ""}`;
              problems.push(`${label}: under the ${INPUTS[input]}px floor: ${u.key} ${size}`);
            }
          }
        },
      },
    );
  } finally {
    stopErrors();
  }

  for (const k of KNOWN_UNDER_FLOOR) {
    if (!knownSeen.has(k)) problems.push(`known under the floor, not found in any coarse View: ${k.match} (${k.finding}): fixed? remove it from KNOWN_UNDER_FLOOR`);
  }
  if (problems.length) throw new Error(`sweep-overview FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `sweep-overview OK (${sweep.combos} combinations, ${sectionCount} sections each; ${geometry.targets} pointer targets at coarse, ${geometry.frames} control heights; ${KNOWN_UNDER_FLOOR.length} known under the floor; fresh: ${sweep.fresh.join(", ")})`;
}
