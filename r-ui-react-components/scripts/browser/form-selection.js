// @covers   form/Combobox, form/MultiSelect, form/TagInput
// @sections form-multiselect form-taginput form-selectionfilterbar
// @tier     component
//
// Browser check: Combobox, MultiSelect and TagInput with real layout and real hit testing.
//
// The key models (filtering and the first match highlighted through `aria-activedescendant`,
// arrows, Enter choosing and closing, Escape closing then clearing; MultiSelect's Enter adding a
// chip with the list kept open and the search emptied, Escape, Backspace removing the last chip;
// TagInput's comma committing and a refused tag kept, invalid and described) are the unit tests'
// (Combobox, MultiSelect, TagInput). On the "Selection filter bar" section (a compact card with
// overflow: hidden) and the TagInput / MultiSelect sections, each opened alone, it asserts:
//   1. harness: at fine input the card resolves --ROW-H 30px and --CONTROL-H 28px,
//      the page 40px / 36px, as the source predicts (compact vs comfortable);
//   2. the Service list, reopened after typing "api" and choosing by keys, has two-line
//      options at least the card's --ROW-H and under the page's (in place, top layer, past
//      the clip and one-line options at the card's --ROW-H are sweep-floating's sweep);
//   3. at 375px and coarse input: the Recipients TagInput's
//      chips wrap onto several rows inside the frame, which is a whole number of
//      --CONTROL-H tall; every option, frame and chip row (a chip-holding frame's
//      height over its rows of chips) in the compact card is at least the 44px
//      floor; a chip's remove button answers a press 2px outside its
//      visible box (hit-area) and removes exactly that chip;
//   4. a MultiSelect narrower than --COLUMN-MD folds its three chips into an
//      "3 selected" button: ArrowLeft at the start of the search lands on that
//      button (rendered, never a hidden chip), Enter unfolds the chips and
//      focuses a chip's remove button; at coarse input the button answers a
//      press up to the 44px floor around its centre (hit-area).
async (page) => {
  const fail = [];
  const CARD = '[data-testid="selection-filter-card"]';
  const load = async (input, width, anchor = "form-selectionfilterbar") => {
    await openSection(page, anchor, { width, height: width === 375 ? 800 : undefined, view: { theme: "default", density: "comfortable", input } });
    await page.waitForTimeout(200);
  };
  const toCardTop = () =>
    page.evaluate((sel) => window.scrollBy(0, document.querySelector(sel).getBoundingClientRect().top - 100), CARD);
  const px = (v) => Math.round(Number.parseFloat(v) * 100) / 100;
  const field = (name) => page.locator(CARD).getByRole("combobox", { name, exact: true });

  await load("fine", 1280);
  await page.locator(CARD).waitFor();
  await toCardTop();

  // ── 1: harness ──────────────────────────────────────────────────────────
  const tokens = await page.evaluate((sel) => {
    const card = getComputedStyle(document.querySelector(sel));
    const root = getComputedStyle(document.documentElement);
    return {
      cardRow: card.getPropertyValue("--ROW-H"),
      cardControl: card.getPropertyValue("--CONTROL-H"),
      pageRow: root.getPropertyValue("--ROW-H"),
      pageControl: root.getPropertyValue("--CONTROL-H"),
      overflow: card.overflow,
    };
  }, CARD);
  const harness = {
    cardRow: px(tokens.cardRow),
    cardControl: px(tokens.cardControl),
    pageRow: px(tokens.pageRow),
    pageControl: px(tokens.pageControl),
  };
  if (harness.cardRow !== 30 || harness.cardControl !== 28 || harness.pageRow !== 40 || harness.pageControl !== 36) {
    fail.push(`harness: card --ROW-H/--CONTROL-H ${harness.cardRow}/${harness.cardControl}px, page ${harness.pageRow}/${harness.pageControl}px; source predicts 30/28 and 40/36`);
  }
  if (tokens.overflow !== "hidden") fail.push(`harness: the filter card's overflow is ${tokens.overflow}, expected hidden`);

  // ── 2: the open list's two-line options in the compact card ─────────────
  const service = field("Service");
  if ((await service.count()) !== 1) fail.push(`harness: found ${await service.count()} Service comboboxes in the card`);
  await service.click();
  await page.keyboard.type("api");
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowDown");
  await page.locator(`${CARD} [role=listbox]`).waitFor();
  await page.waitForTimeout(250);
  const popup = await page.evaluate((sel) => {
    const listbox = document.querySelector(sel).querySelector("[role=listbox]");
    return { rows: [...listbox.querySelectorAll("[role=option]")].map((o) => Math.round(o.getBoundingClientRect().height * 100) / 100) };
  }, CARD);
  if (popup.rows.length < 6 || popup.rows.some((h) => h < harness.cardRow || h >= harness.pageRow)) {
    fail.push(`two-line options are ${popup.rows.join(", ")}px, expected at least the card's --ROW-H ${harness.cardRow}px and less than the page's ${harness.pageRow}px`);
  }

  // ── 3: 375px, coarse ────────────────────────────────────────────────────
  await load("coarse", 375, "form-taginput");
  const wrap = await page.evaluate(() => {
    const section = document.querySelector("#form-taginput");
    const input = [...section.querySelectorAll("input")].find((i) => i.id && document.querySelector(`label[for="${i.id}"]`)?.textContent.trim() === "Recipients");
    const frame = input.closest(".r-form-frame");
    const f = frame.getBoundingClientRect();
    const chips = [...frame.querySelectorAll(".r-primitives-chip")].map((c) => c.getBoundingClientRect());
    const control = Number.parseFloat(getComputedStyle(frame).getPropertyValue("--CONTROL-H"));
    return {
      chips: chips.length,
      rows: new Set(chips.map((r) => Math.round(r.top))).size,
      spill: chips.filter((r) => r.left < f.left - 0.5 || r.right > f.right + 0.5).length,
      height: Math.round(f.height * 100) / 100,
      control,
    };
  });
  if (wrap.control !== 44) fail.push(`harness: --CONTROL-H at coarse is ${wrap.control}px, source predicts 44px`);
  if (wrap.chips !== 4 || wrap.rows < 2) fail.push(`Recipients: ${wrap.chips} chips on ${wrap.rows} row(s), expected 4 wrapping onto several`);
  if (wrap.spill !== 0) fail.push(`Recipients: ${wrap.spill} chip(s) reach past the frame`);
  if (Math.abs(wrap.height / wrap.control - Math.round(wrap.height / wrap.control)) > 0.02) {
    fail.push(`Recipients: the frame is ${wrap.height}px, not a whole number of ${wrap.control}px rows`);
  }

  await load("coarse", 375);
  await page.locator(CARD).waitFor();
  await toCardTop();
  await field("Regions").click();
  await page.locator(`${CARD} [role=listbox]`).waitFor();
  await page.waitForTimeout(250);
  const coarse = await page.evaluate((sel) => {
    const card = document.querySelector(sel);
    const h = (els) => [...els].map((e) => Math.round(e.getBoundingClientRect().height * 100) / 100);
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      options: h(card.querySelectorAll("[role=option]")),
      frames: h(card.querySelectorAll(".r-form-frame")),
      // Rendered chips only: a folded field's summary chip is `display: none` until it folds.
      chipRows: [...card.querySelectorAll(".r-form-frame")]
        .map((f) => [f, [...f.querySelectorAll(".r-primitives-chip")].filter((c) => c.getClientRects().length > 0)])
        .filter(([, chips]) => chips.length > 0)
        .map(([f, chips]) => {
          const rows = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size;
          return Math.round((f.getBoundingClientRect().height / rows) * 100) / 100;
        }),
    };
  }, CARD);
  await page.keyboard.press("Escape");
  if (coarse.pageOverflow !== 0) fail.push(`coarse 375: the page scrolls sideways by ${coarse.pageOverflow}px with the list open`);
  if (coarse.options.length < 6 || coarse.options.some((x) => x < 44)) fail.push(`coarse: options are ${coarse.options.join(", ")}px, floor 44px`);
  if (coarse.frames.length !== 3 || coarse.frames.some((x) => x < 44)) fail.push(`coarse: field frames are ${coarse.frames.join(", ")}px, floor 44px`);
  // Regions and Labels both start with a chip.
  if (coarse.chipRows.length < 2 || coarse.chipRows.some((x) => x < 44)) fail.push(`coarse: chip rows are ${coarse.chipRows.join(", ")}px, floor 44px`);

  // A press just outside the remove button's visible box still removes that chip.
  const remove = page.locator(`${CARD} .r-primitives-chip-remove`).first();
  const target = await remove.evaluate((button) => {
    const r = button.getBoundingClientRect();
    const x = (r.left + r.right) / 2;
    const y = r.top - 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, height: Math.round(r.height * 100) / 100, hits: hit === button, label: button.getAttribute("aria-label") };
  });
  const chipsBefore = await page.locator(`${CARD} .r-primitives-chip-remove`).count();
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(50);
  const chipsAfter = await page.locator(`${CARD} .r-primitives-chip-remove`).count();
  const gone = await page.locator(`${CARD} [aria-label="${target.label}"]`).count();
  if (!(target.height < 44)) fail.push(`harness: the remove button is ${target.height}px tall, too tall to prove its hit area`);
  if (!target.hits) fail.push(`a press 2px above "${target.label}" does not reach it (no hit area)`);
  if (chipsAfter !== chipsBefore - 1 || gone !== 0) fail.push(`the press outside "${target.label}" left ${chipsAfter} of ${chipsBefore} chips`);

  // ── 4: the narrow MultiSelect's summary ─────────────────────────────────
  const narrow = {};
  for (const input of ["fine", "coarse"]) {
    await load(input, 1280, "form-multiselect");
    const box = page.locator("#form-multiselect .w-column-sm").first();
    const search = box.getByRole("combobox");
    await search.scrollIntoViewIfNeeded();
    const summary = box.locator(".r-form-chip-summary");
    const shown = await summary.evaluate((b) => ({ text: b.textContent.trim(), visible: b.checkVisibility(), chips: b.parentElement.querySelectorAll(".r-primitives-chip-remove").length }));
    if (shown.text !== "3 selected" || !shown.visible) fail.push(`narrow (${input}): harness: summary ${JSON.stringify(shown)}, expected a visible "3 selected"`);
    await search.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    const landed = await page.evaluate(() => ({
      summary: document.activeElement?.classList.contains("r-form-chip-summary") ?? false,
      visible: document.activeElement?.checkVisibility() ?? false,
      text: document.activeElement?.textContent.trim().slice(0, 40) ?? null,
    }));
    if (!landed.summary || !landed.visible) fail.push(`narrow (${input}): ArrowLeft from the search landed on ${JSON.stringify(landed)}, expected the visible "3 selected" button`);
    if (input === "coarse") {
      const hit = await summary.evaluate((b) => {
        const r = b.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        const at = (x, y) => document.elementFromPoint(x, y) === b;
        return { height: r.height, up: at(cx, cy - 21), down: at(cx, cy + 21) };
      });
      if (!(hit.height < 44)) fail.push(`narrow (coarse): harness: the summary is ${hit.height}px tall, too tall to prove its hit area`);
      if (!hit.up || !hit.down) fail.push(`narrow (coarse): the summary does not answer 21px above and below its centre (${JSON.stringify(hit)})`);
      narrow.hit = hit;
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    const unfolded = await box.evaluate((b) => ({
      visibleChips: [...b.querySelectorAll(".r-primitives-chip-remove")].filter((r) => r.checkVisibility()).length,
      focusedRemove: document.activeElement?.classList.contains("r-primitives-chip-remove") ?? false,
      summary: b.querySelector(".r-form-chip-summary")?.checkVisibility() ?? false,
    }));
    if (unfolded.visibleChips !== 3 || !unfolded.focusedRemove || unfolded.summary) fail.push(`narrow (${input}): Enter on the summary gave ${JSON.stringify(unfolded)}, expected 3 visible chips, focus on a remove button, no summary`);
    narrow[input] = { shown, landed, unfolded };
  }

  const result = { harness, popup, wrap, coarse, target, narrow };
  if (fail.length) throw new Error(`form-selection FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `form-selection OK ${JSON.stringify(result)}`;
}
