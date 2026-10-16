// Browser check: HoverCard, on the Overview's HoverCard section (`[data-testid^="hc-"]`).
//
// Run it through `bun run browser:check hovercard-splitter-card`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print hovercard-splitter-card)"
//
// Asserts, at comfortable + fine unless said otherwise:
//   1. hover: resting the pointer on "@ada" opens nothing for the first 250ms and the card by
//      1.5s, at least 450ms in (the default 500ms delay); it is in the top layer, a group named
//      "@ada" and the trigger's next sibling;
//   2. the bridge: the pointer rests 500ms in the gap between trigger and card (past the 300ms
//      close delay) and the card stays; then it travels into the card and rests
//      there past the 300ms close delay: still open, and a press at the card's centre hits it;
//      the pointer leaving to a far corner closes it within 1.5s;
//   3. Escape from elsewhere: with focus in the Splitter section's textarea, a hover-opened card
//      closes on Escape, focus stays in the textarea and its value is unchanged;
//   4. keyboard: Shift+Tab onto "@ada" opens it after the delay (closed at 250ms) without moving
//      focus; Tab walks into it (Follow), Shift+Tab back to the trigger with the card still open,
//      Escape from inside returns focus to the trigger and closes it, and stays closed past the
//      delay; three Tabs from Follow leave the card behind (closed) and land on the next link;
//   5. navigation: a click on "@ada" changes the hash to its href;
//   6. the toggle: a press opens the table's card (aria-expanded), it survives the pointer
//      leaving, and a press outside closes it;
//   7. density and clip: the compact frame's card is promoted, extends past the clipping frame,
//      takes the press at its centre, and its padding is the frame's compact `--R-SIZE-3`,
//      smaller than the page's;
//   8. at 375: the controlled card keeps its own `--R-SIZE-2` from both edges and the page does
//      not scroll sideways.
async (page) => {
  const base = page.url().split("#")[0];
  const problems = [];
  const summary = {};
  const { errors } = collectErrors(page, { filter: (text) => /hover|HoverCard|popover/i.test(text) });

  const load = async (view, width = 1280) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/overlays-hovercard`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, view]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-testid="hc-text"]').waitFor();
  };
  const demo = (id) => page.locator(`[data-testid="${id}"]`);
  const ada = demo("hc-ada");
  const cardOf = (trigger) =>
    trigger.evaluate((el) => {
      const card = document.querySelector(`[role="group"][aria-labelledby="${el.id}"]`);
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return {
        id: card.id,
        open: card.matches(":popover-open") && !card.inert,
        sibling: el.nextElementSibling === card,
        name: document.getElementById(card.getAttribute("aria-labelledby"))?.textContent.trim(),
        box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
      };
    });
  const isOpen = async (trigger) => (await cardOf(trigger))?.open === true;
  const waitOpen = async (trigger, timeout = 1500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await isOpen(trigger)) return Date.now() - start;
      await page.waitForTimeout(30);
    }
    return null;
  };
  const waitClosed = async (trigger, timeout = 1500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!(await isOpen(trigger))) return true;
      await page.waitForTimeout(30);
    }
    return false;
  };
  const activeIs = (loc) => loc.evaluate((el) => el === document.activeElement);
  const centre = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  try {
    await load({ theme: "default", density: "comfortable", input: "fine" });
    await page.mouse.move(2, 2);

    // 1. Hover opens after the delay.
    await ada.scrollIntoViewIfNeeded();
    const a = await centre(ada);
    const t0 = Date.now();
    await page.mouse.move(a.x, a.y, { steps: 2 });
    await page.waitForTimeout(250);
    if (await isOpen(ada)) problems.push("hover: the card was open 250ms in (the delay is 500ms)");
    const waited = await waitOpen(ada);
    const elapsed = Date.now() - t0;
    if (waited === null) problems.push("hover: the card never opened");
    else if (elapsed < 450) problems.push(`hover: opened after ${elapsed}ms, before the 500ms delay`);
    const card = await cardOf(ada);
    if (card && (!card.sibling || card.name !== "@ada")) problems.push(`hover: the card is ${JSON.stringify({ sibling: card.sibling, name: card.name })}, expected the trigger's next sibling named "@ada"`);
    summary.hover = `${elapsed}ms`;

    // 2. The pointer crosses into the card and stays; leaving closes it.
    if (card) {
      const into = { x: card.box.left + card.box.width / 2, y: card.box.top + Math.min(24, card.box.height / 2) };
      // A slow crossing: the pointer rests in the gap between the trigger and the card for longer
      // than the close delay (300ms), on the way to the card. Only the bridge keeps it open there.
      const t = await page.locator(`[id="${card.id}"]`).evaluate((el) => {
        const r = el.previousElementSibling.getBoundingClientRect();
        return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
      });
      const below = card.box.top >= t.bottom;
      const gapY = below ? (t.bottom + card.box.top) / 2 : (card.box.bottom + t.top) / 2;
      await page.mouse.move((a.x + into.x) / 2, gapY, { steps: 4 });
      await page.waitForTimeout(500);
      if (!(await isOpen(ada))) problems.push("bridge: the card closed while the pointer rested in the gap on its way to it");
      await page.mouse.move(into.x, into.y, { steps: 8 });
      await page.waitForTimeout(600);
      if (!(await isOpen(ada))) problems.push("bridge: the card closed while the pointer travelled into it and rested there");
      const hit = await page.evaluate(([id, x, y]) => document.getElementById(id)?.contains(document.elementFromPoint(x, y)) ?? false, [card.id, card.box.left + card.box.width / 2, card.box.top + card.box.height / 2]);
      if (!hit) problems.push("bridge: a press at the card's centre does not reach the card");
      await page.mouse.move(2, 2, { steps: 4 });
      if (!(await waitClosed(ada))) problems.push("bridge: the card stayed open 1.5s after the pointer left");
    }

    // 3. Escape while focus is elsewhere.
    const field = page.getByRole("textbox", { name: "Markdown source" });
    const before = await field.inputValue();
    await field.evaluate((el) => el.focus({ preventScroll: true }));
    await ada.scrollIntoViewIfNeeded();
    const a2 = await centre(ada);
    await page.mouse.move(a2.x, a2.y, { steps: 2 });
    if ((await waitOpen(ada)) === null) problems.push("escape: the card did not open on hover with focus in the textarea");
    await page.keyboard.press("Escape");
    if (!(await waitClosed(ada, 800))) problems.push("escape: Escape with focus in a textarea left the card open (WCAG 1.4.13)");
    if (!(await activeIs(field))) problems.push("escape: Escape moved focus out of the textarea");
    if ((await field.inputValue()) !== before) problems.push("escape: the textarea's value changed");
    await page.mouse.move(2, 2);
    await waitClosed(ada);

    // 4. Keyboard: Shift+Tab onto the trigger from the next link, wait, walk in and out.
    const repo = demo("hc-text").getByRole("link", { name: "r-ui/r-ui-css" });
    await repo.focus();
    await page.keyboard.press("Shift+Tab");
    if (!(await activeIs(ada))) problems.push("keys: harness: Shift+Tab from the repository link did not land on @ada");
    await page.waitForTimeout(250);
    if (await isOpen(ada)) problems.push("keys: focus opened the card before the delay");
    if ((await waitOpen(ada)) === null) problems.push("keys: keyboard focus never opened the card");
    if (!(await activeIs(ada))) problems.push("keys: opening moved focus off the trigger");
    await page.keyboard.press("Tab");
    const follow = page.getByRole("group", { name: "@ada" }).getByRole("button", { name: "Follow" });
    if (!(await activeIs(follow))) problems.push("keys: Tab from the trigger did not walk into the card (Follow)");
    await page.keyboard.press("Shift+Tab");
    if (!(await activeIs(ada)) || !(await isOpen(ada))) problems.push("keys: Shift+Tab from Follow did not return to the trigger with the card open");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    if (!(await activeIs(ada))) problems.push("keys: Escape inside the card did not hand focus to the trigger");
    if (!(await waitClosed(ada, 800))) problems.push("keys: Escape inside the card left it open");
    await page.waitForTimeout(800);
    if (await isOpen(ada)) problems.push("keys: the focus Escape handed back reopened the card");
    // Out the other side: leave, come back, wait, walk through.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    if ((await waitOpen(ada)) === null) problems.push("keys: the card did not reopen on refocus");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    if (!(await activeIs(repo))) problems.push("keys: three Tabs from the trigger did not pass Follow and Repositories to the repository link");
    if (!(await waitClosed(ada, 800))) problems.push("keys: the card stayed open after focus left it");

    // 5. The trigger still navigates.
    const href = await ada.getAttribute("href");
    await ada.click();
    await page.waitForTimeout(150);
    const hash = await page.evaluate(() => location.hash);
    if (hash !== href) problems.push(`navigate: a click on @ada left the hash at ${hash}, its href is ${href}`);
    await load({ theme: "default", density: "comfortable", input: "fine" });

    // 6. The toggle.
    const table = demo("hc-table");
    const toggle = table.getByRole("button", { name: "Preview @ada" });
    await toggle.scrollIntoViewIfNeeded();
    const tableAda = table.getByRole("link", { name: "@ada" });
    if ((await toggle.getAttribute("aria-expanded")) !== "false") problems.push("toggle: harness: it starts expanded");
    await toggle.click();
    if ((await waitOpen(tableAda, 800)) === null || (await toggle.getAttribute("aria-expanded")) !== "true") problems.push("toggle: a press did not open the card");
    await page.mouse.move(2, 2, { steps: 4 });
    await page.waitForTimeout(700);
    if (!(await isOpen(tableAda))) problems.push("toggle: a pressed-open card closed when the pointer left");
    // Outside: the row's label above the table (plain text, nothing to activate).
    await table.locator("xpath=preceding-sibling::div[1]").click();
    if (!(await waitClosed(tableAda, 800))) problems.push("toggle: a press outside left the card open");

    // 7. Compact, clipped.
    const compact = demo("hc-compact").getByRole("link", { name: "@grace" });
    await compact.scrollIntoViewIfNeeded();
    const c = await centre(compact);
    await page.mouse.move(c.x, c.y, { steps: 2 });
    if ((await waitOpen(compact)) === null) problems.push("compact: the card in the clipping frame did not open");
    const clip = await compact.evaluate((el) => {
      const frame = el.closest('[data-density="compact"]');
      const card = document.querySelector(`[role="group"][aria-labelledby="${el.id}"]`);
      const f = frame.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const probe = (host) => {
        const s = document.createElement("span");
        s.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--R-SIZE-3)";
        host.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      };
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        promoted: card.matches(":popover-open"),
        past: r.bottom > f.bottom + 1 || r.top < f.top - 1,
        hit: card.contains(hit),
        padding: Number.parseFloat(getComputedStyle(card).paddingTop),
        compact: probe(frame),
        page: probe(document.body),
      };
    });
    if (!clip.promoted || !clip.past || !clip.hit) problems.push(`compact: ${JSON.stringify(clip)}: expected promoted, past the clip and hit-testable`);
    if (Math.abs(clip.padding - clip.compact) > 0.5 || !(clip.compact < clip.page)) problems.push(`compact: card padding ${clip.padding}px, the frame's --R-SIZE-3 ${clip.compact}px, the page's ${clip.page}px`);
    await page.mouse.move(2, 2);

    // 8. Narrow.
    await load({ theme: "default", density: "comfortable", input: "coarse" }, 375);
    const controlled = demo("hc-controlled");
    await controlled.getByRole("button", { name: "Open the card" }).click();
    const narrowAda = controlled.getByRole("link", { name: "@ada" });
    await waitOpen(narrowAda, 800);
    const n = await cardOf(narrowAda);
    const fit = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--R-SIZE-2)";
      document.body.appendChild(probe);
      const gap = probe.getBoundingClientRect().width;
      probe.remove();
      return { gap, width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
    });
    if (!n?.open) problems.push("375: the controlled card did not open");
    else if (n.box.left < fit.gap - 1 || n.box.right > fit.width - fit.gap + 1) problems.push(`375: the card spans ${n.box.left}..${n.box.right} in ${fit.width}px, gap ${fit.gap}px`);
    if (fit.scroll > fit.width) problems.push(`375: the page scrolls sideways (${fit.scroll}/${fit.width})`);
    await page.keyboard.press("Escape");

    if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);
  } finally {
    await page.mouse.move(2, 2).catch(() => {});
  }

  if (problems.length) throw new Error(`hovercard-splitter-card:\n- ${problems.join("\n- ")}`);
  return `hovercard-splitter-card OK hover opened at ${summary.hover}; bridge, Escape from a field, keyboard walk, navigation, toggle, compact clip, 375 fit`;
};
