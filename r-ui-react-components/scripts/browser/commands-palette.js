// @covers   commands/CommandPalette
// @sections commands-commandpalette overlays-contextmenu
// @tier     component
// @cost     15
//
// Browser check: CommandPalette, with real keys, a real <dialog> and real layout.
//
// Run it through `bun run browser:check commands-palette`, or by hand against a running showcase:
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print commands-palette)"
//
// Asserts:
//   1. harness: the palette is closed;
//   2. the showcase's global palette: Ctrl+K on the Dashboard opens it as a modal with
//      focus in its field; typing filters the list to what matches; ArrowDown / ArrowUp
//      move aria-activedescendant; Enter runs the highlighted command (the hash changes),
//      closes the palette and focus is back on what had it; Ctrl+K typed in a text field
//      does nothing;
//   3. nested page: "theme" + Enter opens the Change theme page (its title shown, the
//      four themes listed, the field empty); Backspace in the empty field goes back with
//      "theme" restored; into it again, End + Enter applies the last theme to <html>;
//      the run command is then listed first under Recent;
//   4. the async sections page lists the Overview's sections; "contextmenu" + Enter
//      goes to the ContextMenu section's anchor; Escape closes and returns focus;
//   5. the section's palette written in a compact card: Escape hands focus back to its
//      opener (in place, modal, and rows at the card's --ROW-H, fine and coarse, are
//      sweep-floating's sweep);
//   6. the highlighted row carries a painted accent bar beside its wash; under forced
//      colours its background is the system Highlight (the selection fill survives).
async (page) => {
  const base = page.url().split("#")[0];
  const RECENT = "r-ui-showcase:recent-commands";
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const loadDashboard = async () => {
    await page.goto(`${base}#/dashboard`);
    await page.evaluate(
      ([key, recent, view]) => {
        localStorage.setItem(key, JSON.stringify(view));
        localStorage.removeItem(recent);
      },
      [SHOWCASE_VIEW_KEY, RECENT, { theme: "default", density: "comfortable", input: "fine" }],
    );
    await page.reload();
    await waitForShowcase(page);
    await page.waitForTimeout(200);
  };
  const open = async (input = "fine") => {
    await openSection(page, "commands-commandpalette", { view: { theme: "default", density: "comfortable", input } });
    await page.waitForTimeout(200);
  };
  const GLOBAL = "dialog[data-showcase-palette]";
  const state = (selector = GLOBAL) =>
    page.evaluate((sel) => {
      const dialog = document.querySelector(sel);
      const input = dialog?.querySelector("[role=combobox]");
      const active = input && document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
      return {
        open: !!dialog?.open,
        modal: !!dialog?.matches(":modal"),
        focusInField: !!input && document.activeElement === input,
        value: input?.value ?? null,
        active: active?.textContent ?? null,
        options: dialog ? [...dialog.querySelectorAll("[role=option]")].map((o) => o.textContent) : [],
        chip: dialog?.querySelector(".r-form-adornment .truncate")?.textContent ?? null,
      };
    }, selector);
  const settle = () => page.waitForTimeout(120);

  // ── 1 + 2: the global palette from the Dashboard ────────────────────────
  await loadDashboard();
  const closed = await state();
  if (closed.open) fail.push("harness: the global palette is open before Ctrl+K");
  const view = page.locator(".sc-topbar").getByRole("button", { name: "View", exact: true });
  await view.focus();
  await page.keyboard.press("Control+k");
  await settle();
  const opened = await state();
  if (!opened.open || !opened.modal) fail.push(`Ctrl+K did not open the palette as a modal (${JSON.stringify(opened)})`);
  if (!opened.focusInField) fail.push("the palette opened without focus in its field");
  await page.keyboard.type("go to");
  await settle();
  const typed = await state();
  if (typed.options.length === 0 || typed.options.some((o) => !/go to/i.test(o))) {
    fail.push(`typing "go to" left ${JSON.stringify(typed.options)}, expected only "Go to …" commands`);
  }
  await page.keyboard.press("ArrowDown");
  const second = (await state()).active;
  await page.keyboard.press("ArrowUp");
  const first = (await state()).active;
  if (first !== typed.options[0] || second !== typed.options[1]) {
    fail.push(`arrows moved the highlight to ${JSON.stringify([second, first])}, expected ${JSON.stringify(typed.options.slice(0, 2).reverse())}`);
  }
  // "Go to Marketing": arrow to it, so the run is the arrows' doing.
  const target = typed.options.indexOf("Go to Marketing");
  for (let i = 0; i < target; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await waitForShowcase(page);
  await page.waitForTimeout(300);
  const after = await state();
  const hash = await page.evaluate(() => location.hash);
  const focusBack = await view.evaluate((el) => el === document.activeElement);
  if (target < 0) fail.push(`harness: "Go to Marketing" is not among ${JSON.stringify(typed.options)}`);
  if (hash !== "#/marketing") fail.push(`Enter on "Go to Marketing" left the hash at ${hash}`);
  if (after.open) fail.push("the palette stayed open after running a command");
  if (!focusBack) fail.push("focus did not return to the View button after the palette closed");

  // Ctrl+K inside a text field is the field's.
  await loadDashboard();
  const search = page.getByRole("searchbox", { name: "Search services" });
  await search.focus();
  await page.keyboard.press("Control+k");
  await settle();
  if ((await state()).open) fail.push("Ctrl+K typed in a text field opened the palette");

  // ── 3: nested page, Backspace back, run, Recent ─────────────────────────
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await view.focus();
  await page.keyboard.press("Control+k");
  await settle();
  await page.keyboard.type("theme");
  await settle();
  const onRoot = await state();
  await page.keyboard.press("Enter");
  await settle();
  const nested = await state();
  if (onRoot.active !== "Change theme…") fail.push(`"theme" highlighted ${JSON.stringify(onRoot.active)}, expected "Change theme…"`);
  if (nested.chip !== "Change theme" || nested.value !== "" || nested.options.length !== 4) {
    fail.push(`the Change theme page shows ${JSON.stringify({ chip: nested.chip, value: nested.value, options: nested.options })}`);
  }
  await page.keyboard.press("Backspace");
  await settle();
  const back = await state();
  if (back.chip !== null || back.value !== "theme" || back.active !== "Change theme…") {
    fail.push(`Backspace in the empty field gave ${JSON.stringify({ chip: back.chip, value: back.value, active: back.active })}, expected the root page with "theme" restored`);
  }
  await page.keyboard.press("Enter");
  await settle();
  const lastTheme = (await state()).options.at(-1);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const themeNow = await page.evaluate(() => document.documentElement.dataset.theme ?? "default");
  if (themeNow.toLowerCase() !== (lastTheme ?? "").toLowerCase()) fail.push(`End + Enter on the theme page set "${themeNow}", expected "${lastTheme}"`);
  await page.keyboard.press("Control+k");
  await settle();
  const recent = await page.evaluate((sel) => {
    const group = document.querySelector(`${sel} [role=group]`);
    const label = group && document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent;
    return { label, first: group?.querySelector("[role=option]")?.textContent ?? null };
  }, GLOBAL);
  if (recent.label !== "Recent" || recent.first !== `Change theme › ${lastTheme}`) {
    fail.push(`after running it, the first group is ${JSON.stringify(recent)}, expected Recent listing "Change theme › ${lastTheme}"`);
  }

  // ── 4: async sections page, then Escape ─────────────────────────────────
  await page.keyboard.type("section");
  await settle();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) => document.querySelectorAll(`${sel} [role=option]`).length > 20,
    GLOBAL,
    { timeout: 30_000 },
  );
  await page.keyboard.type("contextmenu");
  await settle();
  const sections = await state();
  await page.keyboard.press("Enter");
  await waitForShowcase(page);
  await page.waitForTimeout(300);
  const sectionHash = await page.evaluate(() => location.hash);
  if (sections.active !== "ContextMenu") fail.push(`"contextmenu" on the sections page highlighted ${JSON.stringify(sections.active)}`);
  if (sectionHash !== "#/overview/overlays-contextmenu") fail.push(`the section command went to ${sectionHash}`);
  await view.focus();
  await page.keyboard.press("Control+k");
  await settle();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if ((await state()).open) fail.push("Escape did not close the palette");
  if (!(await view.evaluate((el) => el === document.activeElement))) fail.push("Escape did not return focus to the View button");

  // ── 5: the section's palette in a compact card hands focus back to its opener ──
  const CARD = '[data-testid="cp-compact-card"]';
  await open("fine");
  const opener = page.locator(`${CARD} [data-testid="cp-open"]`);
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await settle();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  if (!(await opener.evaluate((el) => el === document.activeElement))) fail.push("Escape did not return focus to the compact card's opener");

  // ── 6: the highlight, plain and under forced colours ────────────────────
  await open();
  const highlight = async () => {
    const opener = page.locator('[data-testid="cp-open"]').first();
    await opener.click();
    await settle();
    const read = await page.evaluate(() => {
      const dialog = document.querySelector("dialog[open]");
      const active = dialog.querySelector("[role=option][data-active]");
      const plain = dialog.querySelector("[role=option]:not([data-active]):not([aria-disabled])");
      const bar = getComputedStyle(active, "::before");
      // The system Highlight as this engine resolves it (a probe opted out of forcing).
      const probe = document.createElement("span");
      probe.style.cssText = "forced-color-adjust: none; background-color: Highlight";
      dialog.append(probe);
      const systemHighlight = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        active: getComputedStyle(active).backgroundColor,
        plain: getComputedStyle(plain).backgroundColor,
        systemHighlight,
        bar: { content: bar.content, width: Number.parseFloat(bar.width), bg: bar.backgroundColor },
      };
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    return read;
  };
  const plain = await highlight();
  // The wash is weak on its own; the accent bar is the mark.
  if (plain.bar.content === "none" || !(plain.bar.width > 0) || plain.bar.bg === plain.active || plain.bar.bg === "rgba(0, 0, 0, 0)") {
    fail.push(`the highlighted row's accent bar is not painted (${JSON.stringify(plain.bar)})`);
  }
  await setView(page, { forced: true });
  const forced = await highlight();
  await setView(page, { forced: false });
  // Forced colours repaint the wash as a faint Canvas (its alpha survives, so a bare
  // "differs from a plain row" passes on the wash alone); the highlighted row must be
  // the opaque system Highlight, as a selected row is.
  if (forced.active !== forced.systemHighlight) {
    fail.push(`forced colours: the highlighted row is ${forced.active}, not the system Highlight ${forced.systemHighlight} (plain row ${forced.plain})`);
  }

  stopErrors();
  if (errors.length > 0) fail.push(...errors.slice(0, 5));
  if (fail.length > 0) throw new Error(`commands-palette: ${fail.length} problem(s)\n  ${fail.join("\n  ")}`);
  return `commands-palette: Ctrl+K, filter, arrows, Enter (ran, closed, focus home), nested page + Backspace, Recent, async sections page, Escape; compact card palette hands focus back; forced-colours highlight`;
}
