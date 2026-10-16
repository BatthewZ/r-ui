// Browser check: Kanban with a real mouse, real touch (CDP) and real scrolling.
//
// jsdom has no layout, no top layer, no scrolling and no touch gestures, so the drag itself
// is settled here. On the Overview's Kanban section it asserts:
//   1. harness: the incident board reads Triage 7 / In progress 3, no move made; its Triage
//      list scrolls (taller content than box) and the narrow board scrolls sideways and
//      snaps (`scroll-snap-type` x mandatory) at rest;
//   2. a mouse press on INC-2042 that moves 2px is no drag (no source mark); moved on, in
//      steps, to the gap between In progress's 1st and 2nd cards it is: the card is the
//      marked source, a preview copy follows in the top layer (`:popover-open`) with its
//      grab point under the pointer (±2px), In progress is the outlined drop target and the
//      drop line sits in that gap (±1px); nothing has been committed mid-drag;
//   3. the release commits exactly once (the demo's log: inc-42 from triage #2 to progress
//      #2), the card is In progress's 2nd, the preview is gone, and "Dropped …" is announced;
//   4. a drag that starts on a card's Acknowledge button moves the card and does not press
//      the button (its release click is swallowed); a plain click then presses it;
//   5. Escape mid-drag cancels: the source mark and preview go, "Cancelled. …" is announced,
//      and the release afterwards commits nothing;
//   6. edge scrolling: on the narrow board, held near the scroller's inline end the board
//      scrolls toward it (snap let go while dragging), and near its start back again; on
//      the incident board, held near the bottom of Triage's list the list scrolls;
//   7. touch (CDP): a touch that moves 60px at once and then rests is a scroll: no card is
//      ever marked; a touch held still for 600ms picks the card up (source mark, preview),
//      moving it into Review and lifting commits one move to review;
//   8. forced colours: mid-drag the source card's edge is dashed, the target column's
//      outline dashed and visible, and the drop line's rule and ring are solid lines of a
//      non-transparent system colour, so the line does not rest on colour;
//   9. no console or page error.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const ANCHOR = "boards-kanban";
  const BOARD = '[data-sc="kanban-incidents"]';
  const NARROW = '[data-sc="kanban-narrow"]';

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/${ANCHOR}`);
  await page.evaluate(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), {
    key: SHOWCASE_VIEW_KEY,
    view: { theme: "default", density: "comfortable", input: "fine" },
  });
  await page.reload();
  await waitForShowcase(page);

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

  // ── 1: harness ──────────────────────────────────────────────────────────
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

  // ── 2: the threshold, then a drag ───────────────────────────────────────
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
  await page.waitForTimeout(100);
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

  // ── 3: the release commits once ─────────────────────────────────────────
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await state(BOARD);
  if (after.moves !== 1 || !after.log.includes("inc-42 from triage #2 to progress #2")) fail.push(`after the drop the log reads ${after.moves}: ${JSON.stringify(after.log)}`);
  if (after.columns.progress?.[1] !== "inc-42") fail.push(`In progress reads ${JSON.stringify(after.columns.progress)}`);
  if (after.preview !== null || after.source !== null) fail.push("the preview or the source mark outlived the drop");
  if (!after.status.startsWith("Dropped INC-2042 Search latency p95 above 800 ms in In progress, position 2 of 4.")) fail.push(`the drop said ${JSON.stringify(after.status)}`);

  // ── 4: a drag from a button inside the card does not press it ───────────
  const ACK = `${BOARD} [data-kanban-card="inc-43"] [data-sc="kanban-ack"]`;
  await reveal(BOARD, "inc-43");
  const ack = await box(ACK);
  const review = await gap(BOARD, "review", 1);
  await page.mouse.move(ack.left + ack.width / 2, ack.top + ack.height / 2);
  await page.mouse.down();
  await page.mouse.move(review.x, (review.above + review.below) / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const dragged = await state(BOARD);
  const pressed = await page.evaluate((s) => document.querySelector(s).getAttribute("aria-pressed"), ACK);
  if (dragged.moves !== 2 || !dragged.log.includes("inc-43 from triage #2 to review #2")) fail.push(`a drag from the button logged ${dragged.moves}: ${JSON.stringify(dragged.log)}`);
  if (pressed !== "false") fail.push(`the drag's release pressed the Acknowledge button (aria-pressed ${pressed})`);
  await page.locator(ACK).click();
  if ((await page.evaluate((s) => document.querySelector(s).getAttribute("aria-pressed"), ACK)) !== "true") fail.push("a plain click on Acknowledge inside a card did not press it");
  if ((await state(BOARD)).moves !== 2) fail.push("a plain click on a card's button counted as a move");

  // ── 5: Escape cancels ───────────────────────────────────────────────────
  const c44 = await card(BOARD, "inc-44");
  const done = await box(`${BOARD} [data-kanban-column="done"]`);
  await page.mouse.move(c44.left + 24, c44.top + 14);
  await page.mouse.down();
  await page.mouse.move(done.left + 40, done.top + 60, { steps: 8 });
  await page.keyboard.press("Escape");
  const cancelled = await state(BOARD);
  await page.mouse.up();
  await page.waitForTimeout(100);
  if (cancelled.source !== null || cancelled.preview !== null) fail.push("Escape left the source mark or the preview");
  if (!cancelled.status.startsWith("Cancelled. INC-2044")) fail.push(`Escape said ${JSON.stringify(cancelled.status)}`);
  if ((await state(BOARD)).moves !== 2) fail.push("the release after Escape committed a move");

  // ── 6: edge scrolling ───────────────────────────────────────────────────
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
  await page.waitForTimeout(700);
  const toEnd = await scrollLeft();
  await page.mouse.move(s.left + 6, s.top + s.height / 2, { steps: 4 });
  await page.waitForTimeout(400);
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
  await page.waitForTimeout(600);
  const listScrolled = await page.evaluate((sel) => document.querySelector(sel).scrollTop, triageList);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  if (!(listScrolled > 20)) fail.push(`held at the bottom of Triage's list it scrolled ${listScrolled}px`);

  // ── 7: touch: a scroll gesture vs a long press ──────────────────────────
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
  await page.waitForTimeout(600);
  await touch("touchEnd");
  await page.waitForTimeout(150);
  if (await page.evaluate(() => window.__kanbanLifted)) fail.push("a touch that moved at once (a scroll) picked a card up");

  const c46 = await card(BOARD, "inc-46");
  const rv = await box(`${BOARD} [data-kanban-column="review"]`);
  await touch("touchStart", c46.left + 30, c46.top + 14);
  await page.waitForTimeout(600);
  const held = await state(BOARD);
  if (held.source !== "inc-46" || !held.preview?.open) fail.push(`a touch held 600ms: source ${held.source}, preview ${JSON.stringify(held.preview)}`);
  for (let i = 1; i <= 8; i++) await touch("touchMove", c46.left + 30 + ((rv.left + 60 - c46.left - 30) * i) / 8, c46.top + 14);
  await touch("touchEnd");
  await page.waitForTimeout(150);
  const touched = await state(BOARD);
  if (touched.moves !== 3 || !touched.log.includes("inc-46 from triage") || !touched.log.includes("to review")) fail.push(`the touch drag logged ${touched.moves}: ${JSON.stringify(touched.log)}`);
  await cdp.detach();

  // ── 8: forced colours ───────────────────────────────────────────────────
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

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`kanban-pointer:\n  - ${fail.join("\n  - ")}`);
  return "kanban-pointer: OK (threshold, preview in the top layer, drop line in the gap, one commit, button drag swallowed, Escape, edge scrolling, touch scroll vs long press, forced colours)";
};
