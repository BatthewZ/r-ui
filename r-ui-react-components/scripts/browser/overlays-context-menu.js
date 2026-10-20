// @covers   overlays/ContextMenu, overlays/DropdownMenu
// @sections overlays-contextmenu
// @tier     component
// @flags    touch
//
// Browser check: ContextMenu with real pointer, keys and touch, and the Dashboard's row menu.
//
// Run it through `bun run browser:check overlays-context`, or by hand against a running showcase:
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print overlays-context-menu)"
//
// Asserts:
//   1. harness: at fine input the page resolves --ROW-H 40px, as the source predicts; no
//      menu is open;
//   2. a right-click in the section's canvas opens "Canvas actions" with its start
//      corner at the pointer (left = x, top = y + the menu's gap `--R-SIZE-6`, resolved at
//      the canvas, within 1px), in the top layer
//      (:popover-open), in place (the canvas's parent contains it), with focus on the
//      menu (Escape closing it is ContextMenu.test.tsx's);
//   3. Shift+F10 on the focused canvas opens it anchored to the canvas (the menu's top
//      edge the gap below the canvas's bottom, or flipped above it) with focus on the first
//      item; Escape puts focus back on the canvas;
//   4. keyboard identical to DropdownMenu: on a Dashboard row, the row's actions button
//      (a DropdownMenu) and Shift+F10 on that same button (the ContextMenu) list the
//      same items, and the same key sequence (arrows, End, Home, typeahead) walks them
//      through the same focused items; Escape returns focus to the button both times;
//   5. a right-click on a Dashboard row opens the menu named for that row's service,
//      Enter on an item raises a toast naming it; a right-click on the table head opens
//      no menu (onBeforeOpen leaves the browser's own);
//      (A menu from a clipping compact card, its items at the card's --ROW-H at fine and
//      coarse, is sweep-floating's sweep.)
//   6. touch (CDP touch events): a touch held still for 700ms opens the menu and focus
//      stays in it after the release; a touch that moves 40px (a scroll) and is held
//      as long opens nothing;
//   7. forced colours: the focused item is the system Highlight and the next item is not.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const view = (input) => ({ theme: "default", density: "comfortable", input });
  const open = async (input = "fine") => {
    await openSection(page, "overlays-contextmenu", { view: view(input) });
    await page.waitForTimeout(200);
  };
  const loadDashboard = async () => {
    await page.goto(`${base}#/dashboard`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, view("fine")]);
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

  await open();
  const canvas = page.locator('[data-testid="cm-canvas"]');
  await canvas.scrollIntoViewIfNeeded();

  // ── 1: harness ──────────────────────────────────────────────────────────
  const harness = await page.evaluate(() => ({ page: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ROW-H")) }));
  if (harness.page !== 40) fail.push(`harness: the page's --ROW-H is ${harness.page}px; source predicts 40`);
  // The menu's gap is a token, read where the menu's anchor is.
  const gap = await canvas.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.cssText = "position: absolute; visibility: hidden; inline-size: var(--R-SIZE-6)";
    el.append(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    return px;
  });
  if (!(gap > 0)) fail.push(`harness: --R-SIZE-6 resolves to ${gap}px at the canvas`);
  if ((await openMenus()).length !== 0) fail.push("harness: a menu is open before any right-click");

  // ── 2: right-click at the pointer ───────────────────────────────────────
  const box = await canvas.boundingBox();
  const point = { x: Math.round(box.x + 80), y: Math.round(box.y + 20) };
  await page.mouse.click(point.x, point.y, { button: "right" });
  await settle();
  const atPointer = await menuBox("Canvas actions");
  if (!atPointer) fail.push("a right-click in the canvas opened no Canvas actions menu");
  else {
    if (Math.abs(atPointer.left - point.x) > 1 || Math.abs(atPointer.top - (point.y + gap)) > 1) {
      fail.push(`the menu opened at ${atPointer.left},${atPointer.top}; the pointer was at ${point.x},${point.y} (expected its corner ${gap}px below)`);
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
    const below = Math.abs(atElement.top - (canvasBox.y + canvasBox.height + gap)) <= 1;
    const above = Math.abs(atElement.bottom - (canvasBox.y - gap)) <= 1;
    if (!below && !above) fail.push(`Shift+F10 opened the menu at top ${atElement.top}; the canvas spans ${canvasBox.y}–${canvasBox.y + canvasBox.height}`);
    if (firstItem !== "Cut⌘X") fail.push(`Shift+F10 focused ${JSON.stringify(firstItem)}, expected the first item "Cut"`);
  }
  await page.keyboard.press("Escape");
  await settle();
  if (!(await canvas.evaluate((el) => el === document.activeElement))) fail.push("Escape did not return focus to the canvas");

  // ── 4 + 5: the Dashboard row: DropdownMenu vs ContextMenu, same keys ────
  await loadDashboard();
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

  // ── 6: touch long press vs a moving touch ───────────────────────────────
  await open();
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

  // ── 7: forced colours ───────────────────────────────────────────────────
  await setView(page, { forced: true });
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
  await setView(page, { forced: false });
  if (!forced.other || forced.focused !== forced.highlight || forced.other === forced.highlight) {
    fail.push(`forced colours: the focused item is not the one Highlight row (${JSON.stringify(forced)})`);
  }

  stopErrors();
  if (errors.length > 0) fail.push(...errors.slice(0, 5));
  if (fail.length > 0) throw new Error(`overlays-context-menu: ${fail.length} problem(s)\n  ${fail.join("\n  ")}`);
  return "overlays-context-menu: right-click at the pointer, Shift+F10 at the element, focus home; row DropdownMenu and ContextMenu walk identically; row menu acts on its row, head left alone; long press opens, a moving touch does not; forced-colours highlight";
}
