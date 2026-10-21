// @covers   layout/Container
// @sections layout-container
// @tier     component
// @cost     8
//
// Browser check: Container fills its parent up to its cap, whatever lays the parent out,
// and never draws past it, whatever pads it.
//
// The cap is the CONTENT width when the Container pads by the gutter (a `measure`
// container holds one reading line at every gutter size). It centres with auto inline
// margins, which make a flex or grid item shrink to fit, and a Grid's wrapper and a Card
// are size containers with no width of their own: sized by its content, a Container
// collapsed to its gutters in a Stack, one word per line. Opened alone at 1440 and at
// 390, for every `.r-layout-container` in the section: Container → Grid {1, @xl 2, @3xl
// 3} → Cards in a block, a Stack, an Inline and a grid cell (page; measure; page with no
// gutter and `px-r4`; measure with the gutter replaced by `px-r1`), the page / measure /
// full row and the Containers in Sections:
//   1. harness: each parent kind holds the four cases; the gutter (padding) is --GUTTER
//      as resolved beside it and the re-padded cases pad by something else; at 1440 at
//      least one gutter Container is held by its cap and one by its parent;
//   2. a gutter Container's content box is min(parent − 2 × --GUTTER, --PAGE-MAX or
//      --MEASURE as resolved in it; none for `full`), ±1px;
//   3. every Container fills: its border box is the parent's width, or less only where
//      its max-inline-size holds it, ±1px;
//   4. centred: as much room before it as after it in the parent, ±1px;
//   5. nothing spills: the Container inside its parent, every card inside the
//      Container's content box, no parent, demo frame or page wider than it shows;
//   6. a Grid inside draws the columns its own width asks for (@xl 36rem, @3xl 48rem);
//   7. no console or page error.
async (page) => {
  const fail = [];
  const notes = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const CASES = "page,measure,padded,repadded";

  const read = () =>
    page.evaluate(() => {
      const section = document.querySelector("#layout-container");
      const frame = section.querySelector(".sc-demo");
      const px = (v) => Number.parseFloat(v);
      const probe = (host, value) => {
        const el = document.createElement("div");
        el.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
        host.append(el);
        const w = el.getBoundingClientRect().width;
        el.remove();
        return w;
      };
      const rem = px(getComputedStyle(document.documentElement).fontSize);
      return {
        rem,
        frameSpill: frame.scrollWidth - frame.clientWidth,
        pageSpill: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        kinds: [...section.querySelectorAll("[data-sc-parent]")].map((p) => ({
          kind: p.dataset.scParent,
          cases: [...p.children].map((c) => c.dataset.scContainer ?? null),
        })),
        containers: [...section.querySelectorAll(".r-layout-container")].map((c, i) => {
          const parent = c.parentElement;
          const ps = getComputedStyle(parent);
          const cs = getComputedStyle(c);
          const p = parent.getBoundingClientRect();
          const r = c.getBoundingClientRect();
          const width = c.className.match(/(?:max-w-|r-layout-container-)(page|measure)\b/)?.[1] ?? "full";
          const kind = parent.dataset.scParent ?? parent.localName;
          const pStart = p.left + px(ps.borderLeftWidth) + px(ps.paddingLeft);
          const pEnd = p.right - px(ps.borderRightWidth) - px(ps.paddingRight);
          const padStart = px(cs.paddingLeft);
          const padEnd = px(cs.paddingRight);
          const sides = padStart + padEnd + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
          const contentStart = r.left + padStart;
          const contentEnd = r.right - padEnd;
          const wrapper = c.querySelector(":scope > .\\@container");
          const maxWidth = cs.maxWidth === "none" ? Infinity : px(cs.maxWidth);
          return {
            label: `${kind} › ${c.dataset.scContainer ?? width} #${i}`,
            case: c.dataset.scContainer ?? null,
            width,
            byGutter: c.classList.contains("px-gutter"),
            parentContent: pEnd - pStart,
            parentSpill: parent.scrollWidth - parent.clientWidth,
            gutter: padStart,
            gutterEnd: padEnd,
            gutterToken: probe(parent, "var(--GUTTER)"),
            maxBorder: cs.boxSizing === "border-box" ? maxWidth : maxWidth + sides,
            cap: width === "page" ? probe(c, "var(--PAGE-MAX)") : width === "measure" ? probe(c, "var(--MEASURE)") : Infinity,
            border: r.width,
            content: contentEnd - contentStart,
            before: r.left - pStart,
            after: pEnd - r.right,
            spillsParent: r.left < pStart - 0.5 || r.right > pEnd + 0.5,
            cards: [...c.querySelectorAll(":scope > .\\@container > .grid > *")].map((card) => {
              const k = card.getBoundingClientRect();
              return { left: k.left, right: k.right };
            }),
            contentStart,
            contentEnd,
            gridWidth: wrapper ? wrapper.getBoundingClientRect().width : null,
          };
        }),
      };
    });

  const seen = {};
  try {
    for (const width of [1440, 390]) {
      await openSection(page, "layout-container", { width, view: { theme: "default", density: "comfortable", input: "fine" } });
      const m = await read();
      const at = `${width}`;

      // 1. harness
      const kinds = Object.fromEntries(m.kinds.map((k) => [k.kind, k.cases.join(",")]));
      for (const kind of ["block", "stack", "inline", "grid"])
        if (kinds[kind] !== CASES) fail.push(`${at}: harness: the ${kind} parent holds [${kinds[kind] ?? "nothing"}], expected [${CASES}]`);
      const withGrid = m.containers.filter((c) => c.gridWidth !== null);
      if (withGrid.length !== 16) fail.push(`${at}: harness: ${withGrid.length} Containers hold a Grid, expected 16`);
      if (!m.containers.some((c) => c.width === "full")) fail.push(`${at}: harness: no width="full" Container`);
      for (const c of m.containers) {
        const repadded = c.case === "padded" || c.case === "repadded";
        if (repadded === c.byGutter) fail.push(`${at} ${c.label}: harness: ${c.byGutter ? "pads" : "does not pad"} by px-gutter`);
        if (c.byGutter && (Math.abs(c.gutter - c.gutterToken) > 0.5 || Math.abs(c.gutterEnd - c.gutterToken) > 0.5))
          fail.push(`${at} ${c.label}: harness: padding ${c.gutter}/${c.gutterEnd}px, --GUTTER ${c.gutterToken}px`);
        if (repadded && !(c.gutter > 0 && Math.abs(c.gutter - c.gutterToken) > 1))
          fail.push(`${at} ${c.label}: harness: pads ${c.gutter}px, --GUTTER ${c.gutterToken}px; expected another non-zero padding`);
      }
      const byGutter = m.containers.filter((c) => c.byGutter);
      const capped = byGutter.filter((c) => c.cap < c.parentContent - 2 * c.gutter);
      if (width === 1440 && (capped.length === 0 || capped.length === byGutter.length))
        fail.push(`${at}: harness: ${capped.length} of ${byGutter.length} gutter Containers are held by their cap; expected some, not all`);

      for (const c of m.containers) {
        // 2. a gutter Container's content: the parent less the gutters, up to the cap
        if (c.byGutter) {
          const expected = Math.min(c.parentContent - 2 * c.gutter, c.cap);
          if (Math.abs(c.content - expected) > 1)
            fail.push(`${at} ${c.label}: content ${c.content.toFixed(1)}px, expected min(${c.parentContent.toFixed(1)} − 2 × ${c.gutter.toFixed(1)}, ${c.cap.toFixed(1)}) = ${expected.toFixed(1)}px`);
        }
        // 3. fills
        const fill = Math.min(c.parentContent, c.maxBorder);
        if (Math.abs(c.border - fill) > 1)
          fail.push(`${at} ${c.label}: ${c.border.toFixed(1)}px wide, expected min(parent ${c.parentContent.toFixed(1)}, its cap ${c.maxBorder.toFixed(1)}) = ${fill.toFixed(1)}px`);
        // 4. centred
        if (Math.abs(c.before - c.after) > 1) fail.push(`${at} ${c.label}: ${c.before.toFixed(1)}px before it, ${c.after.toFixed(1)}px after`);
        // 5. no spill
        if (c.spillsParent || c.parentSpill > 0) fail.push(`${at} ${c.label}: draws past its parent (the parent scrolls ${c.parentSpill}px)`);
        const out = c.cards.filter((k) => k.left < c.contentStart - 0.5 || k.right > c.contentEnd + 0.5);
        if (out.length) fail.push(`${at} ${c.label}: ${out.length} card(s) outside the content box`);
        // 6. the Grid's columns
        if (c.gridWidth !== null) {
          const cols = c.gridWidth >= 48 * m.rem ? 3 : c.gridWidth >= 36 * m.rem ? 2 : 1;
          const drawn = new Set(c.cards.map((k) => Math.round(k.left))).size;
          if (c.cards.length !== 3) fail.push(`${at} ${c.label}: harness: ${c.cards.length} cards found, expected 3`);
          if (drawn !== cols) fail.push(`${at} ${c.label}: the Grid is ${c.gridWidth.toFixed(1)}px wide and draws ${drawn} column(s), expected ${cols}`);
          if (Math.abs(c.gridWidth - c.content) > 1) fail.push(`${at} ${c.label}: the Grid is ${c.gridWidth.toFixed(1)}px wide in ${c.content.toFixed(1)}px of content`);
          seen[`${at}:${cols}`] = true;
        }
      }
      if (m.frameSpill > 0) fail.push(`${at}: the demo frame scrolls ${m.frameSpill}px sideways`);
      if (m.pageSpill > 0) fail.push(`${at}: the page scrolls ${m.pageSpill}px sideways`);
      notes.push(`${at}: ${m.containers.length} Containers, ${capped.length} capped`);
    }
    if (!seen["390:1"] || !(seen["1440:2"] || seen["1440:3"]))
      fail.push(`harness: the Grids drew ${Object.keys(seen).join(" ")}; expected one column at 390 and more at 1440`);
    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`layout-container:\n  ${fail.join("\n  ")}`);
  return `layout-container OK: a gutter Container's content is min(parent − 2 × gutter, cap); every Container fills, centres and stays inside a block, a Stack, an Inline and a grid cell, re-padded too (${notes.join("; ")})`;
}
