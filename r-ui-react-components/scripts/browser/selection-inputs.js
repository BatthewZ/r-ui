// Browser check: Combobox, MultiSelect and TagInput with real keys, real layout
// and real hit testing.
//
// On the Overview's "Selection filter bar" (a compact card with overflow: hidden)
// and the TagInput / MultiSelect sections it asserts:
//   1. harness: at fine input the card resolves --ROW-H 30px and --CONTROL-H 28px,
//      the page 40px / 36px, as the source predicts (compact vs comfortable);
//   2. keys, Combobox: typing filters and highlights the first match
//      (aria-activedescendant), ArrowDown moves, Enter chooses and closes; Escape
//      on a closed field with a value clears it;
//   3. the open list is in place (a DOM descendant of the card), in the top layer
//      (:popover-open), reaches past the card's clip box, takes a press there
//      (elementFromPoint); its two-line options are at least the card's --ROW-H,
//      and the Regions list's one-line options are exactly it (30px, not 40);
//   4. keys, MultiSelect: type + Enter adds a chip and keeps the list open with an
//      empty search; Escape closes; Backspace in the empty search removes the chip;
//   5. keys, TagInput: a typed comma commits a chip, an invalid tag is refused
//      with a message and aria-invalid, and the draft is kept;
//   6. at 375px and coarse input: no sideways scroll; the Recipients TagInput's
//      chips wrap onto several rows inside the frame, which is a whole number of
//      --CONTROL-H tall; every option, frame and chip row in the compact card is at
//      least the 44px floor; a chip's remove button answers a press 2px outside its
//      visible box (hit-area) and removes exactly that chip.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const CARD = '[data-testid="selection-filter-card"]';
  const setView = async (input, anchor = "form-selectionfilterbar") => {
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme: "default",
      density: "comfortable",
      input,
    });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(CARD).waitFor();
    await page.waitForTimeout(200);
  };
  const toCardTop = () =>
    page.evaluate((sel) => window.scrollBy(0, document.querySelector(sel).getBoundingClientRect().top - 100), CARD);
  const px = (v) => Math.round(Number.parseFloat(v) * 100) / 100;
  const field = (name) => page.locator(CARD).getByRole("combobox", { name, exact: true });
  const activeText = (locator) =>
    locator.evaluate((input) => document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.textContent ?? null);

  await page.setViewportSize({ width: 1280, height: 900 });
  await setView("fine");
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

  // ── 2: Combobox keys ────────────────────────────────────────────────────
  const service = field("Service");
  if ((await service.count()) !== 1) fail.push(`harness: found ${await service.count()} Service comboboxes in the card`);
  await service.click();
  await page.keyboard.type("api");
  await page.waitForTimeout(50);
  const firstMatch = await activeText(service);
  await page.keyboard.press("ArrowDown");
  const moved = await activeText(service);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const chosen = { value: await service.inputValue(), expanded: await service.getAttribute("aria-expanded") };
  if (!firstMatch?.startsWith("Checkout API")) fail.push(`typing "api" highlighted ${JSON.stringify(firstMatch)}, expected the first match "Checkout API"`);
  if (!moved?.startsWith("Search API")) fail.push(`ArrowDown moved to ${JSON.stringify(moved)}, expected "Search API"`);
  if (chosen.value !== "Search API" || chosen.expanded !== "false") fail.push(`Enter left the field at ${JSON.stringify(chosen)}, expected "Search API" and closed`);

  // ── 3: the open list in the clipping compact card ───────────────────────
  await page.keyboard.press("ArrowDown");
  await page.locator(`${CARD} [role=listbox]`).waitFor();
  await page.waitForTimeout(250);
  const popup = await page.evaluate((sel) => {
    const card = document.querySelector(sel);
    const listbox = card.querySelector("[role=listbox]");
    const panel = listbox.parentElement;
    const c = card.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const y = p.bottom > c.bottom + 4 ? (Math.max(p.top, c.bottom) + p.bottom) / 2 : null;
    const hit = y === null ? null : document.elementFromPoint((p.left + p.right) / 2, y);
    return {
      inCard: card.contains(panel),
      topLayer: panel.matches(":popover-open"),
      below: Math.round(p.bottom - c.bottom),
      hitOutside: y === null ? "no part of the list lies below the card" : panel.contains(hit) ? "panel" : hit ? hit.tagName.toLowerCase() : "nothing",
      rows: [...listbox.querySelectorAll("[role=option]")].map((o) => Math.round(o.getBoundingClientRect().height * 100) / 100),
    };
  }, CARD);
  if (!popup.inCard) fail.push("the list is not a DOM descendant of the card (portalled?)");
  if (!popup.topLayer) fail.push("the list is not in the top layer (:popover-open)");
  if (!(popup.below > 0)) fail.push(`the list does not reach past the card's clip box (${popup.below}px below)`);
  if (popup.hitOutside !== "panel") fail.push(`a press on the list below the card reached ${popup.hitOutside}`);
  if (popup.rows.length < 6 || popup.rows.some((h) => h < harness.cardRow || h >= harness.pageRow)) {
    fail.push(`two-line options are ${popup.rows.join(", ")}px, expected at least the card's --ROW-H ${harness.cardRow}px and less than the page's ${harness.pageRow}px`);
  }
  await page.keyboard.press("Escape");
  const afterClose = await service.getAttribute("aria-expanded");
  await page.keyboard.press("Escape");
  const cleared = await service.inputValue();
  if (afterClose !== "false") fail.push("Escape did not close the list");
  if (cleared !== "") fail.push(`Escape on a closed field left ${JSON.stringify(cleared)}, expected it cleared`);

  // ── 4: MultiSelect keys ─────────────────────────────────────────────────
  const regions = field("Regions");
  const chipsOf = (locator) =>
    locator.evaluate((input) => [...input.closest(".r-form-frame").querySelectorAll(".r-form-chip > span")].map((s) => s.textContent));
  const before = await chipsOf(regions);
  await regions.click();
  await page.locator(`${CARD} [role=listbox]`).waitFor();
  const oneLine = await page.evaluate((sel) =>
    [...document.querySelectorAll(`${sel} [role=option]`)].map((o) => Math.round(o.getBoundingClientRect().height * 100) / 100), CARD);
  if (oneLine.length < 6 || oneLine.some((h) => h !== harness.cardRow)) {
    fail.push(`Regions options are ${oneLine.join(", ")}px, the compact card's --ROW-H is ${harness.cardRow}px`);
  }
  await page.keyboard.type("frank");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const added = { chips: await chipsOf(regions), search: await regions.inputValue(), expanded: await regions.getAttribute("aria-expanded") };
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(50);
  const removed = await chipsOf(regions);
  if (JSON.stringify(before) !== JSON.stringify(["Europe (Ireland)"])) fail.push(`harness: Regions starts with ${JSON.stringify(before)}`);
  if (JSON.stringify(added.chips) !== JSON.stringify(["Europe (Ireland)", "Europe (Frankfurt)"]) || added.search !== "" || added.expanded !== "true") {
    fail.push(`type + Enter in Regions gave ${JSON.stringify(added)}, expected a Frankfurt chip, an empty search and the list still open`);
  }
  if (JSON.stringify(removed) !== JSON.stringify(["Europe (Ireland)"])) fail.push(`Backspace in the empty search left ${JSON.stringify(removed)}`);

  // ── 5: TagInput keys ────────────────────────────────────────────────────
  const labels = field("Labels");
  await labels.click();
  await page.keyboard.type("sev2,");
  await page.keyboard.press("Escape");
  await page.keyboard.type("Not Valid");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const tags = {
    chips: await chipsOf(labels),
    draft: await labels.inputValue(),
    invalid: await labels.getAttribute("aria-invalid"),
    message: await labels.evaluate((input) => (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" | ")),
  };
  if (JSON.stringify(tags.chips) !== JSON.stringify(["p1", "sev2"])) fail.push(`a typed comma left the tags at ${JSON.stringify(tags.chips)}`);
  if (tags.draft !== "Not Valid" || tags.invalid !== "true" || !tags.message.includes("may use only")) {
    fail.push(`an invalid tag gave ${JSON.stringify(tags)}, expected it kept, aria-invalid and its message described`);
  }

  // ── 6: 375px, coarse ────────────────────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 800 });
  await setView("coarse", "form-taginput");
  const wrap = await page.evaluate(() => {
    const section = document.querySelector("#form-taginput");
    const input = [...section.querySelectorAll("input")].find((i) => i.id && document.querySelector(`label[for="${i.id}"]`)?.textContent.trim() === "Recipients");
    const frame = input.closest(".r-form-frame");
    const f = frame.getBoundingClientRect();
    const chips = [...frame.querySelectorAll(".r-form-chip")].map((c) => c.getBoundingClientRect());
    const control = Number.parseFloat(getComputedStyle(frame).getPropertyValue("--CONTROL-H"));
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      chips: chips.length,
      rows: new Set(chips.map((r) => Math.round(r.top))).size,
      spill: chips.filter((r) => r.left < f.left - 0.5 || r.right > f.right + 0.5).length,
      height: Math.round(f.height * 100) / 100,
      control,
    };
  });
  if (wrap.control !== 44) fail.push(`harness: --CONTROL-H at coarse is ${wrap.control}px, source predicts 44px`);
  if (wrap.pageOverflow !== 0) fail.push(`the page scrolls sideways by ${wrap.pageOverflow}px at 375`);
  if (wrap.chips !== 4 || wrap.rows < 2) fail.push(`Recipients: ${wrap.chips} chips on ${wrap.rows} row(s), expected 4 wrapping onto several`);
  if (wrap.spill !== 0) fail.push(`Recipients: ${wrap.spill} chip(s) reach past the frame`);
  if (Math.abs(wrap.height / wrap.control - Math.round(wrap.height / wrap.control)) > 0.02) {
    fail.push(`Recipients: the frame is ${wrap.height}px, not a whole number of ${wrap.control}px rows`);
  }

  await setView("coarse");
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
    };
  }, CARD);
  await page.keyboard.press("Escape");
  if (coarse.pageOverflow !== 0) fail.push(`coarse 375: the page scrolls sideways by ${coarse.pageOverflow}px with the list open`);
  if (coarse.options.length < 6 || coarse.options.some((x) => x < 44)) fail.push(`coarse: options are ${coarse.options.join(", ")}px, floor 44px`);
  if (coarse.frames.length !== 3 || coarse.frames.some((x) => x < 44)) fail.push(`coarse: field frames are ${coarse.frames.join(", ")}px, floor 44px`);

  // A press just outside the remove button's visible box still removes that chip.
  const remove = page.locator(`${CARD} .r-form-chip-remove`).first();
  const target = await remove.evaluate((button) => {
    const r = button.getBoundingClientRect();
    const x = (r.left + r.right) / 2;
    const y = r.top - 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, height: Math.round(r.height * 100) / 100, hits: hit === button, label: button.getAttribute("aria-label") };
  });
  const chipsBefore = await page.locator(`${CARD} .r-form-chip-remove`).count();
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(50);
  const chipsAfter = await page.locator(`${CARD} .r-form-chip-remove`).count();
  const gone = await page.locator(`${CARD} [aria-label="${target.label}"]`).count();
  if (!(target.height < 44)) fail.push(`harness: the remove button is ${target.height}px tall, too tall to prove its hit area`);
  if (!target.hits) fail.push(`a press 2px above "${target.label}" does not reach it (no hit area)`);
  if (chipsAfter !== chipsBefore - 1 || gone !== 0) fail.push(`the press outside "${target.label}" left ${chipsAfter} of ${chipsBefore} chips`);

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  await page.setViewportSize({ width: 1280, height: 900 });
  const result = { harness, popup, oneLine, added, tags, wrap, coarse, target };
  if (fail.length) throw new Error(`selection-inputs FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `selection-inputs OK ${JSON.stringify(result)}`;
}
