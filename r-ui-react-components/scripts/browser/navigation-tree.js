// @covers   navigation/TreeView
// @sections navigation-treeview navigation-treeviewstates
// @tier     component
//
// Browser check: TreeView geometry, hit areas, paint, windowing and forced colours.
//
// Run it through `bun run browser:check navigation-tree`.
//
// jsdom has no layout: row heights, the indent, the chevron's hit area, the
// mirrored chevron, whether a long name spills, which rows a windowed tree
// mounts and where a real press leaves focus are only real in a browser. The
// keyboard model, tri-state checks, lazy rows and links are TreeView.test.tsx's.
//
// On the TreeView and TreeView states sections, each opened alone:
//   1. harness (fine, comfortable, 1280): a one-line leaf row is exactly --ROW-H as
//      the tree resolves it;
//   2. each level indents by one --R-SIZE-2: a level-2 row's chevron starts that far
//      from its level-1 parent's, toward the inline end (and toward the left in RTL,
//      where the chevron is drawn right of its label);
//      the chevron of a closed row points to the inline end and an open one down;
//      a checked box is painted in --C-ACCENT and an unchecked one is not; a real
//      press on an ancestor's chevron while a row under it has focus closes the
//      branch and leaves focus on that ancestor (not on <body>);
//   3. compact: the compact tree's rows are its own --ROW-H, shorter than comfortable;
//      windowed (`tree-many`, 2,550 rows): fewer than 200 rows mounted; End focuses the
//      last row (Report 50.50.pdf, 50 of 50, level 2), scrolled into the tree's view,
//      and that row is exactly --ROW-H;
//   4. coarse + 375: every row in the file tree is ≥ 44px tall; the points 20px above
//      and below a chevron's centre hit the chevron, and a real press at the lower one
//      toggles the branch; no page, section or tree scrolls sideways, and the
//      long file name breaks inside its row;
//   5. forced colours: the selected row's fill, a checked box and the current link's
//      bar are the system Highlight; an unchecked box is not.
async (page) => {
  const fail = [];
  const sc = (name) => `[data-sc="${name}"]`;
  const open = async (anchor, { input = "fine", density = "comfortable", width } = {}) => {
    const section = await openSection(page, anchor, { width, view: { theme: "default", density, input } });
    await section.scrollIntoViewIfNeeded();
  };
  /** Each row of `tree`: label, level, height, the chevron's box and the tree's --ROW-H / --R-SIZE-2. */
  const rows = (tree) =>
    page.evaluate(async (s) => {
      const root = document.querySelector(s);
      // A chevron turns on a transition: read it at rest.
      await Promise.all(root.getAnimations({ subtree: true }).map((a) => a.finished));
      const css = getComputedStyle(root);
      return {
        rowH: Number.parseFloat(css.getPropertyValue("--ROW-H")),
        step: (() => {
          const probe = document.createElement("span");
          probe.style.inlineSize = "var(--R-SIZE-2)";
          probe.style.position = "absolute";
          root.append(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        })(),
        rows: [...root.querySelectorAll('[role="treeitem"]')].map((r) => {
          const box = r.getBoundingClientRect();
          const toggle = r.querySelector(".r-navigation-tree-toggle").getBoundingClientRect();
          const chevron = r.querySelector(".r-navigation-tree-chevron");
          return {
            name: r.querySelector(".r-navigation-tree-label").textContent.trim(),
            level: Number(r.getAttribute("aria-level")),
            expanded: r.getAttribute("aria-expanded"),
            height: box.height,
            top: box.top,
            bottom: box.bottom,
            right: box.right,
            labelLeft: r.querySelector(".r-navigation-tree-label").getBoundingClientRect().left,
            labelRight: r.querySelector(".r-navigation-tree-label").getBoundingClientRect().right,
            toggle: { x: toggle.x, y: toggle.y, w: toggle.width, h: toggle.height, right: toggle.right },
            rotate: chevron ? getComputedStyle(chevron).rotate : null,
            scale: chevron ? getComputedStyle(chevron).scale : null,
          };
        }),
      };
    }, tree);

  // ── 1–2 ───────────────────────────────────────────────────────────────────
  await open("navigation-treeview");
  const FILES = sc("tree-files");
  const fine = await rows(FILES);
  if (fine.rows.length < 10) fail.push(`harness: the file tree shows ${fine.rows.length} rows`);
  const leaf = fine.rows.find((r) => r.name === "index.ts");
  if (!(fine.rowH > 0) || !leaf || Math.abs(leaf.height - fine.rowH) > 0.5) fail.push(`harness: index.ts is ${leaf?.height}px, expected --ROW-H ${fine.rowH}px`);
  const src = fine.rows.find((r) => r.name === "src");
  const components = fine.rows.find((r) => r.name === "components");
  const indent = components && src ? components.toggle.x - src.toggle.x : NaN;
  if (!(fine.step > 0) || Math.abs(indent - fine.step) > 0.5) fail.push(`indent: level 2 sits ${indent}px in from level 1, expected --R-SIZE-2 ${fine.step}px`);
  const closedRow = fine.rows.find((r) => r.name === "hooks");
  if (src?.rotate !== "90deg" || !(closedRow?.rotate === "none" || closedRow?.rotate === "0deg")) fail.push(`chevrons: open src rotates ${src?.rotate}, closed hooks ${closedRow?.rotate}`);

  const paint = await page.evaluate(() => {
    const tree = document.querySelector('[data-sc="tree-perms"]');
    const box = (state) => {
      const r = tree.querySelector(`[role="treeitem"][aria-checked="${state}"] .r-navigation-tree-check`);
      return r ? getComputedStyle(r).backgroundColor : null;
    };
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--C-ACCENT)";
    tree.after(probe);
    const accent = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { on: box("true"), off: box("false"), accent };
  });
  if (!paint.on || !paint.off || paint.on !== paint.accent || paint.off === paint.accent) fail.push(`box paint: ${JSON.stringify(paint)}, expected a checked box in the accent and an unchecked one not`);

  // A real press on src's chevron while Card.tsx (under it) has focus.
  const fileRow = (name) => page.locator(`${FILES} [role="treeitem"]`).filter({ has: page.locator(".r-navigation-tree-label", { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) });
  await fileRow("Card.tsx").focus();
  const cardFocused = await page.evaluate(() => document.activeElement?.querySelector(".r-navigation-tree-label")?.textContent.trim() ?? null);
  if (cardFocused !== "Card.tsx") fail.push(`chevron press: harness: focus on ${JSON.stringify(cardFocused)}, expected the row Card.tsx`);
  await fileRow("src").locator("[data-tree-toggle]").click();
  const collapsed = await page.evaluate(() => {
    const el = document.activeElement;
    return { row: el?.getAttribute("role") === "treeitem", name: el?.querySelector(".r-navigation-tree-label")?.textContent.trim() ?? el?.tagName ?? null, expanded: el?.getAttribute("aria-expanded") ?? null };
  });
  if (!collapsed.row || collapsed.name !== "src" || collapsed.expanded !== "false") fail.push(`chevron press on src: focus on ${JSON.stringify(collapsed)}, expected the closed src row`);

  await open("navigation-treeviewstates");
  const rtl = await rows(sc("tree-rtl"));
  await page.locator(`${sc("tree-rtl")} [role="treeitem"]`).first().locator("[data-tree-toggle]").click();
  const rtlOpen = await rows(sc("tree-rtl"));
  const parent = rtlOpen.rows[0];
  const child = rtlOpen.rows[1];
  if (!parent || !child || child.level !== 2 || Math.abs(parent.toggle.right - child.toggle.right - rtl.step) > 0.5) {
    fail.push(`RTL indent: ${JSON.stringify({ parent: parent?.toggle, child: child?.toggle, step: rtl.step })}, expected the child ${rtl.step}px further left`);
  }
  if (rtl.rows[0]?.scale !== "-1 1" || parent?.rotate !== "-90deg") fail.push(`RTL chevron: closed scale ${rtl.rows[0]?.scale}, open rotate ${parent?.rotate}; expected mirrored, and down when open`);
  if (!rtl.rows[0] || !(rtl.rows[0].toggle.x > rtl.rows[0].labelLeft)) fail.push(`RTL chevron: drawn at x ${rtl.rows[0]?.toggle.x}, not right of its label (x ${rtl.rows[0]?.labelLeft})`);

  // ── 3: compact ─────────────────────────────────────────────────────────────
  const compact = await rows(sc("tree-compact"));
  const compactLeaf = compact.rows.find((r) => r.name === "index.ts");
  if (!compactLeaf || Math.abs(compactLeaf.height - compact.rowH) > 0.5 || !(compact.rowH < fine.rowH)) {
    fail.push(`compact: index.ts is ${compactLeaf?.height}px with --ROW-H ${compact.rowH}px, comfortable ${fine.rowH}px`);
  }

  // ── 3: windowed ──────────────────────────────────────────────────────────
  const MANY = sc("tree-many");
  const mounted = await page.locator(`${MANY} [role="treeitem"]`).count();
  if (!(mounted > 0 && mounted < 200)) fail.push(`windowed: ${mounted} rows mounted of 2,550`);
  await page.locator(`${MANY} [role="treeitem"][tabindex="0"]`).focus();
  await page.keyboard.press("End");
  await page
    .waitForFunction(() => document.activeElement?.getAttribute("aria-posinset") === "50" && document.activeElement?.getAttribute("aria-level") === "2", null, { timeout: 2_000 })
    .catch(() => {});
  const last = await page.evaluate((s) => {
    const el = document.activeElement;
    const tree = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const box = tree.getBoundingClientRect();
    return {
      name: el.querySelector(".r-navigation-tree-label")?.textContent.trim() ?? null,
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

  // ── 4: coarse at 375 ───────────────────────────────────────────────────────
  await open("navigation-treeview", { input: "coarse", width: 375 });
  const coarse = await rows(FILES);
  const short = coarse.rows.filter((r) => r.height < 44 - 0.5);
  if (coarse.rows.length === 0 || short.length > 0) fail.push(`coarse rows under 44px: ${JSON.stringify(short.map((r) => [r.name, r.height]))} of ${coarse.rows.length}`);
  const hits = await page.locator(`${FILES} [role="treeitem"]`).filter({ hasText: /^components/ }).first().evaluate((r) => {
    const t = r.querySelector("[data-tree-toggle]").getBoundingClientRect();
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    const own = (x, y) => document.elementFromPoint(x, y)?.closest("[data-tree-toggle]") === r.querySelector("[data-tree-toggle]");
    return { up: own(cx, cy - 20), down: own(cx, cy + 20), cx, cy };
  });
  if (!hits.up || !hits.down) fail.push(`coarse chevron hit area: ${JSON.stringify(hits)}, expected presses 20px above and below to hit it`);
  const before = await page.locator(`${FILES} [role="treeitem"]`).filter({ hasText: /^components/ }).first().getAttribute("aria-expanded");
  await page.mouse.click(hits.cx, hits.cy + 20);
  const after = await page.locator(`${FILES} [role="treeitem"]`).filter({ hasText: /^components/ }).first().getAttribute("aria-expanded");
  if (before === after) fail.push(`a press 20px below the chevron did not toggle components (${before} → ${after})`);

  const spill = await page.evaluate(() => {
    const scroller = document.scrollingElement;
    const sections = ["navigation-treeview"].map((id) => {
      const el = document.getElementById(id);
      return el.scrollWidth - el.clientWidth;
    });
    const trees = [...document.querySelectorAll('[role="tree"], [data-sc^="tree-"]')].map((t) => [t.dataset.sc, t.scrollWidth - t.clientWidth]);
    return { page: scroller.scrollWidth - scroller.clientWidth, sections, trees: trees.filter(([, d]) => d > 0) };
  });
  if (spill.page > 0 || spill.sections.some((d) => d > 0) || spill.trees.length > 0) fail.push(`375: sideways scroll ${JSON.stringify(spill)}`);
  const long = coarse.rows.find((r) => r.name.startsWith("a-really-long"));
  if (!long || long.labelRight > long.right + 0.5 || !(long.height > 44)) fail.push(`375: the long name does not break inside its row ${JSON.stringify(long)}`);

  // ── 5: forced colours ──────────────────────────────────────────────────────
  await open("navigation-treeview");
  await setView(page, { forced: true });
  const forced = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "Highlight";
    probe.style.forcedColorAdjust = "none";
    document.body.append(probe);
    const highlight = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const q = (s) => document.querySelector(s);
    const selected = q('[data-sc="tree-files"] [role="treeitem"][aria-selected="true"]');
    const on = q('[data-sc="tree-perms"] [role="treeitem"][aria-checked="true"] .r-navigation-tree-check');
    const off = q('[data-sc="tree-perms"] [role="treeitem"][aria-checked="false"] .r-navigation-tree-check');
    const current = q('[data-sc="tree-nav"] [role="treeitem"][aria-current="page"]');
    return {
      highlight,
      selected: selected && getComputedStyle(selected).backgroundColor,
      on: on && getComputedStyle(on).backgroundColor,
      off: off && getComputedStyle(off).backgroundColor,
      bar: current && getComputedStyle(current, "::before").backgroundColor,
    };
  });
  await setView(page, { forced: false });
  if (!forced.highlight || forced.selected !== forced.highlight || forced.on !== forced.highlight || forced.bar !== forced.highlight || !forced.off || forced.off === forced.highlight) {
    fail.push(`forced colours: ${JSON.stringify(forced)}, expected the selected fill, a checked box and the current bar Highlight, an unchecked box not`);
  }

  const result = { rowH: fine.rowH, indent, compactH: compact.rowH, coarseRows: coarse.rows.length, hits, spill, forced, paint, collapsed, mounted, last };
  if (fail.length) throw new Error(`navigation-tree FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `navigation-tree OK ${JSON.stringify(result)}`;
}
