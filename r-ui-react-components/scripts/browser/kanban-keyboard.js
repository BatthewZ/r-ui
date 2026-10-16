// Browser check: Kanban by keyboard, with real focus, real keys and the live region.
//
// jsdom has no layout and no scrolling, so where the drop line sits, which column a key
// reaches on screen (right to left too) and whether a move scrolls into view are settled
// here. On the Overview's Kanban section it asserts:
//   1. harness: the incident board's columns read Triage 7, In progress 3 (limit 3),
//      Review 3 (limit 2, so marked "Over limit"), Done 1, its live region is empty and no
//      move has been made, so every count below is caused by the keys;
//   2. Tab from a card's button reaches the next card itself (not only what is inside it);
//      on INC-2041 Space says "Picked up INC-2041 Elevated 5xx on checkout. Triage, position
//      1 of 7."; the card is marked as the source and keeps focus;
//   3. ArrowDown says "Moved to Triage, position 2 of 7."; the drop line sits between the
//      2nd and 3rd cards (the source excluded), inside the gap (±1px);
//   4. ArrowRight says "Moved to In progress, position 2 of 4. In progress is over its
//      limit: 4 of 3."; In progress is the drop target and marked as over its limit; the
//      line sits between its 1st and 2nd cards; focus never left the card;
//   5. Enter drops it: "Dropped INC-2041 … in In progress, position 2 of 4. …", the value
//      changed exactly once (the demo's move log: inc-41 from triage #1 to progress #2), the
//      card is the 2nd in In progress, focused, In progress now shows "Over limit" and 4 / 3;
//   6. Space, ArrowLeft, Escape: "Cancelled. INC-2041 … is back in In progress, position 2
//      of 4.", still one move, focus on the card;
//   7. Space, then Tab: leaving the card cancels (no new move);
//   8. right to left: in the RTL board, ArrowLeft from the first column targets the second
//      column, which is drawn to the LEFT of the first; ArrowRight comes back; Escape;
//   9. the narrow board (one column in view): ArrowRight three times targets Done, and the
//      board scrolled so Done is inside the scroller's box; Escape;
//  10. the compact board's folded Done takes a card at its end ("position 2 of 2"), and the
//      drop lands there (its log: to done #2);
//  11. no console or page error.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const ANCHOR = "boards-kanban";

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/${ANCHOR}`);
  await page.evaluate(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), {
    key: SHOWCASE_VIEW_KEY,
    view: { theme: "default", density: "comfortable", input: "fine" },
  });
  await page.reload();
  await waitForShowcase(page);
  await page.locator(`[id="${ANCHOR}"]`).scrollIntoViewIfNeeded();

  const BOARD = '[data-sc="kanban-incidents"]';
  /** The board's state as the user perceives it: columns, cards, live text, focus, moves. */
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

  // ── 1: harness ──────────────────────────────────────────────────────────
  const start = await read(BOARD);
  const sizes = start.columns.map((c) => `${c.id}:${c.cards.length}`).join(" ");
  if (sizes !== "triage:7 progress:3 review:3 done:1") fail.push(`harness: the incident board reads ${sizes}`);
  if (!col(start, "review")?.over || !col(start, "review")?.badge) fail.push("harness: Review (3 of 2) is not marked over its limit with a visible badge");
  if (col(start, "progress")?.over) fail.push("harness: In progress (3 of 3) is marked over its limit");
  if (start.status !== "" || start.moves !== 0) fail.push(`harness: live region ${JSON.stringify(start.status)}, moves ${start.moves}`);

  // ── 2: Tab onto the card, Space picks it up ─────────────────────────────
  const first = page.locator(`${BOARD} [data-kanban-card="inc-41"]`);
  await first.getByRole("button", { name: "Acknowledge INC-2041" }).focus();
  await page.keyboard.press("Tab");
  let s = await read(BOARD);
  if (s.focused !== "inc-42") fail.push(`Tab from the first card's button focused ${JSON.stringify(s.focused)}, expected the next card (inc-42) itself`);
  await first.focus();
  await page.keyboard.press("Space");
  s = await read(BOARD);
  if (s.status !== "Picked up INC-2041 Elevated 5xx on checkout. Triage, position 1 of 7.") fail.push(`Space said ${JSON.stringify(s.status)}`);
  if (s.source !== "inc-41" || s.focused !== "inc-41") fail.push(`after Space the source is ${s.source} and focus ${s.focused}`);

  // ── 3: ArrowDown within Triage ──────────────────────────────────────────
  await page.keyboard.press("ArrowDown");
  s = await read(BOARD);
  if (s.status !== "Moved to Triage, position 2 of 7.") fail.push(`ArrowDown said ${JSON.stringify(s.status)}`);
  const down = await line(BOARD, "triage", 1);
  if (!between(down)) fail.push(`the drop line in Triage is not between its 2nd and 3rd cards: ${JSON.stringify(down)}`);

  // ── 4: ArrowRight into In progress, past its limit ──────────────────────
  await page.keyboard.press("ArrowRight");
  s = await read(BOARD);
  if (s.status !== "Moved to In progress, position 2 of 4. In progress is over its limit: 4 of 3.") fail.push(`ArrowRight said ${JSON.stringify(s.status)}`);
  if (!col(s, "progress")?.target || !col(s, "progress")?.overTarget) fail.push("In progress is not the drop target marked as over its limit");
  const right = await line(BOARD, "progress", 1);
  if (!between(right)) fail.push(`the drop line in In progress is not between its 1st and 2nd cards: ${JSON.stringify(right)}`);
  if (s.focused !== "inc-41") fail.push(`focus left the card while moving (on ${s.focused})`);

  // ── 5: Enter drops ──────────────────────────────────────────────────────
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  s = await read(BOARD);
  if (s.status !== "Dropped INC-2041 Elevated 5xx on checkout in In progress, position 2 of 4. In progress is over its limit: 4 of 3.") {
    fail.push(`Enter said ${JSON.stringify(s.status)}`);
  }
  if (s.moves !== 1 || !s.log.includes("inc-41 from triage #1 to progress #2")) fail.push(`after the drop the move log reads ${s.moves}: ${JSON.stringify(s.log)}`);
  if (col(s, "progress")?.cards[1] !== "inc-41") fail.push(`In progress reads ${JSON.stringify(col(s, "progress")?.cards)}`);
  if (s.focused !== "inc-41") fail.push(`after the drop focus is on ${JSON.stringify(s.focused)}, not the moved card`);
  if (!col(s, "progress")?.over || !col(s, "progress")?.badge || col(s, "progress")?.count !== "4 / 3") {
    fail.push(`In progress after the drop: ${JSON.stringify(col(s, "progress"))}`);
  }
  if (s.source !== null) fail.push("a card is still marked as the drag source after the drop");

  // ── 6: Escape cancels ───────────────────────────────────────────────────
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  s = await read(BOARD);
  if (s.status !== "Cancelled. INC-2041 Elevated 5xx on checkout is back in In progress, position 2 of 4.") fail.push(`Escape said ${JSON.stringify(s.status)}`);
  if (s.moves !== 1 || s.focused !== "inc-41" || s.source !== null) fail.push(`after Escape: moves ${s.moves}, focus ${s.focused}, source ${s.source}`);

  // ── 7: leaving the card cancels ─────────────────────────────────────────
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  s = await read(BOARD);
  if (!s.status.startsWith("Cancelled.") || s.moves !== 1 || s.source !== null) fail.push(`Tab mid-move: ${JSON.stringify(s.status)}, moves ${s.moves}, source ${s.source}`);

  // ── 8: right to left ────────────────────────────────────────────────────
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

  // ── 9: a keyboard move scrolls the narrow board ─────────────────────────
  const NARROW = '[data-sc="kanban-narrow"]';
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

  // ── 10: a folded column takes a card at its end ─────────────────────────
  const COMPACT = '[data-sc="kanban-compact"]';
  await page.locator(COMPACT).scrollIntoViewIfNeeded();
  await page.locator(`${COMPACT} [data-kanban-card="inc-21"]`).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Home");
  const folded = await read(COMPACT);
  if (folded.status !== "Moved to Done, position 2 of 2.") fail.push(`into the folded Done (then Home): ${JSON.stringify(folded.status)}`);
  await page.keyboard.press("Enter");
  const landed = await read(COMPACT);
  if (landed.moves !== 1 || !landed.log.includes("to done #2")) fail.push(`the folded drop logged ${landed.moves}: ${JSON.stringify(landed.log)}`);

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`kanban-keyboard:\n  - ${fail.join("\n  - ")}`);
  return "kanban-keyboard: OK (pick up, moves within and across columns with the line in the gap, limit announced, one value change, focus kept, Escape and blur cancel, RTL arrows, scroll into view, folded drop)";
};
