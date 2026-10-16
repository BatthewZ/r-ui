// Browser check: Kanban layout across density, input and width.
//
// jsdom lays nothing out, so the sizes, the narrow layout and the hit areas are settled here.
// On the Overview's Kanban section it asserts:
//   1. harness: at fine input the page's --HIT-MIN is 24px and the compact board's
//      --R-SIZE-4 is 6px against the page's 8px (the source's per-density values);
//   2. density: a comfortable card's padding is the page's --R-SIZE-4 and a compact card's
//      the compact board's, so compact cards are shorter for the same content;
//   3. wide (1280): the incident board does not snap and its columns sit side by side
//      within --COLUMN-MD … --COLUMN-LG; the narrow board snaps (x mandatory) and each
//      expanded column is 85% of the board (±2px), the folded Done of the compact board
//      is narrower than any expanded column;
//   4. coarse input: every card, add button and collapse button answers --HIT-MIN: cards
//      and add buttons are at least 44px tall, and a press 20px from a collapse button's
//      centre on each axis lands on that button (its hit area), the folded strip's too;
//   5. 375px, coarse: no page scrolls sideways; no board root is wider than its demo; the
//      incident board now snaps and its columns are 85% of it; a card's content never reaches
//      past its card (the long unbroken title wraps inside);
//   6. no console or page error.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const ANCHOR = "boards-kanban";
  const COMPACT = '[data-sc="kanban-compact"]';

  const open = async ({ input = "fine", width = 1280 } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${ANCHOR}`);
    await page.evaluate(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), {
      key: SHOWCASE_VIEW_KEY,
      view: { theme: "default", density: "comfortable", input },
    });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${ANCHOR}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
  };
  /** A length token resolved in px where `sel` is drawn (an unregistered custom property reads back as written). */
  const px = (sel, prop) =>
    page.evaluate(
      ({ s, p }) => {
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${p})`;
        document.querySelector(s).append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      },
      { s: sel, p: prop },
    );
  /** Every board's geometry: scroller snap, column widths, card sizes and spills. */
  const boards = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".r-boards-kanban")].map((root) => {
        const scroller = root.querySelector(".r-boards-kanban-scroller");
        const r = root.getBoundingClientRect();
        const frame = root.parentElement.getBoundingClientRect();
        const columns = [...root.querySelectorAll("[data-kanban-column]")].map((c) => ({
          id: c.dataset.kanbanColumn,
          folded: c.hasAttribute("data-collapsed"),
          width: c.getBoundingClientRect().width,
        }));
        // A folded column's cards are not drawn.
        const cards = [...root.querySelectorAll("[data-kanban-card]")].filter((card) => card.checkVisibility()).map((card) => ({
          height: card.getBoundingClientRect().height,
          // Content past the card's border box, either side. Not `scrollWidth`: that also counts a
          // control's coarse hit area (a pseudo-element), which may overhang into the list's padding.
          spill: (() => {
            const range = document.createRange();
            range.selectNodeContents(card);
            const t = range.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            return Math.max(t.right - c.right, c.left - t.left);
          })(),
          padding: Number.parseFloat(getComputedStyle(card).paddingTop),
        }));
        return {
          name: root.dataset.sc,
          width: r.width,
          wider: r.right - frame.right,
          snap: getComputedStyle(scroller).scrollSnapType,
          columns,
          cards,
          adds: [...root.querySelectorAll(".r-boards-kanban-footer button")].map((b) => b.getBoundingClientRect().height),
        };
      }),
    );
  const byName = (list, name) => list.find((b) => b.name === name);

  // ── 1: harness ──────────────────────────────────────────────────────────
  await open();
  const hitFine = await px("html", "--HIT-MIN");
  const sizePage = await px("html", "--R-SIZE-4");
  const sizeCompact = await px(COMPACT, "--R-SIZE-4");
  if (hitFine !== 24 || sizePage !== 8 || sizeCompact !== 6) fail.push(`harness: --HIT-MIN ${hitFine}, --R-SIZE-4 page ${sizePage} / compact ${sizeCompact}; the source predicts 24, 8, 6`);

  // ── 2 + 3: density and the wide layout ──────────────────────────────────
  const wide = await boards();
  if (wide.length < 6) fail.push(`harness: ${wide.length} boards in the section`);
  const incidents = byName(wide, "kanban-incidents");
  const narrow = byName(wide, "kanban-narrow");
  const compact = byName(wide, "kanban-compact");
  if (!incidents?.cards.length || incidents.cards.some((c) => c.padding !== 8)) fail.push(`comfortable card paddings ${JSON.stringify(incidents?.cards.map((c) => c.padding))}`);
  if (!compact?.cards.length || compact.cards.some((c) => c.padding !== 6)) fail.push(`compact card paddings ${JSON.stringify(compact?.cards.map((c) => c.padding))}`);
  if (incidents && compact && !(Math.max(...compact.cards.map((c) => c.height)) <= Math.max(...incidents.cards.map((c) => c.height)))) {
    fail.push("compact cards are not shorter than comfortable ones");
  }
  const colMd = await px("html", "--COLUMN-MD");
  const colLg = await px("html", "--COLUMN-LG");
  if (incidents?.snap !== "none") fail.push(`the wide incident board snaps (${incidents?.snap})`);
  if (!incidents || incidents.columns.some((c) => c.width < colMd - 1 || c.width > colLg + 1)) fail.push(`wide columns ${JSON.stringify(incidents?.columns)} outside ${colMd}–${colLg}`);
  if (narrow?.snap !== "x mandatory") fail.push(`the narrow board's snap is ${narrow?.snap}`);
  if (!narrow || narrow.columns.some((c) => Math.abs(c.width - narrow.width * 0.85) > 2)) fail.push(`narrow columns ${JSON.stringify(narrow?.columns.map((c) => c.width))}, board ${narrow?.width}`);
  const folded = compact?.columns.find((c) => c.folded);
  if (!folded || !compact.columns.filter((c) => !c.folded).every((c) => c.width > folded.width * 2)) fail.push(`the folded column is not a narrow strip: ${JSON.stringify(compact?.columns)}`);

  // ── 4: coarse targets ───────────────────────────────────────────────────
  await open({ input: "coarse" });
  const coarse = await boards();
  for (const b of coarse) {
    if (b.cards.some((c) => c.height < 44)) fail.push(`coarse: ${b.name} has a card under 44px (${Math.min(...b.cards.map((c) => c.height))})`);
    if (b.adds.some((h) => h < 44)) fail.push(`coarse: ${b.name} has an add button under 44px`);
  }
  await page.locator(COMPACT).scrollIntoViewIfNeeded();
  const toggles = await page.evaluate((sel) => {
    const buttons = [...document.querySelectorAll(`${sel} .r-boards-kanban-toggle`)];
    return buttons.map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hits = [
        [cx - 20, cy],
        [cx + 20, cy],
        [cx, cy - 20],
        [cx, cy + 20],
      ].map(([x, y]) => b.contains(document.elementFromPoint(x, y)));
      return { name: b.getAttribute("aria-label"), size: Math.round(r.width), hits };
    });
  }, COMPACT);
  if (toggles.length !== 4) fail.push(`harness: the compact board has ${toggles.length} collapse buttons`);
  for (const t of toggles) if (!t.hits.every(Boolean)) fail.push(`coarse: "${t.name}" (${t.size}px) misses a press 20px from its centre: ${JSON.stringify(t.hits)}`);

  // ── 5: 375 ──────────────────────────────────────────────────────────────
  await open({ input: "coarse", width: 375 });
  const phone = await boards();
  const page375 = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
  if (page375 > 0) fail.push(`375: the page scrolls sideways by ${page375}px`);
  for (const b of phone) {
    if (b.wider > 1) fail.push(`375: ${b.name} is ${b.wider}px wider than its demo`);
    if (b.cards.some((c) => c.spill > 0)) fail.push(`375: a card in ${b.name} is widened by its content`);
  }
  const small = byName(phone, "kanban-incidents");
  if (small?.snap !== "x mandatory") fail.push(`375: the incident board's snap is ${small?.snap}`);
  if (!small || small.columns.some((c) => Math.abs(c.width - small.width * 0.85) > 2)) fail.push(`375: columns ${JSON.stringify(small?.columns.map((c) => c.width))}, board ${small?.width}`);

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`kanban-layout:\n  - ${fail.join("\n  - ")}`);
  return "kanban-layout: OK (density paddings, wide columns, narrow snap at 85%, folded strip, coarse targets, no spill at 375)";
};
