// @covers   media/MasonryGrid
// @sections media-masonrygrid
// @tier     component
//
// Browser check: MasonryGrid's columns and packing, which jsdom cannot lay out.
//
// Run it through `bun run browser:check media-masonry`.
//
// On the MasonryGrid section, opened alone (`#media-masonrygrid`):
//   1. harness: the gallery (`[data-sc="masonry-gallery"]`) is placed (`data-placed`) with
//      twelve items, its gap is --R-SIZE-3 and its column count is the one its column floor
//      (`--r-media-masonry-floor`, --COLUMN-SM by default) predicts for its width:
//      max(1, floor((width + gap) / (floor + gap)));
//   2. packing, in every placed grid of the section: each item sits in one column track,
//      directly below the previous item of that column (one gap, ±1px) or at the top, no two
//      items overlap, and tops never decrease in source order (±1px), so reading down meets
//      them in source order; the grid is as tall as its tallest column;
//   3. columns follow the CONTAINER: at the same viewport, the resizable demo has fewer
//      columns at Narrow and Half than at Full, each the floor's prediction for its width,
//      and is packed again after each change;
//   4. no shift while pictures load: with the photographs' responses held back, the
//      gallery's item boxes measured before any picture has loaded equal those once all
//      have (±0.5px), and each picture box keeps its file's ratio;
//   5. RTL: the RTL grid's first item sits on its right edge;
//   6. the gallery opens a Lightbox: Tab from the first thumbnail reaches the next in source
//      order; Enter on the fifth opens "5 of 12" and Escape returns focus to it;
//   7. at 375 (and compact + coarse) every grid is placed, matches its prediction, spills
//      nothing past its own box;
//   8. no console or page error (a ResizeObserver loop would be one).
//
// Suggested break: drop `grid-row: 1` from the placed rule (2 fails: items fall into rows),
// or read the column count from the viewport (3 fails).
async (page) => {
  const fail = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page);
  const ART = /\/(dunes|fjord|salt|pines|cliffs|lavender|canyon|lake|meadow|glacier|road|terraces)[-.][^/]*svg/;
  // Only the pictures are held: the art's module (`?import`) loads at once. The wait is the
  // page's: run-code's scope has no `setTimeout`, and a handler that throws ends the session.
  const slowArt = async (route) => {
    if (route.request().resourceType() === "image") await page.waitForTimeout(1500);
    try {
      await route.continue();
    } catch {
      // The page moved on while the response was held.
    }
  };

  const load = async ({ width = 1280, view = {} } = {}) => {
    await openSection(page, "media-masonrygrid", { width, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
    await page.locator('[data-sc="masonry-gallery"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  };

  /** Every grid's layout facts, measured in the page, and the packing faults found in it. */
  const measure = (sel) =>
    page.evaluate((sel) => {
      const px = (value, inside) => {
        const probe = document.createElement("div");
        probe.style.width = value;
        inside.append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      return [...document.querySelectorAll(sel)].map((grid) => {
        const g = grid.getBoundingClientRect();
        const style = getComputedStyle(grid);
        const gap = Number.parseFloat(style.rowGap);
        // The floor as the grid resolves it (the custom property's computed value is the token's length).
        const floor = px(style.getPropertyValue("--r-media-masonry-floor").trim(), grid.parentElement);
        const tracks = style.gridTemplateColumns.split(" ").map(Number.parseFloat);
        const predicted = Math.max(1, Math.floor((g.width + gap) / (floor + gap)));
        const rtl = style.direction === "rtl";
        const items = [...grid.children].map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top - g.top, bottom: r.bottom - g.top, width: r.width };
        });
        const faults = [];
        // Column of each item, from its inline-start edge.
        const pitch = (tracks[0] ?? 0) + gap;
        const column = (it) => Math.round((rtl ? g.right - it.right : it.left - g.left) / pitch);
        const lastInColumn = new Map();
        items.forEach((it, i) => {
          const c = column(it);
          if (Math.abs(it.width - (tracks[0] ?? 0)) > 1) faults.push(`item ${i + 1} is ${it.width.toFixed(1)}px in ${tracks[0]?.toFixed(1)}px tracks`);
          const above = lastInColumn.get(c);
          const expected = above === undefined ? 0 : above.bottom + gap;
          if (Math.abs(it.top - expected) > 1) faults.push(`item ${i + 1} (column ${c + 1}) starts at ${it.top.toFixed(1)}, expected ${expected.toFixed(1)}`);
          lastInColumn.set(c, it);
          if (i > 0 && it.top < items[i - 1].top - 1) faults.push(`item ${i + 1} starts above item ${i}`);
          if (it.left < g.left - 1 || it.right > g.right + 1) faults.push(`item ${i + 1} spills past the grid`);
        });
        for (let a = 0; a < items.length; a++)
          for (let b = a + 1; b < items.length; b++) {
            const p = items[a];
            const q = items[b];
            if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) faults.push(`items ${a + 1} and ${b + 1} overlap`);
          }
        const tallest = Math.max(0, ...items.map((it) => it.bottom));
        if (items.length && Math.abs(tallest - g.height) > 1) faults.push(`grid is ${g.height.toFixed(1)}px for a ${tallest.toFixed(1)}px column`);
        return {
          sc: grid.dataset.sc ?? null,
          placed: grid.hasAttribute("data-placed"),
          columns: Number(grid.dataset.columns),
          tracks: tracks.length,
          predicted,
          gap,
          floor,
          width: g.width,
          count: items.length,
          firstAtStart: items[0] ? (rtl ? Math.abs(items[0].right - g.right) <= 1 : Math.abs(items[0].left - g.left) <= 1) : null,
          faults,
        };
      });
    }, sel);

  const checkGrids = (grids, where) => {
    if (grids.length < 4) fail.push(`${where}: harness: ${grids.length} grids measured, the section has 5`);
    for (const g of grids) {
      const name = `${where} ${g.sc ?? "grid"}`;
      if (!g.placed) fail.push(`${name}: not placed`);
      if (g.columns !== g.tracks || g.tracks !== g.predicted) fail.push(`${name}: ${g.columns} columns placed, ${g.tracks} tracks, ${g.predicted} predicted at ${g.width.toFixed(0)}px`);
      for (const f of g.faults.slice(0, 4)) fail.push(`${name}: ${f}`);
    }
  };

  // ── 1 + 2: harness and packing ──────────────────────────────────────────────
  await load();
  const grids = await measure("#media-masonrygrid .r-media-masonry");
  const gallery = grids.find((g) => g.sc === "masonry-gallery");
  const gapProbe = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.width = "var(--R-SIZE-3)";
    document.querySelector('[data-sc="masonry-gallery"]').parentElement.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  summary.gallery = gallery && { columns: gallery.columns, predicted: gallery.predicted, gap: gallery.gap, width: Math.round(gallery.width) };
  if (!gallery || gallery.count !== 12 || Math.abs(gallery.gap - gapProbe) > 0.1 || gallery.columns < 2) {
    fail.push(`harness: gallery ${JSON.stringify(gallery && { ...gallery, faults: gallery.faults.length })}, expected 12 items, gap ${gapProbe}px, several columns at 1280`);
  }
  checkGrids(grids, "1280");
  const rtl = grids.find((g) => g.sc === "masonry-rtl");
  if (!rtl?.firstAtStart) fail.push("rtl: the first item is not on the grid's right edge");

  // ── 3: columns follow the container ─────────────────────────────────────────
  const resizable = async (label) => {
    if (label) {
      await page.locator("#media-masonrygrid").getByRole("radio", { name: label, exact: true }).check({ force: true });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))));
    }
    return (await measure('[data-sc="masonry-resizable"]'))[0];
  };
  const full = await resizable(null);
  const narrow = await resizable("Narrow");
  const half = await resizable("Half");
  summary.resizable = [full, narrow, half].map((g) => `${Math.round(g.width)}px:${g.columns}`);
  for (const [name, g] of [["full", full], ["narrow", narrow], ["half", half]]) {
    if (g.columns !== g.predicted) fail.push(`container ${name}: ${g.columns} columns at ${g.width.toFixed(0)}px, ${g.predicted} predicted`);
    for (const f of g.faults.slice(0, 3)) fail.push(`container ${name}: ${f}`);
  }
  if (!(narrow.columns < full.columns && half.columns < full.columns)) fail.push(`container: columns ${summary.resizable.join(", ")}: narrowing the grid kept its columns`);

  // ── 6: Tab order and the Lightbox ───────────────────────────────────────────
  const triggers = page.locator('[data-sc="masonry-gallery"] button[aria-haspopup="dialog"]');
  await triggers.first().focus();
  await page.keyboard.press("Tab");
  const second = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-sc="masonry-gallery"] button')];
    return all.indexOf(document.activeElement);
  });
  if (second !== 1) fail.push(`tab order: Tab from the first thumbnail lands on thumbnail ${second + 1}`);
  await triggers.nth(4).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const counter = await page.evaluate(
    () => document.querySelector('#media-masonrygrid dialog[open] [data-lightbox="counter"]')?.textContent ?? null,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const home = await page.evaluate(() => document.activeElement === document.querySelectorAll('[data-sc="masonry-gallery"] button')[4]);
  summary.lightbox = counter;
  if (counter !== "5 of 12" || !home) fail.push(`lightbox: opened on "${counter}", focus back on the fifth thumbnail ${home}`);

  // ── 4: no shift while pictures load ─────────────────────────────────────────
  await page.route(ART, slowArt);
  try {
    await load();
    const boxes = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-sc="masonry-gallery"] > *')].map((el) => {
          // Relative to the grid: the page scrolls between the two measurements.
          const g = el.parentElement.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const img = el.querySelector(".r-media-image");
          const b = img.getBoundingClientRect();
          return {
            x: r.left - g.left,
            y: r.top - g.top,
            w: r.width,
            h: r.height,
            state: img.dataset.state,
            ratio: b.width / b.height,
            file: Number(img.style.getPropertyValue("--r-media-image-w")) / Number(img.style.getPropertyValue("--r-media-image-h")),
          };
        }),
      );
    const before = await boxes();
    await page.evaluate(async () => {
      // Bring every thumbnail near the viewport so the lazy ones load too.
      const grid = document.querySelector('[data-sc="masonry-gallery"]');
      grid.lastElementChild.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 200));
      grid.scrollIntoView({ block: "start" });
    });
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-sc="masonry-gallery"] .r-media-image')].every((el) => el.dataset.state === "loaded"),
      null,
      { timeout: 20_000 },
    );
    const after = await boxes();
    summary.loading = { before: before.filter((b) => b.state !== "loaded").length, of: before.length };
    if (summary.loading.before === 0) fail.push("no shift: harness: every picture had loaded before the first measurement");
    after.forEach((a, i) => {
      const b = before[i];
      if (!b || Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.w - b.w) > 0.5 || Math.abs(a.h - b.h) > 0.5) {
        fail.push(`no shift: item ${i + 1} moved or resized as its picture loaded (${JSON.stringify(b)} → ${JSON.stringify(a)})`);
      }
      if (Math.abs(a.ratio - a.file) > 0.01) fail.push(`no shift: picture ${i + 1} is ${a.ratio.toFixed(3)}:1, its file ${a.file.toFixed(3)}:1`);
    });
  } finally {
    await page.unroute(ART, slowArt).catch(() => {});
  }

  // ── 7: 375, then compact + coarse ───────────────────────────────────────────
  for (const view of [{}, { density: "compact", input: "coarse" }]) {
    await load({ width: 375, view });
    const where = `375 ${JSON.stringify(view)}`;
    checkGrids(await measure("#media-masonrygrid .r-media-masonry"), where);
  }

  stopErrors();
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`media-masonry FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `media-masonry OK ${JSON.stringify(summary)}`;
};
