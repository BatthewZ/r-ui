// @covers   marketing/NavigationMenu, marketing/SiteHeader
// @sections marketing-siteheader marketing-navigationmenu
// @tier     component
// @flags    timing
//
// Browser check: NavigationMenu inside SiteHeader (disclosure navigation, keyboard, hover intent).
//
// Run it through `bun run browser:check marketing-siteheader-menu`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print marketing-siteheader-menu)"
//
// jsdom has no top layer, no real focus order across a promoted panel, no
// pointer geometry and no container query. On the SiteHeader and NavigationMenu
// sections, opened together alone (`[data-testid^="sh-"]`, `[data-testid^="nm-"]`), at
// 1440 (so the SaaS header's demo is past its 56rem fold with room to spare),
// comfortable, fine, it asserts:
//   1. harness: the SaaS header is wide (its navigation drawn, its menu button
//      not); disclosure semantics: no menu, menubar or menuitem role and no
//      `aria-haspopup` but the menu button's "dialog" anywhere in the header,
//      closed or open; every button in its navigation has `aria-expanded`; an
//      open panel is the button's next sibling, named
//      by its `aria-controls`, in the top layer (`:popover-open`), and holds
//      only links and the featured card;
//   2. a mega panel spans the header's bar (its start edge and width within
//      2px of the bar's) and sits below the bar, inside the viewport;
//   3. keyboard with real keys: Tab from the brand reaches Product, Enter
//      opens it, Tab walks into its first link (Editor), Shift+Tab returns to
//      Product with the panel open, Escape from a link closes it and puts
//      focus on Product; Tab through every link and the featured card lands
//      on Resources with Product closed; ArrowRight moves along the bar,
//      ArrowDown opens Resources on its first link, ArrowDown walks, Escape
//      returns; in the RTL header ArrowLeft moves to the second item;
//   4. one panel at a time: with Product open, a press on Resources leaves
//      exactly one panel in the document (after the exit) and it is
//      Resources';
//   5. hover intent: the pointer resting on Product opens nothing in the
//      first 60ms and opens it by 1s, no sooner than 120ms; the bridge: the
//      pointer resting 600ms (past the 300ms close delay) in the gap between
//      Product and its panel keeps it open, then inside the panel too, and a
//      press at the panel's centre hits the panel; with Product hover-open the
//      pointer moving onto Resources opens Resources within 120ms (warm, under
//      the 150ms rest) and closes Product; the pointer leaving to a far corner
//      closes everything within 1.5s;
//   6. current page: in the docs header "API reference" carries
//      `aria-current="page"` and an accent bar (an opaque `::after`) under it;
//   7. density: Resources' rows in the compact NavigationMenu are the compact
//      frame's `--ROW-H` (a panel rendered in place inherits it), shorter than
//      the comfortable menu's.
async (page) => {
  const fail = [];
  const summary = {};
  const { errors } = collectErrors(page, { filter: (t) => /nav|NavigationMenu|SiteHeader|popover|header/i.test(t) });

  const saas = page.locator('[data-testid="sh-saas"]');
  const nav = saas.getByRole("navigation", { name: "Main" });
  const product = nav.getByRole("button", { name: "Product" });
  const resources = nav.getByRole("button", { name: "Resources" });
  const activeName = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "");
  const expanded = async (loc) => (await loc.getAttribute("aria-expanded")) === "true";
  const panelState = (trigger) =>
    trigger.evaluate((button) => {
      const id = button.getAttribute("aria-controls");
      const panel = id ? document.getElementById(id) : null;
      if (!panel) return null;
      const r = panel.getBoundingClientRect();
      return {
        sibling: button.nextElementSibling === panel,
        open: panel.matches(":popover-open") && !panel.inert,
        box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
      };
    });
  const isOpen = async (trigger) => (await panelState(trigger))?.open === true;
  const waitFor = async (predicate, timeout = 1500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await predicate()) return Date.now() - start;
      await page.waitForTimeout(20);
    }
    return null;
  };
  const centre = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const closeAll = async () => {
    await page.mouse.move(2, 2);
    await page.keyboard.press("Escape");
    await waitFor(async () => !(await expanded(product)) && !(await expanded(resources)));
    // A hover within 300ms of a close opens at once (the menu's skip delay): let it lapse,
    // so the next step starts cold. The panels' exits finish inside it.
    await page.waitForTimeout(300);
  };

  await openSection(page, ["marketing-siteheader", "marketing-navigationmenu"], { width: 1440, view: { theme: "default", density: "comfortable", input: "fine" } });
  await saas.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);

  // ── 1. Harness and semantics ──────────────────────────────────────────────
  const form = await saas.evaluate((frame) => {
    const header = frame.querySelector("header");
    const drawn = (el) => el && el.getClientRects().length > 0;
    return {
      nav: drawn(header.querySelector("nav")),
      menuButton: drawn([...header.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Menu")),
    };
  });
  if (!form.nav || form.menuButton) fail.push(`harness: the SaaS header is not in its wide form at 1440 (${JSON.stringify(form)})`);
  const roles = () =>
    saas.evaluate((frame) => {
      const header = frame.querySelector("header");
      return {
        menuRoles: header.querySelectorAll('[role="menu"], [role="menubar"], [role="menuitem"], [aria-haspopup]:not([aria-haspopup="dialog"])').length,
        buttonsWithoutExpanded: [...header.querySelector("nav").querySelectorAll("button")].filter((b) => !b.hasAttribute("aria-expanded")).length,
        buttons: header.querySelector("nav").querySelectorAll("button").length,
      };
    });
  const closedRoles = await roles();
  if (closedRoles.buttons !== 2) fail.push(`harness: the SaaS navigation has ${closedRoles.buttons} buttons, expected 2 (Product, Resources)`);
  await product.click();
  if ((await waitFor(() => isOpen(product), 800)) === null) fail.push("semantics: a press on Product did not open its panel in the top layer");
  const openRoles = await roles();
  if (closedRoles.menuRoles + openRoles.menuRoles > 0 || openRoles.buttonsWithoutExpanded > 0) fail.push(`semantics: menu roles or a button without aria-expanded: ${JSON.stringify({ closedRoles, openRoles })}`);
  const panel = await panelState(product);
  if (!panel?.sibling) fail.push("semantics: the open panel is not the button's next sibling");
  const panelContent = await product.evaluate((button) => {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    const focusables = [...panel.querySelectorAll("a[href], button, input, [tabindex]")];
    return { links: focusables.filter((f) => f.matches("a[href]")).length, others: focusables.filter((f) => !f.matches("a[href]")).length };
  });
  if (panelContent.links !== 7 || panelContent.others !== 0) fail.push(`semantics: Product's panel holds ${JSON.stringify(panelContent)}, expected 7 links (six + the featured card) and nothing else`);

  // ── 2. The mega panel spans the bar ───────────────────────────────────────
  const bar = await saas.evaluate((frame) => {
    const r = frame.querySelector("header > div").getBoundingClientRect();
    return { left: r.left, width: r.width, bottom: r.bottom };
  });
  if (panel) {
    summary.mega = { bar: Math.round(bar.width), panel: Math.round(panel.box.width) };
    if (Math.abs(panel.box.left - bar.left) > 2 || Math.abs(panel.box.width - bar.width) > 2) fail.push(`mega: the panel ${JSON.stringify(panel.box)} does not span the bar ${JSON.stringify(bar)}`);
    if (panel.box.top < bar.bottom - 1) fail.push(`mega: the panel's top ${panel.box.top} is above the bar's bottom ${bar.bottom}`);
    if (panel.box.left < 0 || panel.box.right > 1440) fail.push(`mega: the panel leaves the viewport ${JSON.stringify(panel.box)}`);
  }
  await closeAll();

  // ── 3. Keyboard ───────────────────────────────────────────────────────────
  await saas.getByRole("link", { name: "Kilnworks" }).focus();
  await page.keyboard.press("Tab");
  if ((await activeName()) !== "Product") fail.push(`keys: Tab from the brand landed on "${await activeName()}", expected Product`);
  await page.keyboard.press("Enter");
  if (!(await expanded(product))) fail.push("keys: Enter did not open Product");
  await page.keyboard.press("Tab");
  if (!(await activeName()).startsWith("Editor")) fail.push(`keys: Tab from an open Product landed on "${await activeName()}", expected its first link (Editor)`);
  await page.keyboard.press("Shift+Tab");
  if ((await activeName()) !== "Product" || !(await expanded(product))) fail.push("keys: Shift+Tab from Editor did not return to Product with the panel open");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  if ((await activeName()) !== "Product") fail.push(`keys: Escape from a link left focus on "${await activeName()}", expected Product`);
  if (await expanded(product)) fail.push("keys: Escape from a link left Product open");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  if (!(await activeName()).startsWith("What's new")) fail.push(`keys: seven Tabs from Product landed on "${await activeName()}", expected the featured card last`);
  await page.keyboard.press("Tab");
  if ((await activeName()) !== "Resources") fail.push(`keys: Tab out of the panel landed on "${await activeName()}", expected Resources`);
  if ((await waitFor(async () => !(await expanded(product)), 500)) === null) fail.push("keys: focus leaving Product's panel did not close it");
  await page.keyboard.press("ArrowLeft");
  if ((await activeName()) !== "Product") fail.push(`keys: ArrowLeft from Resources landed on "${await activeName()}"`);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  if (!(await expanded(resources)) || (await activeName()) !== "Documentation") fail.push(`keys: ArrowDown on Resources gave focus to "${await activeName()}", expected an open panel on Documentation`);
  await page.keyboard.press("ArrowDown");
  if ((await activeName()) !== "Blog") fail.push(`keys: ArrowDown in the panel landed on "${await activeName()}", expected Blog`);
  await page.keyboard.press("Escape");
  if ((await activeName()) !== "Resources" || (await expanded(resources))) fail.push("keys: Escape in Resources' panel did not close it onto its button");
  await closeAll();
  const rtl = page.locator('[data-testid="sh-rtl"] nav');
  await rtl.scrollIntoViewIfNeeded();
  await rtl.getByRole("button", { name: "المنتج" }).focus();
  await page.keyboard.press("ArrowLeft");
  if ((await activeName()) !== "الموارد") fail.push(`keys: ArrowLeft in the RTL header landed on "${await activeName()}", expected the second item (الموارد)`);
  await closeAll();

  // ── 4. One panel at a time ────────────────────────────────────────────────
  await saas.scrollIntoViewIfNeeded();
  await product.click();
  await resources.click();
  // Product's panel leaves the document once its exit finishes.
  await settle(page);
  const panels = await page.evaluate(() => [...document.querySelectorAll("[data-nav-panel]")].map((p) => p.id));
  const resourcesPanel = await resources.getAttribute("aria-controls");
  if (panels.length !== 1 || panels[0] !== resourcesPanel || (await expanded(product))) fail.push(`one: after Product then Resources the document holds panels ${JSON.stringify(panels)}, expected only Resources' (${resourcesPanel})`);
  await closeAll();

  // ── 5. Hover intent and the bridge ────────────────────────────────────────
  await page.mouse.move(2, 2);
  const p = await centre(product);
  const t0 = Date.now();
  await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.waitForTimeout(60);
  if (await expanded(product)) fail.push("hover: Product opened within 60ms of the pointer arriving");
  const waited = await waitFor(() => isOpen(product), 1000);
  const elapsed = Date.now() - t0;
  if (waited === null) fail.push("hover: resting on Product never opened it");
  else if (elapsed < 120) fail.push(`hover: Product opened ${elapsed}ms after the pointer arrived, before the rest`);
  summary.hoverOpen = `${elapsed}ms`;
  const hp = await panelState(product);
  const trig = await product.boundingBox();
  if (hp && trig) {
    const gapY = (trig.y + trig.height + hp.box.top) / 2;
    summary.gap = Math.round(hp.box.top - (trig.y + trig.height));
    if (summary.gap < 4) fail.push(`harness: the gap between Product and its panel is ${summary.gap}px, too small to rest in`);
    await page.mouse.move(p.x, gapY, { steps: 3 });
    await page.waitForTimeout(600);
    if (!(await isOpen(product))) fail.push("bridge: resting 600ms in the gap between Product and its panel closed it");
    const into = { x: hp.box.left + hp.box.width / 2, y: hp.box.top + hp.box.height / 2 };
    await page.mouse.move(into.x, into.y, { steps: 6 });
    await page.waitForTimeout(600);
    if (!(await isOpen(product))) fail.push("bridge: the panel closed with the pointer resting inside it");
    const hit = await product.evaluate((button, [x, y]) => document.getElementById(button.getAttribute("aria-controls"))?.contains(document.elementFromPoint(x, y)) ?? false, [into.x, into.y]);
    if (!hit) fail.push("bridge: a press at the panel's centre does not reach the panel");
    // Back to Product, then across to Resources: warm, it opens at once.
    await page.mouse.move(p.x, p.y, { steps: 6 });
    await page.waitForTimeout(100);
    const r = await centre(resources);
    // Timed in the page, from the pointer's arrival to the open panel, frame by frame:
    // a locator round trip per poll on this long page costs more than the budget.
    await resources.evaluate((button) => {
      window.__scWarm = undefined;
      let arrived = null;
      button.addEventListener("pointerenter", () => (arrived ??= performance.now()), { once: true });
      const end = performance.now() + 2000;
      const tick = () => {
        const id = button.getAttribute("aria-controls");
        const panel = id ? document.getElementById(id) : null;
        if (arrived !== null && panel?.matches(":popover-open") && !panel.inert) return void (window.__scWarm = Math.round(performance.now() - arrived));
        if (performance.now() > end) return void (window.__scWarm = null);
        requestAnimationFrame(tick);
      };
      tick();
    });
    await page.mouse.move(r.x, r.y, { steps: 2 });
    const warm = await page.waitForFunction(() => window.__scWarm !== undefined && { ms: window.__scWarm }).then((h) => h.jsonValue()).then((v) => v.ms);
    summary.warmOpen = warm === null ? null : `${warm}ms`;
    if (warm === null || warm > 120) fail.push(`hover: with Product open, Resources opened after ${warm}ms, expected at once (< 120ms)`);
    if ((await waitFor(async () => !(await expanded(product)), 300)) === null) fail.push("hover: Product stayed open beside Resources");
  }
  await page.mouse.move(2, 2, { steps: 4 });
  if ((await waitFor(async () => !(await expanded(product)) && !(await expanded(resources)), 1500)) === null) fail.push("hover: a panel stayed open 1.5s after the pointer left");

  // ── 6. Current page ───────────────────────────────────────────────────────
  const api = page.locator('[data-testid="sh-docs"]').getByRole("link", { name: "API reference" });
  await api.scrollIntoViewIfNeeded();
  const marker = await api.evaluate((a) => {
    const after = getComputedStyle(a, "::after");
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = after.backgroundColor;
    c.fillRect(0, 0, 1, 1);
    return { current: a.getAttribute("aria-current"), alpha: c.getImageData(0, 0, 1, 1).data[3], height: parseFloat(after.height) };
  });
  if (marker.current !== "page" || marker.alpha < 255 || !(marker.height > 0)) fail.push(`current: API reference is ${JSON.stringify(marker)}, expected aria-current="page" and an opaque accent bar`);

  // ── 7. Density reaches the in-place panel ────────────────────────────────
  const rowHeights = async (id) => {
    const frame = page.locator(`[data-testid="${id}"]`);
    await frame.scrollIntoViewIfNeeded();
    const button = frame.getByRole("button", { name: "Resources" });
    await button.click();
    await waitFor(() => isOpen(button), 800);
    const m = await button.evaluate((b) => {
      const panel = document.getElementById(b.getAttribute("aria-controls"));
      const rows = [...panel.querySelectorAll("a[href]")].map((a) => a.getBoundingClientRect().height);
      return { rows, rowH: parseFloat(getComputedStyle(panel).getPropertyValue("--ROW-H")), promoted: panel.matches(":popover-open") };
    });
    await page.keyboard.press("Escape");
    await settle(page);
    return m;
  };
  const comfortable = await rowHeights("nm-basic");
  const compact = await rowHeights("nm-compact");
  summary.rows = { comfortable: comfortable.rows[0], compact: compact.rows[0] };
  if (compact.rows.length !== 3 || comfortable.rows.length !== 3) fail.push(`density: harness: Resources holds ${compact.rows.length}/${comfortable.rows.length} rows, expected 3`);
  if (!compact.promoted) fail.push("density: the compact panel is not in the top layer");
  if (compact.rows.some((h) => Math.abs(h - compact.rowH) > 1)) fail.push(`density: compact rows ${JSON.stringify(compact.rows)} are not the frame's --ROW-H ${compact.rowH}`);
  if (!(compact.rows[0] < comfortable.rows[0])) fail.push(`density: compact rows (${compact.rows[0]}px) are not shorter than comfortable ones (${comfortable.rows[0]}px)`);

  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`marketing-siteheader-menu FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `marketing-siteheader-menu OK ${JSON.stringify(summary)}`;
}
