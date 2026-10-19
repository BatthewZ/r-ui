// @covers   boards/Kanban
// @sections boards-kanban
// @tier     component
// @flags    touch
//
// Browser check: Kanban across density, input and width, and moved by keyboard, mouse and real
// touch (CDP), with real layout, focus, scrolling and the top layer.
//
// jsdom lays nothing out and has no top layer, no scrolling and no touch gestures, so the sizes,
// the narrow layout, the hit areas, where the drop line sits, which column a key reaches on screen,
// a keyed move scrolling into view and the drag itself are settled here. The keyboard model (pick
// up, moves, announcements, one committed change, focus, cancel by Escape or blur, RTL keys, a
// folded column's end) is Kanban.test.tsx's. On the Kanban section, opened alone, it asserts:
//   1. coarse input: every card is at least 44px tall, and a press 20px from a collapse
//      button's centre on each axis lands on that button (its hit area), the folded strip's
//      too (the add buttons' floor is sweep-overview's geometry sweep);
//   2. 375px, coarse: no board root is wider than its demo (the page not scrolling sideways
//      is sweep-overview's sweep); the incident board now snaps and its columns are 85% of it;
//      a card's content never reaches past its card (the long unbroken title wraps inside);
//   then at comfortable + fine, 1280:
//   3. harness: the page's --HIT-MIN is 24px and the compact board's --R-SIZE-4 is 6px against
//      the page's 8px (the source's per-density values);
//   4. density: a comfortable card's padding is the page's --R-SIZE-4 and a compact card's
//      the compact board's, and no compact card is taller than the tallest comfortable one; wide: the
//      incident board does not snap and its columns sit side by side within --COLUMN-MD …
//      --COLUMN-LG; the narrow board snaps (x mandatory) and each expanded column is 85% of
//      the board (±2px), the folded Done of the compact board is narrower than any expanded column;
//   keyboard:
//   5. harness: the incident board's columns hold Triage 7, In progress 3 (not marked over its
//      limit of 3), Review 3 (limit 2, so marked "Over limit" with a visible badge), Done 1 cards,
//      its live region is empty and no move has been made (the count text is Kanban.test.tsx's);
//   6. Space picks INC-2041 up; ArrowDown puts the drop line between Triage's 2nd and 3rd cards
//      (the source excluded), inside the gap (±1px); ArrowRight puts it between In progress's
//      1st and 2nd cards; Escape;
//   7. right to left: in the RTL board, ArrowLeft from the first column targets the second
//      column, which is drawn to the LEFT of the first; ArrowRight comes back; Escape;
//   8. the narrow board (one column in view): ArrowRight three times targets Done, and the
//      board scrolled so Done is inside the scroller's box; Escape;
//   pointer (the narrow board scrolled back to its start; nothing was moved by the keys):
//   9. harness: the incident board reads Triage 7 / In progress 3, no move made; its Triage
//      list scrolls (taller content than box) and the narrow board scrolls sideways and
//      snaps (`scroll-snap-type` x mandatory) at rest;
//  10. a mouse press on INC-2042 that moves 2px is no drag (no source mark); moved on, in
//      steps, to the gap between In progress's 1st and 2nd cards it is: the card is the
//      marked source, a preview copy follows in the top layer (`:popover-open`) with its
//      grab point under the pointer (±2px), In progress is the outlined drop target and the
//      drop line sits in that gap (±1px); nothing has been committed mid-drag;
//  11. the release commits exactly once (the demo's log: inc-42 from triage #2 to progress
//      #2), the card is In progress's 2nd, the preview is gone, and "Dropped …" is announced;
//  12. a drag that starts on a card's Acknowledge button moves the card and does not press
//      the button (its release click is swallowed); a plain click then presses it;
//  13. Escape mid-drag cancels: the source mark and preview go, "Cancelled. …" is announced,
//      and the release afterwards commits nothing;
//  14. edge scrolling: on the narrow board, held near the scroller's inline end the board
//      scrolls toward it (snap let go while dragging), and near its start back again; on
//      the incident board, held near the bottom of Triage's list the list scrolls;
//  15. touch (CDP): a touch that moves 60px at once and then rests is a scroll: no card is
//      ever marked; a touch held still for 600ms picks the card up (source mark, preview),
//      moving it into Review and lifting commits one move to review;
//  16. forced colours: mid-drag the source card's edge is dashed, the target column's
//      outline dashed and visible, and the drop line's rule and ring are solid lines of a
//      non-transparent system colour, so the line does not rest on colour;
//  17. no console or page error.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const BOARD = '[data-sc="kanban-incidents"]';
  const NARROW = '[data-sc="kanban-narrow"]';
  const COMPACT = '[data-sc="kanban-compact"]';

  const open = async ({ input = "fine", width = 1280 } = {}) => {
    const section = await openSection(page, "boards-kanban", { width, view: { theme: "default", density: "comfortable", input } });
    await section.scrollIntoViewIfNeeded();
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
        };
      }),
    );
  const byName = (list, name) => list.find((b) => b.name === name);

  // ── 1: coarse targets ───────────────────────────────────────────────────
  await open({ input: "coarse" });
  const coarse = await boards();
  for (const b of coarse) {
    if (b.cards.some((c) => c.height < 44)) fail.push(`coarse: ${b.name} has a card under 44px (${Math.min(...b.cards.map((c) => c.height))})`);
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

  // ── 2: 375 ──────────────────────────────────────────────────────────────
  await open({ input: "coarse", width: 375 });
  const phone = await boards();
  for (const b of phone) {
    if (b.wider > 1) fail.push(`375: ${b.name} is ${b.wider}px wider than its demo`);
    if (b.cards.some((c) => c.spill > 0)) fail.push(`375: a card in ${b.name} is widened by its content`);
  }
  const small = byName(phone, "kanban-incidents");
  if (small?.snap !== "x mandatory") fail.push(`375: the incident board's snap is ${small?.snap}`);
  if (!small || small.columns.some((c) => Math.abs(c.width - small.width * 0.85) > 2)) fail.push(`375: columns ${JSON.stringify(small?.columns.map((c) => c.width))}, board ${small?.width}`);

  // ── 3: harness ──────────────────────────────────────────────────────────
  await open();
  const hitFine = await px("html", "--HIT-MIN");
  const sizePage = await px("html", "--R-SIZE-4");
  const sizeCompact = await px(COMPACT, "--R-SIZE-4");
  if (hitFine !== 24 || sizePage !== 8 || sizeCompact !== 6) fail.push(`harness: --HIT-MIN ${hitFine}, --R-SIZE-4 page ${sizePage} / compact ${sizeCompact}; the source predicts 24, 8, 6`);

  // ── 4: density and the wide layout ──────────────────────────────────────
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

  // Keyboard: where the drop line and the targeted column are drawn, and a keyed move's scroll.
  {
    const read = (board) =>
      page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const log = root.parentElement.querySelector('[data-sc="kanban-moves"]');
        const columns = [...root.querySelectorAll("[data-kanban-column]")].map((col) => ({
          id: col.dataset.kanbanColumn,
          cards: [...col.querySelectorAll("[data-kanban-card]")].map((c) => c.dataset.kanbanCard),
          over: col.hasAttribute("data-over-limit"),
          badge: [...col.querySelectorAll(".r-boards-kanban-over")].some((b) => b.getBoundingClientRect().width > 0),
          count: col.querySelector(".r-boards-kanban-count")?.textContent.trim(),
          target: col.hasAttribute("data-drop-target"),
          overTarget: col.hasAttribute("data-drop-over-limit"),
        }));
        const active = document.activeElement;
        return {
          columns,
          status: root.querySelector("[data-kanban-status]").textContent,
          focused: active?.dataset?.kanbanCard ?? null,
          source: root.querySelector("[data-drag-source]")?.dataset.kanbanCard ?? null,
          moves: Number(log?.dataset.count ?? -1),
          log: log?.textContent ?? "",
        };
      }, board);
    /** Where the drop line's centre sits against the cards around it (the source skipped). */
    const line = (board, column, k) =>
      page.evaluate(
        ({ sel, column, k }) => {
          const col = [...document.querySelectorAll(`${sel} [data-kanban-column]`)].find((c) => c.dataset.kanbanColumn === column);
          const ind = col?.querySelector(".r-boards-kanban-indicator");
          if (!ind) return null;
          const r = ind.getBoundingClientRect();
          const cards = [...col.querySelectorAll("[data-kanban-card]:not([data-drag-source])")].map((c) => c.getBoundingClientRect());
          return { y: r.top + r.height / 2, above: cards[k - 1]?.bottom ?? null, below: cards[k]?.top ?? null, width: r.width };
        },
        { sel: board, column, k },
      );
    const between = (l) => l && l.width > 0 && (l.above === null || l.y >= l.above - 1) && (l.below === null || l.y <= l.below + 1);
    const col = (state, id) => state.columns.find((c) => c.id === id);

    // ── 5: harness ──────────────────────────────────────────────────────────
    const start = await read(BOARD);
    const sizes = start.columns.map((c) => `${c.id}:${c.cards.length}`).join(" ");
    if (sizes !== "triage:7 progress:3 review:3 done:1") fail.push(`harness: the incident board reads ${sizes}`);
    if (!col(start, "review")?.over || !col(start, "review")?.badge) fail.push("harness: Review (3 of 2) is not marked over its limit with a visible badge");
    if (col(start, "progress")?.over) fail.push("harness: In progress (3 of 3) is marked over its limit");
    if (start.status !== "" || start.moves !== 0) fail.push(`harness: live region ${JSON.stringify(start.status)}, moves ${start.moves}`);

    // ── 6: Space picks INC-2041 up; the drop line in Triage, then In progress ──
    const first = page.locator(`${BOARD} [data-kanban-card="inc-41"]`);
    await first.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    const down = await line(BOARD, "triage", 1);
    if (!between(down)) fail.push(`the drop line in Triage is not between its 2nd and 3rd cards: ${JSON.stringify(down)}`);
    await page.keyboard.press("ArrowRight");
    const right = await line(BOARD, "progress", 1);
    if (!between(right)) fail.push(`the drop line in In progress is not between its 1st and 2nd cards: ${JSON.stringify(right)}`);
    await page.keyboard.press("Escape");

    // ── 7: right to left ────────────────────────────────────────────────────
    const RTL = '[data-sc="kanban-rtl"]';
    await page.locator(RTL).scrollIntoViewIfNeeded();
    await page.locator(`${RTL} [data-kanban-card="ar-1"]`).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    const rtl = await page.evaluate((sel) => {
      const cols = [...document.querySelectorAll(`${sel} [data-kanban-column]`)];
      const box = (c) => c.getBoundingClientRect();
      return {
        target: cols.find((c) => c.hasAttribute("data-drop-target"))?.dataset.kanbanColumn,
        firstLeft: box(cols[0]).left,
        secondRight: box(cols[1]).right,
      };
    }, RTL);
    if (rtl.target !== "progress") fail.push(`RTL: ArrowLeft from the first column targets ${rtl.target}, expected the second (progress)`);
    if (!(rtl.secondRight <= rtl.firstLeft + 1)) fail.push(`RTL: the second column is not drawn left of the first (${JSON.stringify(rtl)})`);
    await page.keyboard.press("ArrowRight");
    const back = await page.evaluate((sel) => document.querySelector(`${sel} [data-drop-target]`)?.dataset.kanbanColumn, RTL);
    if (back !== "triage") fail.push(`RTL: ArrowRight did not come back to the first column (${back})`);
    await page.keyboard.press("Escape");

    // ── 8: a keyboard move scrolls the narrow board ─────────────────────────
    await page.locator(NARROW).scrollIntoViewIfNeeded();
    await page.locator(`${NARROW} [data-kanban-card="inc-42"]`).focus();
    await page.keyboard.press("Space");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    const narrow = await page.evaluate((sel) => {
      const scroller = document.querySelector(`${sel} .r-boards-kanban-scroller`);
      const done = document.querySelector(`${sel} [data-kanban-column="done"]`);
      const s = scroller.getBoundingClientRect();
      const d = done.getBoundingClientRect();
      return { target: done.hasAttribute("data-drop-target"), scrolled: Math.abs(scroller.scrollLeft), inside: d.left >= s.left - 1 && d.right <= s.right + 1, wide: scroller.scrollWidth > scroller.clientWidth };
    }, NARROW);
    if (!narrow.wide) fail.push("harness: the narrow board does not scroll sideways");
    if (!narrow.target || !narrow.inside || narrow.scrolled === 0) fail.push(`narrow board: Done targeted ${narrow.target}, in view ${narrow.inside}, scrolled ${narrow.scrolled}`);
    await page.keyboard.press("Escape");
  }

  // Pointer and touch, on the same board: the keys moved nothing; the narrow board goes back to its start.
  {
    await page.evaluate((sel) => {
      document.querySelector(`${sel} .r-boards-kanban-scroller`).scrollLeft = 0;
      document.activeElement?.blur();
    }, NARROW);

    /** Two frames: a pointer or touch event's commit is drawn by then. */
    const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    /** Returns as soon as `fn(arg)` holds in the page, or after `ms` (the bound the old fixed wait set); the assertion after it reads the state. */
    const within = (ms, fn, arg) => page.waitForFunction(fn, arg, { timeout: ms }).catch(() => undefined);
    const centre = (sel) => page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
    /** Brings a card into view inside its list and the page, so a press at its box lands on it. */
    const reveal = (sel, id) => centre(`${sel} [data-kanban-card="${id}"]`);
    const box = (sel) =>
      page.evaluate((s) => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
      }, sel);
    const state = (sel) =>
      page.evaluate((s) => {
        const root = document.querySelector(s);
        const log = root.parentElement.querySelector('[data-sc="kanban-moves"]');
        const preview = root.querySelector(".r-boards-kanban-preview");
        return {
          columns: Object.fromEntries(
            [...root.querySelectorAll("[data-kanban-column]")].map((c) => [c.dataset.kanbanColumn, [...c.querySelectorAll("[data-kanban-card]")].map((k) => k.dataset.kanbanCard)]),
          ),
          source: root.querySelector("[data-drag-source]")?.dataset.kanbanCard ?? null,
          target: root.querySelector("[data-drop-target]")?.dataset.kanbanColumn ?? null,
          preview: preview ? { open: preview.matches(":popover-open"), ...JSON.parse(JSON.stringify(preview.getBoundingClientRect())) } : null,
          status: root.querySelector("[data-kanban-status]").textContent,
          moves: Number(log.dataset.count),
          log: log.textContent,
        };
      }, sel);
    /** The y of the gap between a column's k-th and (k+1)-th cards (the source skipped), and the drop line's centre. */
    const gap = (sel, column, k) =>
      page.evaluate(
        ({ s, column, k }) => {
          const col = document.querySelector(`${s} [data-kanban-column="${column}"]`);
          const cards = [...col.querySelectorAll("[data-kanban-card]:not([data-drag-source])")].map((c) => c.getBoundingClientRect());
          const ind = col.querySelector(".r-boards-kanban-indicator")?.getBoundingClientRect();
          const c = col.getBoundingClientRect();
          return {
            x: (c.left + c.right) / 2,
            above: cards[k - 1].bottom,
            below: cards[k].top,
            line: ind ? ind.top + ind.height / 2 : null,
            outline: getComputedStyle(col).outlineStyle,
          };
        },
        { s: sel, column, k },
      );

    // ── 9: harness ──────────────────────────────────────────────────────────
    await centre(BOARD);
    const start = await state(BOARD);
    if (start.columns.triage?.length !== 7 || start.columns.progress?.length !== 3 || start.moves !== 0) {
      fail.push(`harness: incident board ${JSON.stringify(start.columns)}, moves ${start.moves}`);
    }
    const lists = await page.evaluate(
      ({ b, n }) => {
        const triage = document.querySelector(`${b} [data-kanban-list="triage"]`);
        const scroller = document.querySelector(`${n} .r-boards-kanban-scroller`);
        return {
          triage: triage.scrollHeight - triage.clientHeight,
          narrow: scroller.scrollWidth - scroller.clientWidth,
          snap: getComputedStyle(scroller).scrollSnapType,
        };
      },
      { b: BOARD, n: NARROW },
    );
    if (!(lists.triage > 40)) fail.push(`harness: Triage's list does not scroll (${lists.triage}px of overflow)`);
    if (!(lists.narrow > 100) || lists.snap !== "x mandatory") fail.push(`harness: the narrow board overflows ${lists.narrow}px with snap ${JSON.stringify(lists.snap)}`);

    // ── 10: the threshold, then a drag ───────────────────────────────────────
    const card = async (sel, id) => {
      await reveal(sel, id);
      return box(`${sel} [data-kanban-card="${id}"]`);
    };
    const c42 = await card(BOARD, "inc-42");
    const grab = { x: c42.left + 24, y: c42.top + 14 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x + 2, grab.y + 1);
    if ((await state(BOARD)).source !== null) fail.push("a 2px press already picked the card up (the threshold is 4px)");
    const into = await gap(BOARD, "progress", 1);
    const drop = { x: into.x, y: (into.above + into.below) / 2 };
    await page.mouse.move(drop.x, drop.y, { steps: 12 });
    await frames();
    const mid = await state(BOARD);
    const where = await gap(BOARD, "progress", 1);
    if (mid.source !== "inc-42") fail.push(`mid-drag the source is ${mid.source}`);
    if (!mid.preview?.open) fail.push(`mid-drag the preview is ${JSON.stringify(mid.preview)} (expected open in the top layer)`);
    else if (Math.abs(mid.preview.left + 24 - drop.x) > 2 || Math.abs(mid.preview.top + 14 - drop.y) > 2) {
      fail.push(`the preview's grab point is at ${mid.preview.left + 24},${mid.preview.top + 14}, the pointer at ${drop.x},${drop.y}`);
    }
    if (mid.target !== "progress" || where.outline !== "dashed") fail.push(`mid-drag the target is ${mid.target} with outline ${where.outline}`);
    if (where.line === null || where.line < where.above - 1 || where.line > where.below + 1) fail.push(`the drop line is at ${where.line}, the gap ${where.above}–${where.below}`);
    if (mid.moves !== 0) fail.push("the value changed mid-drag");

    // ── 11: the release commits once ─────────────────────────────────────────
    await page.mouse.up();
    await frames();
    const after = await state(BOARD);
    if (after.moves !== 1 || !after.log.includes("inc-42 from triage #2 to progress #2")) fail.push(`after the drop the log reads ${after.moves}: ${JSON.stringify(after.log)}`);
    if (after.columns.progress?.[1] !== "inc-42") fail.push(`In progress reads ${JSON.stringify(after.columns.progress)}`);
    if (after.preview !== null || after.source !== null) fail.push("the preview or the source mark outlived the drop");
    if (!after.status.startsWith("Dropped INC-2042 Search latency p95 above 800 ms in In progress, position 2 of 4.")) fail.push(`the drop said ${JSON.stringify(after.status)}`);

    // ── 12: a drag from a button inside the card does not press it ───────────
    const ACK = `${BOARD} [data-kanban-card="inc-43"] [data-sc="kanban-ack"]`;
    await reveal(BOARD, "inc-43");
    const ack = await box(ACK);
    const review = await gap(BOARD, "review", 1);
    await page.mouse.move(ack.left + ack.width / 2, ack.top + ack.height / 2);
    await page.mouse.down();
    await page.mouse.move(review.x, (review.above + review.below) / 2, { steps: 10 });
    await page.mouse.up();
    await frames();
    const dragged = await state(BOARD);
    const pressed = await page.evaluate((s) => document.querySelector(s).getAttribute("aria-pressed"), ACK);
    if (dragged.moves !== 2 || !dragged.log.includes("inc-43 from triage #2 to review #2")) fail.push(`a drag from the button logged ${dragged.moves}: ${JSON.stringify(dragged.log)}`);
    if (pressed !== "false") fail.push(`the drag's release pressed the Acknowledge button (aria-pressed ${pressed})`);
    await page.locator(ACK).click();
    if ((await page.evaluate((s) => document.querySelector(s).getAttribute("aria-pressed"), ACK)) !== "true") fail.push("a plain click on Acknowledge inside a card did not press it");
    if ((await state(BOARD)).moves !== 2) fail.push("a plain click on a card's button counted as a move");

    // ── 13: Escape cancels ───────────────────────────────────────────────────
    const c44 = await card(BOARD, "inc-44");
    const done = await box(`${BOARD} [data-kanban-column="done"]`);
    await page.mouse.move(c44.left + 24, c44.top + 14);
    await page.mouse.down();
    await page.mouse.move(done.left + 40, done.top + 60, { steps: 8 });
    await page.keyboard.press("Escape");
    const cancelled = await state(BOARD);
    await page.mouse.up();
    await frames();
    if (cancelled.source !== null || cancelled.preview !== null) fail.push("Escape left the source mark or the preview");
    if (!cancelled.status.startsWith("Cancelled. INC-2044")) fail.push(`Escape said ${JSON.stringify(cancelled.status)}`);
    if ((await state(BOARD)).moves !== 2) fail.push("the release after Escape committed a move");

    // ── 14: edge scrolling ───────────────────────────────────────────────────
    await centre(NARROW);
    const scroller = `${NARROW} .r-boards-kanban-scroller`;
    const s = await box(scroller);
    const n41 = await card(NARROW, "inc-41");
    const scrollLeft = () => page.evaluate((sel) => document.querySelector(sel).scrollLeft, scroller);
    const before = await scrollLeft();
    await page.mouse.move(n41.left + 24, n41.top + 14);
    await page.mouse.down();
    await page.mouse.move(s.right - 6, s.top + s.height / 2, { steps: 6 });
    const snapWhileDragging = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).scrollSnapType, scroller);
    await within(700, ({ sel, before }) => document.querySelector(sel).scrollLeft - before > 100, { sel: scroller, before });
    const toEnd = await scrollLeft();
    await page.mouse.move(s.left + 6, s.top + s.height / 2, { steps: 4 });
    await within(400, ({ sel, toEnd }) => document.querySelector(sel).scrollLeft < toEnd - 50, { sel: scroller, toEnd });
    const toStart = await scrollLeft();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    if (snapWhileDragging !== "none") fail.push(`the narrow board keeps scroll-snap ${JSON.stringify(snapWhileDragging)} while dragging`);
    if (!(toEnd - before > 100)) fail.push(`held at the narrow board's end edge it scrolled ${toEnd - before}px`);
    if (!(toStart < toEnd - 50)) fail.push(`held at its start edge it went from ${toEnd} to ${toStart}`);

    const triageList = `${BOARD} [data-kanban-list="triage"]`;
    const p31 = await card(BOARD, "inc-31");
    await page.evaluate((sel) => {
      document.querySelector(sel).scrollTop = 0;
    }, triageList);
    const t = await box(triageList);
    await page.mouse.move(p31.left + 24, p31.top + 14);
    await page.mouse.down();
    await page.mouse.move(t.left + t.width / 2, t.bottom - 6, { steps: 8 });
    await within(600, (sel) => document.querySelector(sel).scrollTop > 20, triageList);
    const listScrolled = await page.evaluate((sel) => document.querySelector(sel).scrollTop, triageList);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    if (!(listScrolled > 20)) fail.push(`held at the bottom of Triage's list it scrolled ${listScrolled}px`);

    // ── 15: touch: a scroll gesture vs a long press ──────────────────────────
    await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      window.__kanbanLifted = false;
      new window.MutationObserver(() => {
        if (root.querySelector("[data-drag-source]")) window.__kanbanLifted = true;
      }).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-drag-source"] });
    }, BOARD);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
    const c45 = await card(BOARD, "inc-45");
    await touch("touchStart", c45.left + 30, c45.top + 14);
    for (let i = 1; i <= 4; i++) await touch("touchMove", c45.left + 30, c45.top + 14 - i * 15);
    // Past the 400ms long press: an absence needs the time.
    await page.waitForTimeout(600);
    await touch("touchEnd");
    await frames();
    if (await page.evaluate(() => window.__kanbanLifted)) fail.push("a touch that moved at once (a scroll) picked a card up");

    const c46 = await card(BOARD, "inc-46");
    const rv = await box(`${BOARD} [data-kanban-column="review"]`);
    await touch("touchStart", c46.left + 30, c46.top + 14);
    await within(600, (sel) => document.querySelector(sel).querySelector(".r-boards-kanban-preview")?.matches(":popover-open"), BOARD);
    const held = await state(BOARD);
    if (held.source !== "inc-46" || !held.preview?.open) fail.push(`a touch held 600ms: source ${held.source}, preview ${JSON.stringify(held.preview)}`);
    for (let i = 1; i <= 8; i++) await touch("touchMove", c46.left + 30 + ((rv.left + 60 - c46.left - 30) * i) / 8, c46.top + 14);
    await touch("touchEnd");
    await frames();
    const touched = await state(BOARD);
    if (touched.moves !== 3 || !touched.log.includes("inc-46 from triage") || !touched.log.includes("to review")) fail.push(`the touch drag logged ${touched.moves}: ${JSON.stringify(touched.log)}`);
    await cdp.detach();

    // ── 16: forced colours ───────────────────────────────────────────────────
    await page.emulateMedia({ forcedColors: "active" });
    const c47 = await card(BOARD, "inc-47");
    const pr = await gap(BOARD, "progress", 1);
    await page.mouse.move(c47.left + 24, c47.top + 14);
    await page.mouse.down();
    await page.mouse.move(pr.x, (pr.above + pr.below) / 2, { steps: 8 });
    const forced = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const source = root.querySelector("[data-drag-source]");
      const target = root.querySelector("[data-drop-target]");
      const ind = root.querySelector(".r-boards-kanban-indicator");
      const rule = ind && getComputedStyle(ind, "::before");
      const ring = ind && getComputedStyle(ind, "::after");
      const visible = (c) => !!c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
      return {
        source: source && getComputedStyle(source).borderTopStyle,
        outline: target && { style: getComputedStyle(target).outlineStyle, width: Number.parseFloat(getComputedStyle(target).outlineWidth), visible: visible(getComputedStyle(target).outlineColor) },
        rule: rule && { style: rule.borderTopStyle, width: Number.parseFloat(rule.borderTopWidth), visible: visible(rule.borderTopColor) },
        ring: ring && { style: ring.borderTopStyle, visible: visible(ring.borderTopColor) },
      };
    }, BOARD);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    if (forced.source !== "dashed") fail.push(`forced colours: the source card's edge is ${forced.source}`);
    if (forced.outline?.style !== "dashed" || !(forced.outline.width > 0) || !forced.outline.visible) fail.push(`forced colours: the target outline is ${JSON.stringify(forced.outline)}`);
    if (forced.rule?.style !== "solid" || !(forced.rule.width >= 2) || !forced.rule.visible) fail.push(`forced colours: the drop line's rule is ${JSON.stringify(forced.rule)}`);
    if (forced.ring?.style !== "solid" || !forced.ring.visible) fail.push(`forced colours: the drop line's ring is ${JSON.stringify(forced.ring)}`);
  }

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`boards-kanban:\n  - ${fail.join("\n  - ")}`);
  return "boards-kanban: OK (density paddings, wide columns, narrow snap at 85%, folded strip, coarse targets, no spill at 375; keys: drop line in the gap, RTL arrows follow what is drawn, scroll into view; pointer: threshold, preview in the top layer, drop line in the gap, one commit, button drag swallowed, Escape, edge scrolling, touch scroll vs long press, forced colours)";
};
