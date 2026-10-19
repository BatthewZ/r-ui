// @covers   marketing/SiteHeader
// @sections marketing-siteheader
// @tier     component
//
// Browser check: SiteHeader by its own width, the menu, hide-on-scroll, the transparent variant, floors and 375.
//
// Run it through `bun run browser:check marketing-siteheader-layout`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print marketing-siteheader-layout)"
//
// jsdom applies no container query, scrolls nothing, opens no modal in the top
// layer and paints nothing. On the SiteHeader section, opened alone
// (`[data-testid^="sh-"]`), it asserts:
//   1. the container decides: at 1440 the SaaS header is wide and the narrow
//      box's (22rem) folded, in the same viewport: its navigation is not drawn,
//      its brand and menu button are;
//   2. the menu: a press on the menu button opens a modal (`:modal`, top
//      layer) named "Menu", inside the viewport, holding a navigation named
//      "Main" whose links are exactly the wide SaaS header's (top-level links
//      plus every panel's, opened one by one, featured card included), no menu
//      roles; Product (holding the current page) starts expanded; Escape closes
//      it with focus back on the menu button; following a link closes it;
//   3. hideOnScroll, in the transparent demo's own scroller: at the top the
//      header sits on the scroller's top edge; 400px down it is hidden (moved
//      up past the edge, `data-hidden`); 60px back up it is back on the edge;
//      with focus on its brand link a further 400px down leaves it shown;
//      focus moved into the page and a scroll down hides it, and Shift+Tab
//      from the hero's first control back into the header shows it again;
//      under reduced motion the header is out of view two frames after it turns
//      hidden, no transition running on it;
//   4. transparent → solid, in the default and a dark theme: at the top the
//      header paints no background and its top-level items read ≥ 4.5:1 on
//      what is painted behind them (the hero band, found by hit-testing
//      beneath the header); scrolled, it paints an opaque background and the
//      same items read ≥ 4.5:1 on it;
//   5. coarse input: the wide header's top-level items, the Resources panel's links and
//      the menu's rows and section buttons are ≥ 44px tall; the narrow menu
//      button answers a press 20px off its centre (its hit area);
//   6. at 375 (coarse): every header frame
//      in the section has folded (no navigation drawn), and no element in a
//      frame reaches past it (the visually hidden skip link aside); the menu's
//      drawer is inside the viewport and does not scroll sideways; in RTL it
//      comes from the left edge;
//   7. print: the headers are not printed.
async (page) => {
  const fail = [];
  const summary = {};
  const { errors } = collectErrors(page, { filter: (t) => /nav|NavigationMenu|SiteHeader|header|dialog|Drawer/i.test(t) });

  const load = async ({ theme = "default", density = "comfortable", input = "fine", width = 1440 } = {}) => {
    await openSection(page, "marketing-siteheader", { width, view: { theme, density, input } });
    await page.locator('[data-testid="sh-saas"] header').waitFor();
  };
  const frame = (id) => page.locator(`[data-testid="${id}"]`);
  const drawnState = (id) =>
    frame(id).evaluate((f) => {
      const header = f.querySelector("header");
      const drawn = (el) => Boolean(el) && el.getClientRects().length > 0;
      const menu = header.querySelector("button[aria-haspopup='dialog']");
      return {
        width: header.getBoundingClientRect().width,
        nav: drawn(header.querySelector(":scope > div > nav")),
        menu: drawn(menu),
        brand: drawn(header.querySelector(":scope > div > div a")),
      };
    });
  const waitFor = async (predicate, timeout = 1500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await predicate()) return Date.now() - start;
      await page.waitForTimeout(20);
    }
    return null;
  };

  // ── 1. The container decides ──────────────────────────────────────────────
  await load();
  const wide = await drawnState("sh-saas");
  const narrow = await drawnState("sh-narrow");
  summary.widths = { wide: Math.round(wide.width), narrow: Math.round(narrow.width) };
  if (!(wide.width >= 896) || !wide.nav || wide.menu) fail.push(`harness: the SaaS header is not wide at 1440 (${JSON.stringify(wide)})`);
  if (!(narrow.width < 672) || narrow.nav || !narrow.menu || !narrow.brand) fail.push(`fold: the 22rem header did not fold in the same viewport (${JSON.stringify(narrow)})`);

  // ── 2. The menu holds the same links ──────────────────────────────────────
  const saasNav = frame("sh-saas").getByRole("navigation", { name: "Main" });
  const wideHrefs = new Set(await saasNav.evaluate((nav) => [...nav.querySelectorAll(":scope > ul > li > a[href]")].map((a) => a.getAttribute("href"))));
  for (const name of ["Product", "Resources"]) {
    const button = saasNav.getByRole("button", { name });
    await button.click();
    await settle(page);
    for (const href of await button.evaluate((b) => [...document.getElementById(b.getAttribute("aria-controls")).querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))) wideHrefs.add(href);
    await page.keyboard.press("Escape");
    await settle(page);
  }
  const menuButton = frame("sh-narrow").getByRole("button", { name: "Menu" });
  await menuButton.scrollIntoViewIfNeeded();
  await menuButton.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  if ((await waitFor(() => dialog.isVisible(), 1000)) === null) fail.push("menu: the menu button opened no dialog named Menu");
  else {
    await settle(page);
    const m = await dialog.evaluate((d) => {
      const r = d.getBoundingClientRect();
      const nav = d.querySelector("nav");
      return {
        modal: d.matches(":modal"),
        box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        navName: nav?.getAttribute("aria-label"),
        hrefs: [...(nav?.querySelectorAll("a[href]") ?? [])].map((a) => a.getAttribute("href")),
        menuRoles: d.querySelectorAll('[role="menu"], [role="menuitem"], [role="menubar"]').length,
        product: [...d.querySelectorAll("button[aria-expanded]")].find((b) => b.textContent.trim() === "Product")?.getAttribute("aria-expanded"),
      };
    });
    const menuHrefs = new Set(m.hrefs);
    const same = wideHrefs.size === menuHrefs.size && [...wideHrefs].every((h) => menuHrefs.has(h));
    summary.links = { wide: wideHrefs.size, menu: menuHrefs.size };
    if (wideHrefs.size < 10) fail.push(`harness: collected only ${wideHrefs.size} links from the wide header`);
    if (!same) fail.push(`menu: its links differ from the wide header's: ${JSON.stringify({ wide: [...wideHrefs], menu: m.hrefs })}`);
    if (!m.modal || m.navName !== "Main" || m.menuRoles > 0) fail.push(`menu: ${JSON.stringify({ modal: m.modal, nav: m.navName, menuRoles: m.menuRoles })}`);
    if (m.box.left < -1 || m.box.right > 1441 || m.box.top < -1 || m.box.bottom > 901) fail.push(`menu: the drawer ${JSON.stringify(m.box)} leaves the viewport`);
    if (m.product !== "true") fail.push(`menu: Product (it holds the current page) is aria-expanded=${m.product}, expected open`);
    await page.keyboard.press("Escape");
    if ((await waitFor(async () => !(await dialog.isVisible()), 1000)) === null) fail.push("menu: Escape left the menu open");
    const home = await menuButton.evaluate((b) => b === document.activeElement);
    if (!home) fail.push("menu: focus did not return to the menu button");
    await menuButton.click();
    await dialog.waitFor();
    await dialog.getByRole("link", { name: "Pricing" }).click();
    if ((await waitFor(async () => !(await dialog.isVisible()), 1000)) === null) fail.push("menu: following a link left the menu open");
  }

  // ── 3. hideOnScroll in the transparent demo's scroller ────────────────────
  await load();
  const box = frame("sh-hero");
  await box.scrollIntoViewIfNeeded();
  const scrollTo = (top) => box.evaluate((el, t) => el.scrollTo({ top: t, behavior: "instant" }), top);
  const headerState = () =>
    box.evaluate((el) => {
      const header = el.querySelector("header");
      const b = el.getBoundingClientRect();
      const h = header.getBoundingClientRect();
      return { hidden: header.hasAttribute("data-hidden"), top: h.top - b.top, bottom: h.bottom - b.top, scrolled: header.hasAttribute("data-scrolled"), running: header.getAnimations().length };
    });
  const atTop = await headerState();
  if (Math.abs(atTop.top) > 1.5 || atTop.hidden) fail.push(`hide: at the top the header is ${JSON.stringify(atTop)}, expected on the scroller's edge`);
  await scrollTo(400);
  await settle(page);
  const down = await headerState();
  if (!down.hidden || down.bottom > 1) fail.push(`hide: 400px down the header is ${JSON.stringify(down)}, expected hidden above the edge`);
  await scrollTo(340);
  await settle(page);
  const up = await headerState();
  if (up.hidden || Math.abs(up.top) > 1.5) fail.push(`hide: 60px back up the header is ${JSON.stringify(up)}, expected back on the edge`);
  await box.locator("header").getByRole("link", { name: "Kilnworks" }).evaluate((a) => a.focus({ preventScroll: true }));
  await scrollTo(740);
  await settle(page);
  const held = await headerState();
  if (held.hidden || Math.abs(held.top) > 1.5) fail.push(`hide: with focus inside, a scroll down hid the header (${JSON.stringify(held)})`);
  const heroAction = box.locator("section").getByRole("button", { name: "Start free" });
  await heroAction.evaluate((b) => b.focus({ preventScroll: true }));
  await scrollTo(1140);
  await settle(page);
  if (!(await headerState()).hidden) fail.push("hide: with focus in the page, a scroll down left the header shown");
  await page.keyboard.press("Shift+Tab");
  await settle(page);
  const back = await headerState();
  const inHeader = await box.evaluate((el) => el.querySelector("header").contains(document.activeElement));
  if (!inHeader) fail.push("hide: harness: Shift+Tab from the hero's button did not enter the header");
  if (back.hidden || Math.abs(back.top) > 1.5) fail.push(`hide: focus arriving in the hidden header left it ${JSON.stringify(back)}`);
  // Reduced motion: no slide, the header is simply gone.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await heroAction.evaluate((b) => b.focus({ preventScroll: true }));
  await scrollTo(0);
  await settle(page);
  await scrollTo(500);
  const instant = await box.evaluate(
    (el) =>
      new Promise((resolve) => {
        const header = el.querySelector("header");
        const read = () => ({ hidden: header.hasAttribute("data-hidden"), bottom: header.getBoundingClientRect().bottom - el.getBoundingClientRect().top, running: header.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().activeDuration >= 1).length });
        // Two frames from the frame the header turns hidden (when the scroll is handled varies with load).
        const until = performance.now() + 1000;
        const whenHidden = () => {
          if (header.hasAttribute("data-hidden") || performance.now() > until) requestAnimationFrame(() => requestAnimationFrame(() => resolve(read())));
          else requestAnimationFrame(whenHidden);
        };
        whenHidden();
      }),
  );
  if (!instant.hidden || instant.bottom > 1 || instant.running > 0) fail.push(`hide: under reduced motion the header is ${JSON.stringify(instant)} two frames after it turned hidden, expected gone with no transition running`);
  await page.emulateMedia({ reducedMotion: null });

  // ── 4. Transparent → solid, contrast on both ──────────────────────────────
  const contrast = () =>
    box.evaluate((el) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgba = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      const paint = (layers) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const color of layers) {
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = ([r, g, b]) => {
        const c = (v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      // The backgrounds painted under (x, y), bottom first, from the first opaque one up.
      const stackUnder = (start) => {
        const layers = [];
        for (let n = start; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          const a = rgba(bg)[3];
          if (a > 0) layers.unshift(bg);
          if (a === 255) return layers;
        }
        layers.unshift(getComputedStyle(document.documentElement).backgroundColor);
        return layers;
      };
      const header = el.querySelector("header");
      const items = [...header.querySelectorAll("nav [data-nav-top]")];
      return {
        headerAlpha: rgba(getComputedStyle(header).backgroundColor)[3],
        scrolled: header.hasAttribute("data-scrolled"),
        items: items.map((item) => {
          const r = item.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          // What is painted under the header at this point: the first element there that is not part of it.
          const behind = document.elementsFromPoint(x, y).find((n) => !header.contains(n));
          // The item's own backgrounds up to the header; past it is not what paints behind the header.
          const own = [];
          let opaque = false;
          for (let n = item; n && !opaque; n = n === header ? null : n.parentElement) {
            const bg = getComputedStyle(n).backgroundColor;
            const a = rgba(bg)[3];
            if (a > 0) own.unshift(bg);
            opaque = a === 255;
          }
          const under = opaque ? own : [...stackUnder(behind), ...own];
          return { name: item.textContent.trim(), ratio: ratio(paint([...under, getComputedStyle(item).color]), paint(under)), behind: behind?.tagName };
        }),
      };
    });
  const themes = ["default", await darkTheme(page)];
  summary.contrast = {};
  for (const theme of themes) {
    await load({ theme });
    await box.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await scrollTo(0);
    await settle(page);
    const clear = await contrast();
    await scrollTo(600);
    await settle(page);
    await scrollTo(500);
    await settle(page);
    const solid = await contrast();
    const min = (m) => Math.min(...m.items.map((i) => i.ratio));
    summary.contrast[theme === "default" ? "default" : "dark"] = { clear: +min(clear).toFixed(2), solid: +min(solid).toFixed(2) };
    if (clear.items.length !== 4 || solid.items.length !== 4) fail.push(`contrast: harness: found ${clear.items.length}/${solid.items.length} top-level items, expected 4`);
    if (clear.headerAlpha !== 0 || clear.scrolled) fail.push(`contrast (${theme}): at the top the transparent header paints a background (alpha ${clear.headerAlpha})`);
    if (clear.items.some((i) => i.behind !== "SECTION" && i.behind !== "DIV")) fail.push(`contrast (${theme}): harness: behind the header is ${JSON.stringify(clear.items.map((i) => i.behind))}`);
    if (solid.headerAlpha !== 255 || !solid.scrolled) fail.push(`contrast (${theme}): scrolled, the header is not solid (alpha ${solid.headerAlpha})`);
    for (const [state, m] of [["transparent", clear], ["solid", solid]]) {
      for (const i of m.items) if (!(i.ratio >= 4.5)) fail.push(`contrast (${theme}, ${state}): "${i.name}" reads ${i.ratio.toFixed(2)}:1`);
    }
  }

  // ── 5. Coarse floors ──────────────────────────────────────────────────────
  await load({ input: "coarse" });
  const hitMin = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.blockSize = "var(--HIT-MIN)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });
  if (hitMin !== 44) fail.push(`harness: --HIT-MIN at coarse is ${hitMin}px, expected 44`);
  const coarseNav = frame("sh-saas").getByRole("navigation", { name: "Main" });
  await coarseNav.scrollIntoViewIfNeeded();
  const tops = await coarseNav.evaluate((nav) => [...nav.querySelectorAll("[data-nav-top]")].map((t) => t.getBoundingClientRect().height));
  if (tops.length !== 4 || tops.some((h) => h < 44)) fail.push(`coarse: top-level items ${JSON.stringify(tops)} are not all ≥ 44px`);
  const resources = coarseNav.getByRole("button", { name: "Resources" });
  await resources.click();
  await settle(page);
  const rows = await resources.evaluate((b) => [...document.getElementById(b.getAttribute("aria-controls")).querySelectorAll("a[href]")].map((a) => a.getBoundingClientRect().height));
  if (rows.length !== 3 || rows.some((h) => h < 44)) fail.push(`coarse: panel rows ${JSON.stringify(rows)} are not all ≥ 44px`);
  await page.keyboard.press("Escape");
  const coarseMenu = frame("sh-narrow").getByRole("button", { name: "Menu" });
  await coarseMenu.scrollIntoViewIfNeeded();
  const mb = await coarseMenu.boundingBox();
  const offHit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null, [mb.x + mb.width / 2, mb.y + mb.height / 2 + 20]);
  if (offHit !== "Menu") fail.push(`coarse: a press 20px below the menu button's centre reached ${offHit}, not its hit area`);
  await coarseMenu.click();
  await dialog.waitFor();
  await settle(page);
  const menuRows = await dialog.evaluate((d) => [...d.querySelectorAll("nav a[href], nav button")].filter((n) => n.getClientRects().length > 0 && !n.closest("[inert]")).map((n) => ({ name: n.textContent.trim().slice(0, 20), h: n.getBoundingClientRect().height })));
  if (menuRows.length < 4 || menuRows.some((r) => r.h < 44)) fail.push(`coarse: menu rows ${JSON.stringify(menuRows)} are not all ≥ 44px`);
  await page.keyboard.press("Escape");

  // ── 6. 375 ────────────────────────────────────────────────────────────────
  await load({ input: "coarse", width: 375 });
  const phone = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('[data-testid^="sh-"]')];
    return {
      frames: frames.map((f) => {
        const fr = f.getBoundingClientRect();
        const header = f.querySelector("header");
        const spills = [...f.querySelectorAll("*")]
          .filter((el) => el.getClientRects().length > 0 && !el.closest(".r-marketing-site-header-skip, dialog, [popover]"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.right > fr.right + 1 || r.left < fr.left - 1;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
        return { id: f.dataset.testid, nav: header.querySelector(":scope > div > nav")?.getClientRects().length > 0, spills: spills.slice(0, 4) };
      }),
    };
  });
  if (phone.frames.length !== 7) fail.push(`375: harness: found ${phone.frames.length} header frames, expected 7`);
  for (const f of phone.frames) {
    if (f.nav) fail.push(`375: ${f.id} still draws its navigation`);
    if (f.spills.length) fail.push(`375: in ${f.id} ${f.spills.join(", ")} reach past the frame`);
  }
  for (const [id, side] of [["sh-saas", "right"], ["sh-rtl", "left"]]) {
    const button = frame(id).locator("header button[aria-haspopup='dialog']");
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const d = page.locator("dialog[open]");
    await d.waitFor();
    await settle(page);
    const g = await d.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, spill: el.scrollWidth - el.clientWidth, body: (el.querySelector("nav")?.parentElement?.scrollWidth ?? 0) - (el.querySelector("nav")?.parentElement?.clientWidth ?? 0) };
    });
    if (g.left < -1 || g.right > 376 || g.spill > 0 || g.body > 0) fail.push(`375: ${id}'s menu ${JSON.stringify(g)} leaves the viewport or scrolls sideways`);
    if (side === "right" ? Math.abs(g.right - 375) > 1 : Math.abs(g.left) > 1) fail.push(`375: ${id}'s menu is not on the ${side} edge (${JSON.stringify(g)})`);
    await page.keyboard.press("Escape");
    await settle(page);
  }

  // ── 7. Print ──────────────────────────────────────────────────────────────
  await load();
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="sh-"] header')].filter((h) => getComputedStyle(h).display !== "none").length);
  await page.emulateMedia({ media: null });
  if (printed !== 0) fail.push(`print: ${printed} headers would print`);

  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`marketing-siteheader-layout FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `marketing-siteheader-layout OK ${JSON.stringify(summary)}`;
}
