// Browser check: the TreeView keyboard model, tri-state checks, lazy children and links, with real focus.
//
// jsdom moves focus by script and reads no computed direction; here every key is a
// real press, RTL comes from a `dir` attribute, and the lazy loader really waits.
//
// On the Overview's TreeView and TreeView states sections, at 1280, comfortable, fine:
//   1. harness: the file tree shows exactly the rows its default expansion predicts,
//      and one row (the selected TreeView.tsx) is the tab stop;
//      In the accessibility tree the tree owns only its tree items, each named by its label
//      alone (never its actions), and only the tab-stop row's actions are tabbable;
//   2. one tab stop: Tab from the control before the tree lands on that row; Tab
//      again reaches the row's own actions (Rename, Delete), and the next Tab leaves;
//   3. APG keys: Down / Up; Right on an open parent enters it; Left climbs, closes
//      (focus stays on the closed row) and climbs again; End / Home; `*` opens every
//      level-1 sibling and nothing deeper; typeahead ("l", then "p", then "c" wraps
//      to components and a second "c" cycles to Card.tsx);
//   4. a press on an ancestor's chevron closes the branch under focus and focus is
//      on that ancestor, not <body>;
//   5. RTL (the Arabic tree): harness, the chevron sits right of the label; ArrowLeft
//      opens, ArrowLeft enters, ArrowRight climbs, ArrowRight closes;
//   6. tri-state: Billing and People start mixed; checking "Issue refunds" leaves
//      Billing mixed (the disabled payout permission is off); Space on People checks
//      all four People rows, Space again clears them; a checked box is painted in the
//      accent, an unchecked one is not;
//   7. lazy: ArrowRight on Europe marks it busy and shows an indented loading row
//      (never focusable), then the three offices; focus never leaves Europe;
//      Antarctica fails into an error row, Enter on it retries (focus back on
//      Antarctica) and McMurdo arrives; Atlantis loads nothing and becomes a leaf;
//   8. links: the current page (Writing a theme) is marked and its branch open;
//      Enter on Tokens navigates through the demo router (the page URL stays) and
//      Tokens becomes current;
//   9. windowed (2,550 rows): fewer than 200 rows mounted; End focuses the last row
//      (posinset 50 of 50, level 2), scrolled into view, and a mounted row is
//      exactly --ROW-H.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const sc = (name) => `[data-sc="${name}"]`;
  const load = async (anchor) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme: "default",
      density: "comfortable",
      input: "fine",
    });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${anchor}"]`).scrollIntoViewIfNeeded();
  };
  /** The visible rows' labels (an error row reads its message). */
  const names = (tree) =>
    page.evaluate((s) => [...document.querySelectorAll(`${s} [role="treeitem"]`)].map((r) => r.querySelector(".r-navigation-tree-label")?.textContent.trim() ?? ""), tree);
  /** A row by its whole label (a RegExp for a prefix); hasText alone would match "Roles" inside "Assign roles". */
  const exact = (name) => (name instanceof RegExp ? name : new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  const row = (tree, name) => page.locator(`${tree} [role="treeitem"]`).filter({ has: page.locator(".r-navigation-tree-label", { hasText: exact(name) }) });
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      const r = el?.closest('[role="treeitem"]');
      return {
        name: r?.querySelector(".r-navigation-tree-label")?.textContent.trim() ?? null,
        isRow: el?.getAttribute("role") === "treeitem",
        tag: el?.tagName ?? null,
        expanded: r?.getAttribute("aria-expanded") ?? null,
      };
    });
  const expectFocus = async (step, want) => {
    const got = await focused();
    if (got.name !== want || !got.isRow) fail.push(`${step}: focus on ${JSON.stringify(got)}, expected the row "${want}"`);
    return got;
  };
  const attr = (tree, name, a) => row(tree, name).getAttribute(a);

  // ── 1–4: the file tree ──────────────────────────────────────────────────
  await load("navigation-treeview");
  const FILES = sc("tree-files");
  const longName = "a-really-long-file-name-without-any-spaces-that-has-to-break-somewhere-inside-the-row.md";
  const predicted = ["src", "components", "Button.tsx", "Card.tsx", "TreeView.tsx", "hooks", "index.ts", "docs", "README.md", longName, "archive (read-only)", "LICENSE", "package.json"];
  const shown = await names(FILES);
  if (JSON.stringify(shown) !== JSON.stringify(predicted)) fail.push(`harness: the file tree shows ${JSON.stringify(shown)}, expected ${JSON.stringify(predicted)}`);
  const stops = await page.evaluate((s) => [...document.querySelectorAll(`${s} [role="treeitem"][tabindex="0"]`)].map((r) => r.textContent.trim()), FILES);
  if (stops.length !== 1 || !stops[0].startsWith("TreeView.tsx")) fail.push(`one tab stop: ${JSON.stringify(stops)}, expected only the selected TreeView.tsx`);

  // The accessibility tree, as the browser computes it: the tree owns only tree items (groups
  // allowed), each named by its label alone (its actions never join the name), and the only
  // tabbable actions are the tab-stop row's.
  const a11y = await page.locator(FILES).ariaSnapshot();
  const lines = a11y.split("\n");
  const owned = lines.filter((l) => /^ {2}- /.test(l)).map((l) => l.trim().split(/[ :]/)[1]);
  if (!lines[0]?.startsWith("- tree ") || owned.length !== predicted.length || owned.some((role) => role !== "treeitem" && role !== "group")) {
    fail.push(`a11y: the tree owns ${JSON.stringify(owned)}, expected ${predicted.length} tree items`);
  }
  const itemNames = lines.map((l) => /^\s*- treeitem "((?:[^"\\]|\\.)*)"/.exec(l)?.[1]).filter((n) => n !== undefined);
  if (JSON.stringify(itemNames) !== JSON.stringify(predicted)) fail.push(`a11y: tree item names ${JSON.stringify(itemNames)}, expected the labels alone ${JSON.stringify(predicted)}`);
  const tabbableActions = await page.evaluate(
    (s) => [...document.querySelectorAll(`${s} [role="treeitem"] button`)].filter((b) => b.tabIndex >= 0).map((b) => b.getAttribute("aria-label")),
    FILES,
  );
  if (JSON.stringify(tabbableActions) !== JSON.stringify(["Rename TreeView.tsx", "Delete TreeView.tsx"])) {
    fail.push(`a11y: tabbable row actions ${JSON.stringify(tabbableActions)}, expected only the tab-stop row's`);
  }

  await page.evaluate((s) => {
    const tree = document.querySelector(s);
    const before = [...document.querySelectorAll("a[href], button:not(:disabled), input, select, [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !tree.contains(el) && el.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING && el.checkVisibility(),
    );
    before.at(-1)?.focus();
  }, FILES);
  await page.keyboard.press("Tab");
  await expectFocus("Tab into the tree", "TreeView.tsx");
  await page.keyboard.press("Tab");
  const action1 = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.keyboard.press("Tab");
  const action2 = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.keyboard.press("Tab");
  const leftTree = await page.evaluate((s) => !document.querySelector(s).contains(document.activeElement), FILES);
  if (action1 !== "Rename TreeView.tsx" || action2 !== "Delete TreeView.tsx" || !leftTree) {
    fail.push(`Tab after the row: ${JSON.stringify([action1, action2])}, left the tree: ${leftTree}; expected the row's Rename, Delete, then out`);
  }

  await row(FILES, "src").focus();
  await page.keyboard.press("ArrowUp");
  await expectFocus("ArrowUp at the first row", "src");
  await page.keyboard.press("ArrowDown");
  await expectFocus("ArrowDown", "components");
  await page.keyboard.press("ArrowRight");
  await expectFocus("ArrowRight on an open parent", "Button.tsx");
  await page.keyboard.press("ArrowLeft");
  await expectFocus("ArrowLeft on a child", "components");
  await page.keyboard.press("ArrowLeft");
  const closed = await expectFocus("ArrowLeft on an open parent", "components");
  if (closed.expanded !== "false") fail.push(`ArrowLeft left components aria-expanded=${closed.expanded}`);
  if ((await names(FILES)).includes("Button.tsx")) fail.push("ArrowLeft: Button.tsx is still shown under the closed components");
  await page.keyboard.press("ArrowLeft");
  await expectFocus("ArrowLeft on a closed child", "src");
  await page.keyboard.press("End");
  await expectFocus("End", "package.json");
  await page.keyboard.press("Home");
  await expectFocus("Home", "src");
  await page.keyboard.press("ArrowRight");
  await expectFocus("ArrowRight on the open src", "components");
  await page.keyboard.press("ArrowRight");
  const opened = await expectFocus("ArrowRight on a closed parent", "components");
  if (opened.expanded !== "true") fail.push(`ArrowRight did not open components (aria-expanded=${opened.expanded})`);

  // `*`: from docs, every level-1 sibling opens (archive included: disabled still opens); hooks stays closed.
  await row(FILES, "hooks").focus();
  const hooksBefore = await attr(FILES, "hooks", "aria-expanded");
  await row(FILES, "docs").focus();
  await page.keyboard.press("*");
  const star = {
    src: await attr(FILES, "src", "aria-expanded"),
    docs: await attr(FILES, "docs", "aria-expanded"),
    archive: await attr(FILES, "archive (read-only)", "aria-expanded"),
    hooks: await attr(FILES, "hooks", "aria-expanded"),
  };
  if (star.src !== "true" || star.docs !== "true" || star.archive !== "true" || star.hooks !== hooksBefore) fail.push(`*: ${JSON.stringify(star)}, expected src, docs and archive open and hooks unchanged (${hooksBefore})`);
  await expectFocus("* keeps focus", "docs");

  await page.waitForTimeout(600);
  await page.keyboard.press("l");
  await expectFocus('typeahead "l"', "LICENSE");
  await page.waitForTimeout(600);
  await page.keyboard.press("p");
  await expectFocus('typeahead "p"', "package.json");
  await page.waitForTimeout(600);
  await page.keyboard.press("c");
  await expectFocus('typeahead "c" (wraps past the end)', "components");
  await page.keyboard.press("c");
  await expectFocus('typeahead "c" again (cycles to the next c-row)', "Card.tsx");

  // 4: pointer collapse of an ancestor while a descendant has focus.
  await row(FILES, "Card.tsx").focus();
  await expectFocus("harness: Card.tsx focused", "Card.tsx");
  await row(FILES, "src").locator("[data-tree-toggle]").click();
  const afterCollapse = await focused();
  if (afterCollapse.name !== "src" || afterCollapse.expanded !== "false") fail.push(`chevron press on src: focus on ${JSON.stringify(afterCollapse)}, expected the closed src row`);

  // ── 6: tri-state ─────────────────────────────────────────────────────────
  const PERMS = sc("tree-perms");
  const checks = () =>
    page.evaluate((s) => Object.fromEntries([...document.querySelectorAll(`${s} [role="treeitem"]`)].map((r) => [r.querySelector(".r-navigation-tree-label").textContent.trim(), r.getAttribute("aria-checked")])), PERMS);
  const start = await checks();
  if (start.Billing !== "mixed" || start.People !== "mixed" || start.Roles !== "mixed") fail.push(`harness: permissions start ${JSON.stringify(start)}, expected Billing, People and Roles mixed`);
  await row(PERMS, "Issue refunds").click();
  const afterRefunds = await checks();
  if (afterRefunds["Issue refunds"] !== "true" || afterRefunds.Billing !== "mixed") fail.push(`checking refunds: ${JSON.stringify(afterRefunds)}, expected refunds true and Billing still mixed (payouts is disabled)`);
  await row(PERMS, "People").focus();
  await page.keyboard.press("Space");
  const peopleOn = await checks();
  const peopleRows = ["People", "Invite members", "Roles", "Assign roles", "Edit role definitions"];
  if (!peopleRows.every((n) => peopleOn[n] === "true")) fail.push(`Space on People: ${JSON.stringify(peopleOn)}, expected every People row true`);
  const paint = await page.evaluate((s) => {
    const boxes = [...document.querySelectorAll(`${s} [role="treeitem"]`)];
    const bg = (state) => {
      const r = boxes.find((b) => b.getAttribute("aria-checked") === state);
      return r ? getComputedStyle(r.querySelector(".r-navigation-tree-check")).backgroundColor : null;
    };
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--C-ACCENT)";
    document.body.append(probe);
    const accent = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { on: bg("true"), off: bg("false"), accent };
  }, PERMS);
  if (!paint.on || paint.on !== paint.accent || paint.off === paint.accent) fail.push(`box paint: ${JSON.stringify(paint)}, expected a checked box in the accent and an unchecked one not`);
  await page.keyboard.press("Space");
  const peopleOff = await checks();
  if (!peopleRows.every((n) => peopleOff[n] === "false")) fail.push(`Space on People again: ${JSON.stringify(peopleOff)}, expected every People row false`);
  await expectFocus("Space keeps focus", "People");

  // ── 7: lazy children ────────────────────────────────────────────────────
  const LAZY = sc("tree-lazy");
  await row(LAZY, "Europe").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const loadingRow = await page.evaluate((s) => {
    const tree = document.querySelector(s);
    const loading = tree.querySelector("[data-tree-loading]");
    const europe = [...tree.querySelectorAll('[role="treeitem"]')][0];
    const pad = (el) => Number.parseFloat(getComputedStyle(el).paddingInlineStart);
    return loading
      ? {
          text: loading.textContent.trim(),
          focusable: loading.tabIndex >= 0 || loading.getAttribute("role") === "treeitem",
          indent: pad(loading) - pad(europe),
          busy: europe.getAttribute("aria-busy"),
          visible: loading.checkVisibility(),
        }
      : null;
  }, LAZY);
  if (!loadingRow || loadingRow.text !== "Loading…" || loadingRow.focusable || !(loadingRow.indent > 0) || loadingRow.busy !== "true" || !loadingRow.visible) {
    fail.push(`loading row: ${JSON.stringify(loadingRow)}, expected a visible, indented, unfocusable "Loading…" under a busy Europe`);
  }
  await row(LAZY, "Berlin").waitFor({ timeout: 5000 });
  const europeKids = await names(LAZY);
  if (JSON.stringify(europeKids.slice(0, 4)) !== JSON.stringify(["Europe", "Berlin", "Lisbon", "Oslo"])) fail.push(`Europe loaded ${JSON.stringify(europeKids)}`);
  if ((await page.locator(`${LAZY} [data-tree-loading]`).count()) !== 0) fail.push("the loading row stayed after the offices arrived");
  await expectFocus("focus after the load", "Europe");

  await row(LAZY, "Antarctica").focus();
  await page.keyboard.press("ArrowRight");
  await row(LAZY, /^Couldn’t load/).waitFor({ timeout: 5000 });
  await page.keyboard.press("ArrowDown");
  const onError = await focused();
  if (!onError.isRow || !onError.name?.startsWith("Couldn’t load")) fail.push(`ArrowDown from Antarctica: ${JSON.stringify(onError)}, expected its error row`);
  await page.keyboard.press("Enter");
  await expectFocus("Enter on the error row", "Antarctica");
  await row(LAZY, "McMurdo").waitFor({ timeout: 5000 });

  await row(LAZY, "Atlantis (no offices)").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (s) => {
      const r = [...document.querySelectorAll(`${s} [role="treeitem"]`)].find((x) => x.textContent.includes("Atlantis"));
      return r && !r.hasAttribute("aria-expanded") && !document.querySelector(`${s} [data-tree-loading]`);
    },
    LAZY,
    { timeout: 5000 },
  );

  // ── 8: links ─────────────────────────────────────────────────────────────
  const NAV = sc("tree-nav");
  const urlBefore = page.url();
  if ((await attr(NAV, "Writing a theme", "aria-current")) !== "page") fail.push("links: Writing a theme is not marked current");
  if ((await attr(NAV, "Theming", "aria-expanded")) !== "true") fail.push("links: the current page's branch (Theming) did not open on its own");
  await row(NAV, "Tokens").focus();
  await page.keyboard.press("Enter");
  const location = (await page.locator(sc("tree-nav-out")).textContent())?.trim();
  if (!location?.endsWith("/docs/theming/tokens")) fail.push(`Enter on Tokens: ${location}, expected the demo router at /docs/theming/tokens`);
  if ((await attr(NAV, "Tokens", "aria-current")) !== "page") fail.push("Enter on Tokens: it did not become current");
  if (page.url() !== urlBefore) fail.push(`Enter on Tokens left the page: ${page.url()}`);

  // ── 5 + 9: the states section ────────────────────────────────────────────
  await load("navigation-treeviewstates");
  const RTL = sc("tree-rtl");
  const first = row(RTL, "المستندات");
  const sides = await first.evaluate((r) => ({
    chevron: r.querySelector("[data-tree-toggle]").getBoundingClientRect().x,
    label: r.querySelector(".r-navigation-tree-label").getBoundingClientRect().x,
  }));
  if (!(sides.chevron > sides.label)) fail.push(`harness RTL: the chevron (x ${sides.chevron}) is not right of the label (x ${sides.label})`);
  await first.focus();
  await page.keyboard.press("ArrowLeft");
  if ((await first.getAttribute("aria-expanded")) !== "true") fail.push("RTL: ArrowLeft did not open the first folder");
  await page.keyboard.press("ArrowLeft");
  await expectFocus("RTL ArrowLeft on an open parent", "التقرير السنوي.pdf");
  await page.keyboard.press("ArrowRight");
  await expectFocus("RTL ArrowRight on a child", "المستندات");
  await page.keyboard.press("ArrowRight");
  if ((await first.getAttribute("aria-expanded")) !== "false") fail.push("RTL: ArrowRight did not close the folder");

  const MANY = sc("tree-many");
  const mounted = await page.locator(`${MANY} [role="treeitem"]`).count();
  if (!(mounted > 0 && mounted < 200)) fail.push(`windowed: ${mounted} rows mounted of 2,550`);
  await page.locator(`${MANY} [role="treeitem"][tabindex="0"]`).focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(100);
  const last = await page.evaluate((s) => {
    const el = document.activeElement;
    const tree = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const box = tree.getBoundingClientRect();
    return {
      name: el.querySelector(".r-navigation-tree-label")?.textContent.trim(),
      pos: el.getAttribute("aria-posinset"),
      size: el.getAttribute("aria-setsize"),
      level: el.getAttribute("aria-level"),
      inView: r.top >= box.top - 1 && r.bottom <= box.bottom + 1,
      scrolled: tree.scrollTop,
      height: r.height,
      rowH: Number.parseFloat(getComputedStyle(tree).getPropertyValue("--ROW-H")),
    };
  }, MANY);
  if (last.name !== "Report 50.50.pdf" || last.pos !== "50" || last.size !== "50" || last.level !== "2") fail.push(`windowed End: ${JSON.stringify(last)}, expected Report 50.50.pdf at 50 of 50, level 2`);
  if (!last.inView || !(last.scrolled > 0)) fail.push(`windowed End: the last row is not scrolled into view ${JSON.stringify(last)}`);
  if (!(last.rowH > 0) || Math.abs(last.height - last.rowH) > 0.5) fail.push(`windowed row is ${last.height}px, expected --ROW-H ${last.rowH}px`);

  const result = { shown: shown.length, star, loadingRow, location, mounted, last };
  if (fail.length) throw new Error(`tree-keyboard FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `tree-keyboard OK ${JSON.stringify(result)}`;
}
