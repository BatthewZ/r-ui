// Browser check: ContextMenu with real pointer, keys and touch, and the Dashboard's row menu.
//
// Run it through `bun run browser:check overlays-context`, or by hand against a running showcase:
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print overlays-context-menu)"
//
// Asserts:
//   1. harness: at fine input the section's compact card resolves --ROW-H 30px and the
//      page 40px, as the source predicts; no menu is open;
//   2. a right-click in the Overview's canvas opens "Canvas actions" with its start
//      corner at the pointer (left = x, top = y + 2, within 1px), in the top layer
//      (:popover-open), in place (the canvas's parent contains it), with focus on the
//      menu; Escape closes it;
//   3. Shift+F10 on the focused canvas opens it anchored to the canvas (the menu's top
//      edge 2px below the canvas's bottom, or flipped above it) with focus on the first
//      item; Escape closes it and focus is back on the canvas;
//   4. keyboard identical to DropdownMenu: on a Dashboard row, the row's actions button
//      (a DropdownMenu) and Shift+F10 on that same button (the ContextMenu) list the
//      same items, and the same key sequence (arrows, End, Home, typeahead) walks them
//      through the same focused items; Escape returns focus to the button both times;
//   5. a right-click on a Dashboard row opens the menu named for that row's service,
//      Enter on an item raises a toast naming it; a right-click on the table head opens
//      no menu (onBeforeOpen leaves the browser's own);
//   6. the compact card's canvas: its menu items are exactly the card's --ROW-H (30px,
//      not the page's 40), the menu reaches past the card's clip box (below, or above
//      when it flips) and takes a press there (elementFromPoint); at coarse input every item is the 44px floor;
//   7. touch (CDP touch events): a touch held still for 700ms opens the menu and focus
//      stays in it after the release; a touch that moves 40px (a scroll) and is held
//      as long opens nothing;
//   8. forced colours: the focused item, and only it, is the system Highlight.
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (hash, input = "fine") => {
    await page.goto(`${base}${hash}`);
    await page.evaluate(([key, view]) => localStorage.setItem(key, JSON.stringify(view)), [
      KEY,
      { theme: "default", density: "comfortable", input },
    ]);
    await page.reload();
    await waitForShowcase(page);
    await page.waitForTimeout(200);
  };
  const settle = () => page.waitForTimeout(150);
  const openMenus = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=menu]")]
        .filter((m) => !m.inert && m.getBoundingClientRect().height > 0)
        .map((m) => m.getAttribute("aria-label") ?? m.getAttribute("aria-labelledby")),
    );
  const focusedText = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? null);
  const menuBox = (label) =>
    page.evaluate((name) => {
      const menu = [...document.querySelectorAll("[role=menu]")].find((m) => m.getAttribute("aria-label") === name && !m.inert);
      if (!menu) return null;
      const r = menu.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        bottom: r.bottom,
        topLayer: menu.matches(":popover-open"),
        focused: document.activeElement === menu,
        items: [...menu.querySelectorAll('[role^="menuitem"]')].map((i) => Math.round(i.getBoundingClientRect().height * 100) / 100),
      };
    }, label);

  await page.setViewportSize({ width: 1280, height: 900 });
  await load("#/overview/overlays-contextmenu");
  const canvas = page.locator('[data-testid="cm-canvas"]');
  await canvas.scrollIntoViewIfNeeded();

  // ── 1: harness ──────────────────────────────────────────────────────────
  const harness = await page.evaluate(() => ({
    card: Number.parseFloat(getComputedStyle(document.querySelector('[data-testid="cm-compact-card"]')).getPropertyValue("--ROW-H")),
    page: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ROW-H")),
  }));
  if (harness.card !== 30 || harness.page !== 40) fail.push(`harness: --ROW-H card ${harness.card}px, page ${harness.page}px; source predicts 30 and 40`);
  if ((await openMenus()).length !== 0) fail.push("harness: a menu is open before any right-click");

  // ── 2: right-click at the pointer ───────────────────────────────────────
  const box = await canvas.boundingBox();
  const point = { x: Math.round(box.x + 80), y: Math.round(box.y + 20) };
  await page.mouse.click(point.x, point.y, { button: "right" });
  await settle();
  const atPointer = await menuBox("Canvas actions");
  if (!atPointer) fail.push("a right-click in the canvas opened no Canvas actions menu");
  else {
    if (Math.abs(atPointer.left - point.x) > 1 || Math.abs(atPointer.top - (point.y + 2)) > 1) {
      fail.push(`the menu opened at ${atPointer.left},${atPointer.top}; the pointer was at ${point.x},${point.y} (expected its corner 2px below)`);
    }
    if (!atPointer.topLayer) fail.push("the context menu is not in the top layer");
    if (!atPointer.focused) fail.push("a pointer open did not focus the menu itself");
  }
  const inPlace = await page.evaluate(() => {
    const canvasEl = document.querySelector('[data-testid="cm-canvas"]');
    const menu = [...document.querySelectorAll("[role=menu]")].find((m) => m.getAttribute("aria-label") === "Canvas actions");
    return !!menu && canvasEl.parentElement.contains(menu);
  });
  if (!inPlace) fail.push("the context menu is not rendered in place beside its region (portalled?)");
  await page.keyboard.press("Escape");
  await settle();

  // ── 3: Shift+F10 at the element ─────────────────────────────────────────
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await settle();
  const atElement = await menuBox("Canvas actions");
  const canvasBox = await canvas.boundingBox();
  const firstItem = await focusedText();
  if (!atElement) fail.push("Shift+F10 on the focused canvas opened no menu");
  else {
    const below = Math.abs(atElement.top - (canvasBox.y + canvasBox.height + 2)) <= 1;
    const above = Math.abs(atElement.bottom - (canvasBox.y - 2)) <= 1;
    if (!below && !above) fail.push(`Shift+F10 opened the menu at top ${atElement.top}; the canvas spans ${canvasBox.y}–${canvasBox.y + canvasBox.height}`);
    if (firstItem !== "Cut⌘X") fail.push(`Shift+F10 focused ${JSON.stringify(firstItem)}, expected the first item "Cut"`);
  }
  await page.keyboard.press("Escape");
  await settle();
  if (!(await canvas.evaluate((el) => el === document.activeElement))) fail.push("Escape did not return focus to the canvas");

  // ── 4 + 5: the Dashboard row: DropdownMenu vs ContextMenu, same keys ────
  await load("#/dashboard");
  const row = page.locator("[data-dashboard-services] tbody tr").nth(1);
  await row.scrollIntoViewIfNeeded();
  const service = await row.locator("[data-service]").getAttribute("data-service");
  const button = row.getByRole("button", { name: `Actions for ${service}` });
  const KEYS = ["ArrowDown", "ArrowDown", "End", "Home", "ArrowUp", "c", "s"];
  const walk = async () => {
    const seen = [await focusedText()];
    for (const key of KEYS) {
      await page.keyboard.press(key);
      seen.push(await focusedText());
    }
    const items = await page.evaluate(() => {
      const menu = document.activeElement?.closest("[role=menu]");
      return menu ? [...menu.querySelectorAll('[role^="menuitem"]')].map((i) => i.textContent) : [];
    });
    await page.keyboard.press("Escape");
    await settle();
    return { seen, items, back: await button.evaluate((el) => el === document.activeElement) };
  };
  await button.focus();
  await page.keyboard.press("Enter");
  await settle();
  const dropdown = await walk();
  await button.focus();
  await page.keyboard.press("Shift+F10");
  await settle();
  const context = await walk();
  if (dropdown.items.length < 4) fail.push(`harness: the row's DropdownMenu lists ${JSON.stringify(dropdown.items)}`);
  if (JSON.stringify(dropdown.items) !== JSON.stringify(context.items)) {
    fail.push(`the row's menus differ: dropdown ${JSON.stringify(dropdown.items)}, context ${JSON.stringify(context.items)}`);
  }
  if (JSON.stringify(dropdown.seen) !== JSON.stringify(context.seen)) {
    fail.push(`the same keys walked differently: dropdown ${JSON.stringify(dropdown.seen)}, context ${JSON.stringify(context.seen)}`);
  }
  if (!dropdown.back || !context.back) fail.push(`Escape did not return focus to the actions button (dropdown ${dropdown.back}, context ${context.back})`);

  const rowBox = await row.boundingBox();
  await page.mouse.click(rowBox.x + 120, rowBox.y + rowBox.height / 2, { button: "right" });
  await settle();
  const rowMenus = await openMenus();
  if (!rowMenus.includes(`Actions for ${service}`)) fail.push(`a right-click on the ${service} row opened ${JSON.stringify(rowMenus)}`);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const toast = await page.evaluate((name) => [...document.querySelectorAll(".r-overlays-toast-region")].some((region) => region.textContent.includes(name)), service);
  if (!toast) fail.push(`running a row menu item raised no toast naming ${service}`);
  const head = page.locator("[data-dashboard-services] thead th").first();
  const headBox = await head.boundingBox();
  await page.mouse.click(headBox.x + 10, headBox.y + headBox.height / 2, { button: "right" });
  await settle();
  if ((await openMenus()).length !== 0) fail.push("a right-click on the table head opened a menu");
  await page.keyboard.press("Escape");

  // ── 6: compact card, fine and coarse ────────────────────────────────────
  for (const input of ["fine", "coarse"]) {
    await load("#/overview/overlays-contextmenu", input);
    const compact = page.locator('[data-testid="cm-compact-canvas"]');
    await compact.scrollIntoViewIfNeeded();
    const cb = await compact.boundingBox();
    await page.mouse.click(cb.x + 40, cb.y + cb.height - 8, { button: "right" });
    await settle();
    const measured = await menuBox("Canvas actions");
    const clip = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="cm-compact-card"]');
      const menu = [...card.querySelectorAll("[role=menu]")].find((m) => !m.inert);
      if (!menu) return null;
      const c = card.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      // The menu may open below the card or flip above it; probe the part outside the clip.
      const below = m.bottom - c.bottom;
      const above = c.top - m.top;
      const past = Math.max(below, above);
      const y = past <= 4 ? null : below >= above ? (Math.max(m.top, c.bottom) + m.bottom) / 2 : (m.top + Math.min(m.bottom, c.top)) / 2;
      const hit = y === null ? null : document.elementFromPoint((m.left + m.right) / 2, y);
      return { past: Math.round(past), hit: y === null ? "none outside" : menu.contains(hit) ? "menu" : hit?.tagName };
    });
    const want = input === "fine" ? 30 : 44;
    if (!measured || measured.items.length < 6 || measured.items.some((h) => Math.abs(h - want) > 0.5)) {
      fail.push(`${input}: compact card menu items are ${JSON.stringify(measured?.items)}, expected ${want}px each`);
    }
    if (!clip || !(clip.past > 0) || clip.hit !== "menu") fail.push(`${input}: the compact card's menu does not escape its clip and take presses (${JSON.stringify(clip)})`);
    await page.keyboard.press("Escape");
    await settle();
  }

  // ── 7: touch long press vs a moving touch ───────────────────────────────
  await load("#/overview/overlays-contextmenu");
  await canvas.scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  const tb = await canvas.boundingBox();
  const tx = Math.round(tb.x + 60);
  const ty = Math.round(tb.y + 30);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", tx, ty);
  await touch("touchMove", tx, ty + 40);
  await page.waitForTimeout(700);
  await touch("touchEnd");
  await settle();
  const afterScroll = await openMenus();
  if (afterScroll.length !== 0) fail.push(`a touch that moved 40px opened ${JSON.stringify(afterScroll)}`);
  await canvas.scrollIntoViewIfNeeded();
  const tb2 = await canvas.boundingBox();
  await touch("touchStart", Math.round(tb2.x + 60), Math.round(tb2.y + 30));
  await page.waitForTimeout(700);
  await touch("touchEnd");
  await settle();
  const afterHold = await openMenus();
  if (!afterHold.includes("Canvas actions")) fail.push(`a touch held still for 700ms opened ${JSON.stringify(afterHold)}`);
  // The release's compat mousedown must not pull focus back out of the menu.
  const holdFocus = await page.evaluate(() => Boolean(document.activeElement?.closest("[role=menu]")));
  if (!holdFocus) fail.push("after a long press, focus is not in the menu (the release moved it)");
  await page.keyboard.press("Escape");
  await cdp.detach();

  // ── 8: forced colours ───────────────────────────────────────────────────
  await page.emulateMedia({ forcedColors: "active" });
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await settle();
  const forced = await page.evaluate(() => {
    const focused = document.activeElement;
    const other = focused?.closest("[role=menu]")?.querySelectorAll('[role="menuitem"]:not([aria-disabled])')[1];
    // The system Highlight as this engine resolves it (a probe opted out of forcing).
    const probe = document.createElement("span");
    probe.style.cssText = "forced-color-adjust: none; background-color: Highlight";
    document.body.append(probe);
    const highlight = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return focused && other
      ? { focused: getComputedStyle(focused).backgroundColor, other: getComputedStyle(other).backgroundColor, highlight }
      : { focused: `${focused?.tagName} ${focused?.getAttribute("role")} ${focused?.textContent?.slice(0, 20)}`, other: null, highlight };
  });
  await page.keyboard.press("Escape");
  await page.emulateMedia({ forcedColors: "none" });
  if (!forced.other || forced.focused !== forced.highlight || forced.other === forced.highlight) {
    fail.push(`forced colours: the focused item is not the one Highlight row (${JSON.stringify(forced)})`);
  }

  stopErrors();
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  if (errors.length > 0) fail.push(...errors.slice(0, 5));
  if (fail.length > 0) throw new Error(`overlays-context-menu: ${fail.length} problem(s)\n  ${fail.join("\n  ")}`);
  return "overlays-context-menu: right-click at the pointer, Shift+F10 at the element, focus home; row DropdownMenu and ContextMenu walk identically; row menu acts on its row, head left alone; compact 30px / coarse 44px, past the clip; long press opens, a moving touch does not; forced-colours highlight";
}
