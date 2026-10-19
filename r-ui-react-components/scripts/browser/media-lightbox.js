// @covers   media/Lightbox
// @sections media-lightbox
// @tier     component
// @flags    touch
//
// Browser check: Lightbox with real keys, real touch (CDP), the top layer and real focus.
//
// Run it through `bun run browser:check media-lightbox`.
//
// On the Lightbox section, opened alone (`#media-lightbox`):
//   1. harness: the strip (`[data-sc="lightbox-strip"]`) holds six thumbnails, each a button
//      named by its picture's alt with `aria-haspopup="dialog"`;
//   2. a click on the third opens a modal (`:modal`, the top layer) dialog named "Field trip"
//      on picture 3: the counter and the slide's name say "3 of 12", the stage shows the
//      third file, focus is on Close; the neighbours' files (2 and 4) are preloaded
//      (`<link rel="preload" as="image">`) and the next ones out (1 and 5) are not;
//   3. ArrowRight, ArrowLeft, End, Home move as reading order says; Next is aria-disabled on
//      the last picture and a press on it stays there;
//   4. a CDP touch swipe leftwards goes forward one, rightwards back one, and a mostly
//      vertical swipe does nothing;
//   5. Escape closes it and focus is back on the third thumbnail (after the moves);
//   6. RTL (`[data-sc="lightbox-rtl"]`, translated words): opened on picture 7 its counter is
//      the Arabic "٧ من ١٢"; ArrowLeft goes forward; the previous button sits to the RIGHT of
//      next; a touch swipe rightwards goes forward;
//   7. "View all" opens the controlled viewer on the last picture and Close hands focus back
//      to that button;
//   8. reduced motion: the slide's entrance runs no animation two frames after a move, and
//      two frames after Escape the dialog's exit is over (closed, content unmounted); an
//      animation under 1ms (reduced motion's collapsed duration, no visible motion) is not
//      counted as running;
//   9. at 375 + coarse: the dialog sits inside the viewport with --R-SIZE-2 on each side,
//      scrolls nothing sideways, the picture stays inside its stage, and Close, Previous and
//      Next each answer a press 20px from their centre (their hit areas reach 44px);
//  10. no console or page error.
//
// Suggested break: make the keydown ignore `dir` (6 fails), or drop the focus hand-back
// effect and test in an engine that does not focus a clicked button (5 / 7 fail there).
async (page) => {
  const fail = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async ({ width = 1280, reduced = false, view = {} } = {}) => {
    await openSection(page, "media-lightbox", { width, reduced, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
    await page.locator('[data-sc="lightbox-strip"]').scrollIntoViewIfNeeded();
  };

  /** The open viewer's facts, or null when no dialog is open. */
  const viewer = () =>
    page.evaluate(() => {
      const dialog = [...document.querySelectorAll("#media-lightbox dialog")].find((d) => d.open && !d.inert);
      if (!dialog) return null;
      const figure = dialog.querySelector("figure");
      const picture = figure?.querySelector(".r-media-image-picture, .r-media-image-fallback");
      return {
        name: document.getElementById(dialog.getAttribute("aria-labelledby"))?.textContent ?? null,
        modal: dialog.matches(":modal"),
        counter: dialog.querySelector('[data-lightbox="counter"]')?.textContent ?? null,
        slide: figure?.getAttribute("aria-label") ?? null,
        src: picture?.getAttribute("src") ?? null,
        focus: document.activeElement?.getAttribute("data-lightbox") ?? document.activeElement?.tagName,
        nextDisabled: dialog.querySelector('[data-lightbox="next"]')?.getAttribute("aria-disabled") ?? null,
      };
    });
  /** Two frames: a key's or a touch's slide change is drawn by then. */
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const press = async (key) => {
    await page.keyboard.press(key);
    await frames();
    return (await viewer())?.counter;
  };
  const thumbs = (sel) => page.locator(`${sel} button[aria-haspopup="dialog"]`);

  // ── 1: harness ─────────────────────────────────────────────────────────────
  await load();
  const strip = await page.evaluate(() =>
    [...document.querySelectorAll('[data-sc="lightbox-strip"] button')].map((b) => ({
      popup: b.getAttribute("aria-haspopup"),
      name: b.querySelector("img.r-media-image-picture")?.getAttribute("alt") ?? null,
    })),
  );
  summary.thumbs = strip.length;
  if (strip.length !== 6 || strip.some((t) => t.popup !== "dialog" || !t.name)) fail.push(`harness: the strip is ${JSON.stringify(strip)}`);

  // ── 2: open on the third ───────────────────────────────────────────────────
  await thumbs('[data-sc="lightbox-strip"]').nth(2).click();
  await settle(page);
  const opened = await viewer();
  summary.opened = opened;
  if (!opened) fail.push("open: no dialog after a click on the third thumbnail");
  else {
    if (!opened.modal || opened.name !== "Field trip") fail.push(`open: modal ${opened.modal}, named "${opened.name}"`);
    if (opened.counter !== "3 of 12" || opened.slide !== "3 of 12") fail.push(`open: counter "${opened.counter}", slide "${opened.slide}", expected 3 of 12`);
    if (!/salt/.test(opened.src ?? "")) fail.push(`open: the stage shows ${opened.src}, expected the third file (salt)`);
    if (opened.focus !== "close") fail.push(`open: focus is on ${opened.focus}, expected Close`);
  }
  const preloads = await page.evaluate(() =>
    [...document.head.querySelectorAll('link[rel="preload"][as="image"]')].map((l) => l.getAttribute("href") ?? ""),
  );
  const has = (id) => preloads.some((href) => href.includes(id));
  if (!has("fjord") || !has("pines")) fail.push(`preload: neighbours 2 and 4 not preloaded (${preloads.join(", ")})`);
  if (has("dunes") || has("cliffs")) fail.push(`preload: pictures further away were preloaded (${preloads.join(", ")})`);

  // ── 3: keys ────────────────────────────────────────────────────────────────
  const keys = [];
  keys.push(await press("ArrowRight"));
  keys.push(await press("ArrowLeft"));
  keys.push(await press("ArrowLeft"));
  keys.push(await press("End"));
  const atEnd = await viewer();
  // Forced: Playwright waits for an aria-disabled control to become enabled; the press itself is the test.
  await page.locator('#media-lightbox dialog[open] [data-lightbox="next"]').click({ force: true });
  await frames();
  keys.push((await viewer())?.counter);
  keys.push(await press("Home"));
  summary.keys = keys;
  if (keys.join(" | ") !== "4 of 12 | 3 of 12 | 2 of 12 | 12 of 12 | 12 of 12 | 1 of 12") fail.push(`keys: ${keys.join(" → ")}`);
  if (atEnd?.nextDisabled !== "true") fail.push(`keys: Next on the last picture is aria-disabled=${atEnd?.nextDisabled}`);

  // ── 4: touch swipes (CDP) ──────────────────────────────────────────────────
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
  const swipe = async (dx, dy) => {
    const stage = await page.evaluate(() => {
      const r = document.querySelector("#media-lightbox dialog[open] .r-media-lightbox-stage figure").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
    });
    await touch("touchStart", stage.x, stage.y);
    for (let i = 1; i <= 6; i++) await touch("touchMove", stage.x + (dx * i) / 6, stage.y + (dy * i) / 6);
    await touch("touchEnd");
    await frames();
    return (await viewer())?.counter;
  };
  const swipes = [await swipe(-160, 8), await swipe(160, -8), await swipe(-30, 160)];
  summary.swipes = swipes;
  if (swipes.join(" | ") !== "2 of 12 | 1 of 12 | 1 of 12") fail.push(`swipe: ${swipes.join(" → ")}, expected forward, back, then nothing for a vertical swipe`);

  // ── 5: Escape returns focus to the originating thumbnail ───────────────────
  await page.keyboard.press("Escape");
  await settle(page);
  const afterEscape = await page.evaluate(() => {
    const third = document.querySelectorAll('[data-sc="lightbox-strip"] button')[2];
    return { open: Boolean(document.querySelector("#media-lightbox dialog[open]")), home: document.activeElement === third };
  });
  if (afterEscape.open || !afterEscape.home) fail.push(`escape: dialog open ${afterEscape.open}, focus on the third thumbnail ${afterEscape.home}`);

  // ── 6: RTL ─────────────────────────────────────────────────────────────────
  await page.locator('[data-sc="lightbox-rtl"]').scrollIntoViewIfNeeded();
  await thumbs('[data-sc="lightbox-rtl"]').first().click();
  await settle(page);
  const rtlOpen = await viewer();
  const rtlForward = await press("ArrowLeft");
  const sides = await page.evaluate(() => {
    const dialog = document.querySelector("#media-lightbox dialog[open]");
    const prev = dialog.querySelector('[data-lightbox="prev"]').getBoundingClientRect();
    const next = dialog.querySelector('[data-lightbox="next"]').getBoundingClientRect();
    return { prev: prev.left, next: next.left, dir: getComputedStyle(dialog).direction };
  });
  const rtlSwipe = await swipe(160, 0);
  summary.rtl = { open: rtlOpen?.counter, forward: rtlForward, sides, swipe: rtlSwipe };
  if (rtlOpen?.counter !== "٧ من ١٢") fail.push(`rtl: opened on "${rtlOpen?.counter}", expected picture 7 in Arabic digits`);
  if (rtlForward !== "٨ من ١٢") fail.push(`rtl: ArrowLeft went to "${rtlForward}", expected forward to 8`);
  if (sides.dir !== "rtl" || !(sides.prev > sides.next)) fail.push(`rtl: previous at ${sides.prev}, next at ${sides.next} (${sides.dir}); previous belongs on the right`);
  if (rtlSwipe !== "٩ من ١٢") fail.push(`rtl: a rightward swipe went to "${rtlSwipe}", expected forward to 9`);
  await page.keyboard.press("Escape");
  await settle(page);
  await cdp.detach();

  // ── 7: controlled, from outside ────────────────────────────────────────────
  const viewAll = page.locator('[data-sc="lightbox-view-all"]');
  await viewAll.scrollIntoViewIfNeeded();
  await viewAll.click();
  await settle(page);
  const outside = await viewer();
  await page.locator('#media-lightbox dialog[open] [data-lightbox="close"]').click();
  await settle(page);
  const backOnButton = await page.evaluate(() => document.activeElement === document.querySelector('[data-sc="lightbox-view-all"]'));
  summary.outside = outside?.counter;
  if (outside?.counter !== "12 of 12") fail.push(`outside: opened on "${outside?.counter}", expected 12 of 12`);
  if (!backOnButton) fail.push("outside: Close did not hand focus back to View all");

  // ── 8: reduced motion ──────────────────────────────────────────────────────
  await load({ reduced: true });
  await thumbs('[data-sc="lightbox-strip"]').first().click();
  await settle(page);
  await page.keyboard.press("ArrowRight");
  const reduced = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    // An animation, however short, runs on the frame it starts and is over on the next:
    // two frames on (about 33ms, well inside a full entrance) nothing visible may be running.
    // Under 1ms is reduced motion's collapsed duration (effectively instant, as `afterExit`
    // treats it): its effect can still be pending two frames on, and moves nothing.
    await frame();
    await frame();
    const figure = document.querySelector("#media-lightbox dialog[open] figure");
    const running = figure.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().activeDuration >= 1).length;
    return { running, label: figure.getAttribute("aria-label") };
  });
  await page.keyboard.press("Escape");
  // Closed, its exit already over: no dialog still holds its content (it unmounts once the
  // exit has run) and none is animating. With motion, the exit takes --DURATION-FAST.
  const closedAtOnce = await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    return [...document.querySelectorAll("#media-lightbox dialog")].every(
      (d) => !d.open && !d.querySelector("figure") && d.getAnimations().every((a) => a.playState !== "running" || !(a.effect?.getComputedTiming().activeDuration >= 1)),
    );
  });
  summary.reduced = { ...reduced, closedAtOnce };
  if (reduced.label !== "2 of 12" || reduced.running !== 0) fail.push(`reduced motion: after a move ${JSON.stringify(reduced)}, expected 2 of 12 with nothing running`);
  if (!closedAtOnce) fail.push("reduced motion: the dialog was still open two frames after Escape");

  // ── 9: 375 + coarse ────────────────────────────────────────────────────────
  await load({ width: 375, view: { input: "coarse" } });
  await thumbs('[data-sc="lightbox-strip"]').nth(1).click();
  await settle(page);
  const narrow = await page.evaluate(() => {
    const dialog = document.querySelector("#media-lightbox dialog[open]");
    const d = dialog.getBoundingClientRect();
    const probe = document.createElement("div");
    probe.style.width = "var(--R-SIZE-2)";
    dialog.append(probe);
    const gutter = probe.getBoundingClientRect().width;
    probe.remove();
    const stage = dialog.querySelector(".r-media-lightbox-stage").getBoundingClientRect();
    const box = dialog.querySelector("figure .r-media-image").getBoundingClientRect();
    const hits = ["close", "prev", "next"].map((part) => {
      const el = dialog.querySelector(`[data-lightbox="${part}"]`);
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const inside = (x, y) => {
        const hit = document.elementFromPoint(x, y);
        return Boolean(hit && el.contains(hit));
      };
      return { part, ok: inside(cx, cy - 20) && inside(cx, cy + 20) };
    });
    return {
      left: d.left,
      right: window.innerWidth - d.right,
      gutter,
      sideways: dialog.scrollWidth - dialog.clientWidth,
      pictureInStage: box.left >= stage.left - 0.5 && box.right <= stage.right + 0.5 && box.top >= stage.top - 0.5 && box.bottom <= stage.bottom + 0.5,
      hits,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  summary.narrow = narrow;
  if (Math.abs(narrow.left - narrow.gutter) > 1 || Math.abs(narrow.right - narrow.gutter) > 1) {
    fail.push(`375: the dialog sits ${narrow.left.toFixed(1)} / ${narrow.right.toFixed(1)}px from the edges, expected --R-SIZE-2 (${narrow.gutter}px) each`);
  }
  if (narrow.sideways > 0 || narrow.page > 0) fail.push(`375: the dialog scrolls ${narrow.sideways}px and the page ${narrow.page}px sideways`);
  if (!narrow.pictureInStage) fail.push("375: the picture's box reaches out of its stage");
  for (const h of narrow.hits) if (!h.ok) fail.push(`coarse: ${h.part} does not answer a press 20px from its centre`);
  await page.keyboard.press("Escape");

  stopErrors();
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`media-lightbox FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `media-lightbox OK ${JSON.stringify(summary)}`;
};
