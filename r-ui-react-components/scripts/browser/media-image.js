// @covers   media/Image
// @sections media-image
// @tier     component
// @flags    timing
//
// Browser check: Image's box, blur-up, fallback and motion, which jsdom cannot lay out or paint.
//
// Run it through `bun run browser:check media-image`.
//
// On the Image section, opened alone (`#media-image`), with the demo photographs' responses held
// back by the network (a route that delays every art SVG by DELAY ms):
//   1. harness: the ratios row's first box (the file's own ratio, a 1600 × 1000 file) is
//      exactly 1.6 times as wide as tall and as wide as its grid cell (±1px);
//   2. "Load again" on the slow row: every box goes `pending` (no address yet), the first
//      then `loading` (address set, bytes held back), then all `loaded`; at every stage each box has
//      the same size (±0.5px) and the row below has not moved; no layout shift whose sources
//      lie in the section is reported while it loads (PerformanceObserver);
//   3. blur-up: while loading, the first box shows its tiny preview (decoded, blurred by
//      `filter`, painted) over its colour, with the picture transparent; once loaded the
//      picture fades in (some frame paints it between 0 and 1 opacity) and ends opaque;
//   4. under reduced motion the same load ends opaque with no transition running two
//      frames after `loaded` (the swap is immediate; a full fade would be an eighth in);
//   5. the failed pictures: the first shows the glyph and its alt text inside a box of its
//      own ratio (1200 × 800 → 1.5) named by the alt; the decorative one shows the glyph
//      only, hidden; the long alt stays inside its box;
//   6. forced colours: every box draws a solid outline of --BORDER-WIDTH;
//   7. at 375 (and compact + coarse) the section scrolls nothing sideways and no box spills
//      out of the section;
//   8. no console or page error.
//
// Suggested break: drop the `aspect-ratio` rule from `.r-media-image` (2 fails: the box
// grows when the picture arrives), or remove the opacity transition (3 fails).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const DELAY = 1500;
  const ART = /\/(dunes|fjord|salt|pines|cliffs|lavender|canyon|lake|meadow|glacier|road|terraces)[-.][^/]*svg/;
  // Only the pictures are held: the art's module (`?import`) loads at once. The wait is the
  // page's: run-code's scope has no `setTimeout`, and a handler that throws ends the session.
  const slowArt = async (route) => {
    if (route.request().resourceType() === "image") await page.waitForTimeout(DELAY);
    try {
      await route.continue();
    } catch {
      // The page moved on while the response was held: nothing to deliver.
    }
  };

  const load = async ({ width = 1280, reduced = false, view = {} } = {}) => {
    await openSection(page, "media-image", { width, reduced, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
    await page.locator('[data-sc="image-slow"]').scrollIntoViewIfNeeded();
  };

  const SLOW = '[data-sc="image-slow"] .r-media-image';
  const boxes = () =>
    page.evaluate((sel) => {
      const list = [...document.querySelectorAll(sel)].map((el) => {
        const r = el.getBoundingClientRect();
        return { state: el.dataset.state, w: r.width, h: r.height };
      });
      // Relative to the slow row's own top: sections above may still settle and scroll the page.
      const below = document.querySelector('[data-sc="image-ratios"]').getBoundingClientRect().top - document.querySelector('[data-sc="image-slow"]').getBoundingClientRect().top;
      return { list, below };
    }, SLOW);
  const waitStates = (state) =>
    page.waitForFunction(
      ([sel, s]) => {
        const all = [...document.querySelectorAll(sel)];
        return all.length === 3 && all.every((el) => el.dataset.state === s);
      },
      [SLOW, state],
      { timeout: 15_000 },
    );

  const summary = {};
  await page.route(ART, slowArt);
  try {
    // ── 1: harness ───────────────────────────────────────────────────────────
    await load();
    const harness = await page.evaluate(() => {
      const box = document.querySelector('[data-sc="image-ratios"] .r-media-image');
      const cell = box.parentElement.getBoundingClientRect();
      const r = box.getBoundingClientRect();
      return { w: r.width, h: r.height, cell: cell.width };
    });
    summary.harness = harness;
    if (Math.abs(harness.w / harness.h - 1.6) > 0.01 || Math.abs(harness.w - harness.cell) > 1) {
      fail.push(`harness: the 1600 × 1000 box is ${harness.w.toFixed(1)} × ${harness.h.toFixed(1)} in a ${harness.cell.toFixed(1)}px cell`);
    }

    // ── 2 + 3: Load again, through pending, loading and loaded ───────────────
    await page.evaluate(() => {
      window.__mediaShifts = [];
      const section = document.getElementById("media-image");
      new window.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (entry.sources.some((s) => s.node && section.contains(s.node))) window.__mediaShifts.push(entry.value);
        }
      }).observe({ type: "layout-shift" });
    });
    await page.getByRole("button", { name: "Load again" }).click();
    await waitStates("pending");
    const pending = await boxes();
    if (pending.list.length !== 3) fail.push(`harness: ${pending.list.length} slow boxes, the demo has 3`);
    if (pending.list.some((b) => b.w < 50 || b.h < 30)) fail.push(`pending boxes have no size: ${JSON.stringify(pending.list)}`);

    await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.state === "loading", SLOW, { timeout: 10_000 });
    const loadingBlur = await page.evaluate((sel) => {
      const box = document.querySelector(sel);
      const preview = box.querySelector(".r-media-image-blur");
      const picture = box.querySelector(".r-media-image-picture");
      const fill = box.querySelector(".r-media-image-placeholder");
      return {
        preview: preview ? { decoded: preview.complete && preview.naturalWidth > 0, filter: getComputedStyle(preview).filter, opacity: getComputedStyle(fill).opacity } : null,
        fill: getComputedStyle(fill).backgroundColor,
        picture: picture ? getComputedStyle(picture).opacity : null,
      };
    }, SLOW);
    summary.loading = loadingBlur;
    if (!loadingBlur.preview?.decoded || !/blur\(/.test(loadingBlur.preview.filter) || loadingBlur.preview.opacity !== "1") {
      fail.push(`blur-up: while loading the preview is ${JSON.stringify(loadingBlur.preview)}, expected decoded, blurred and shown`);
    }
    if (loadingBlur.picture !== "0") fail.push(`blur-up: the picture is at opacity ${loadingBlur.picture} before it has loaded`);
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(loadingBlur.fill)) fail.push(`blur-up: no fill colour under the preview (${loadingBlur.fill})`);

    await waitStates("loading").catch(() => {});
    const loading = await boxes();

    // The first frames after `loaded`: the picture's opacity on each.
    const fade = await page.evaluate(async (sel) => {
      const box = document.querySelector(sel);
      const picture = () => box.querySelector(".r-media-image-picture");
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 600 && box.dataset.state !== "loaded"; i++) await frame();
      const seen = [];
      for (let i = 0; i < 90; i++) {
        seen.push(Number(getComputedStyle(picture()).opacity));
        await frame();
      }
      return { state: box.dataset.state, seen };
    }, SLOW);
    summary.fade = { state: fade.state, first: fade.seen.slice(0, 3), last: fade.seen.at(-1) };
    if (fade.state !== "loaded") fail.push("blur-up: the first slow picture never loaded");
    if (!fade.seen.some((o) => o > 0.02 && o < 0.98)) fail.push(`blur-up: no cross-fade, the picture's opacity went ${fade.seen.slice(0, 6).join(", ")}…`);
    if (fade.seen.at(-1) !== 1) fail.push(`blur-up: the picture ends at opacity ${fade.seen.at(-1)}`);

    await waitStates("loaded");
    await page.waitForTimeout(1200);
    const loaded = await boxes();
    for (const [stage, b] of [["loading", loading], ["loaded", loaded]]) {
      b.list.forEach((box, i) => {
        const p = pending.list[i];
        if (!p || Math.abs(box.w - p.w) > 0.5 || Math.abs(box.h - p.h) > 0.5) {
          fail.push(`no shift: slow box ${i + 1} is ${box.w.toFixed(1)} × ${box.h.toFixed(1)} ${stage}, ${p?.w.toFixed(1)} × ${p?.h.toFixed(1)} pending`);
        }
      });
      if (Math.abs(b.below - pending.below) > 0.5) fail.push(`no shift: the row below moved ${(b.below - pending.below).toFixed(1)}px by ${stage}`);
    }
    const shifts = await page.evaluate(() => window.__mediaShifts);
    summary.shifts = shifts;
    if (shifts.length) fail.push(`no shift: ${shifts.length} layout shift(s) inside the section while loading (${shifts.join(", ")})`);
    const placeholderGone = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel).querySelector(".r-media-image-placeholder")).opacity, SLOW);
    if (placeholderGone !== "0") fail.push(`blur-up: the placeholder is at opacity ${placeholderGone} after the picture has faded in`);

    // ── 5: failures keep their words ─────────────────────────────────────────
    const errorsRow = await page.evaluate(() => {
      const [first, decorative, long] = document.querySelectorAll('[data-sc="image-errors"] .r-media-image');
      const read = (box) => {
        const r = box.getBoundingClientRect();
        const fallback = box.querySelector(".r-media-image-fallback");
        const text = fallback?.querySelector("span");
        const t = text?.getBoundingClientRect();
        return {
          state: box.dataset.state,
          ratio: r.width / r.height,
          role: fallback?.getAttribute("role") ?? null,
          name: fallback?.getAttribute("aria-label") ?? null,
          hidden: fallback?.getAttribute("aria-hidden") ?? null,
          text: text?.textContent ?? "",
          glyph: Boolean(fallback?.querySelector("svg")),
          inside: t ? t.left >= r.left - 0.5 && t.right <= r.right + 0.5 && t.top >= r.top - 0.5 && t.bottom <= r.bottom + 0.5 : null,
        };
      };
      return [read(first), read(decorative), read(long)];
    });
    summary.errors = errorsRow.map((e) => e.state);
    const [e1, e2, e3] = errorsRow;
    if (e1.state !== "error" || e1.role !== "img" || e1.name !== "Crew photo from the launch party" || e1.text !== e1.name || !e1.glyph) {
      fail.push(`error: the first failed picture shows ${JSON.stringify(e1)}`);
    }
    if (Math.abs(e1.ratio - 1.5) > 0.01) fail.push(`error: the failed 1200 × 800 box is ${e1.ratio.toFixed(3)}:1`);
    if (e2.state !== "error" || e2.hidden !== "true" || e2.text !== "" || !e2.glyph) fail.push(`error: the decorative failure shows ${JSON.stringify(e2)}`);
    if (e3.state !== "error" || e3.inside !== true) fail.push(`error: the long alt spills out of its box: ${JSON.stringify(e3)}`);

    // ── 6: forced colours ────────────────────────────────────────────────────
    await page.emulateMedia({ forcedColors: "active" });
    const outlines = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.outline = "var(--BORDER-WIDTH) solid";
      document.body.append(probe);
      const width = getComputedStyle(probe).outlineWidth;
      probe.remove();
      const all = [...document.querySelectorAll("#media-image .r-media-image")];
      return {
        count: all.length,
        width,
        bad: all.filter((el) => {
          const s = getComputedStyle(el);
          return s.outlineStyle !== "solid" || s.outlineWidth !== width || /rgba\(0, 0, 0, 0\)/.test(s.outlineColor);
        }).length,
      };
    });
    await page.emulateMedia({ forcedColors: "none" });
    summary.forced = outlines;
    if (outlines.count < 10) fail.push(`forced colours: harness: ${outlines.count} boxes in the section`);
    if (outlines.bad) fail.push(`forced colours: ${outlines.bad} of ${outlines.count} boxes draw no ${outlines.width} outline`);
    await page.unroute(ART, slowArt);

    // ── 4: reduced motion ────────────────────────────────────────────────────
    await load({ reduced: true });
    await page.getByRole("button", { name: "Load again" }).click();
    const still = await page.evaluate(async (sel) => {
      const box = document.querySelector(sel);
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 600 && box.dataset.state !== "pending"; i++) await frame();
      for (let i = 0; i < 900 && box.dataset.state !== "loaded"; i++) await frame();
      // A transition, however short, starts on the frame its style changes and ends on the
      // next: two frames on (about 33ms, an eighth of the full fade) it must be over.
      await frame();
      await frame();
      const picture = box.querySelector(".r-media-image-picture");
      // Under 1ms is reduced motion's collapsed duration: no visible motion, so not counted.
      const running = picture.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().activeDuration >= 1).length;
      return { state: box.dataset.state, opacity: getComputedStyle(picture).opacity, running };
    }, SLOW);
    summary.reduced = still;
    if (still.state !== "loaded" || still.opacity !== "1" || still.running !== 0) {
      fail.push(`reduced motion: two frames after loading the picture is ${JSON.stringify(still)}, expected opaque with nothing running`);
    }

    // ── 7: 375, then compact + coarse ────────────────────────────────────────
    for (const view of [{}, { density: "compact", input: "coarse" }]) {
      await load({ width: 375, view });
      const spill = await page.evaluate(() => {
        const section = document.getElementById("media-image");
        const s = section.getBoundingClientRect();
        const out = [...section.querySelectorAll(".r-media-image")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < s.left - 1 || r.right > s.right + 1;
        }).length;
        return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, out };
      });
      if (spill.page > 0 || spill.out > 0) fail.push(`375 ${JSON.stringify(view)}: page scrolls ${spill.page}px sideways, ${spill.out} boxes spill out of the section`);
    }
  } finally {
    await page.unroute(ART, slowArt).catch(() => {});
  }

  stopErrors();
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`media-image FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `media-image OK ${JSON.stringify(summary)}`;
};
