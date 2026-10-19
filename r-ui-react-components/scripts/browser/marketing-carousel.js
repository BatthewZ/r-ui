// @covers   marketing/Carousel
// @sections marketing-carousel
// @tier     component
// @flags    timing
//
// Browser check: Carousel, on the Marketing page's quotes and on the Carousel section,
// opened alone.
//
//   1. slides per view follow the CAROUSEL's width: three in the page's column at
//      1280, one when only its column is narrowed (same viewport), and one at 375,
//      that slide drawn whole inside the viewport;
//   2. next and previous move by exactly one slide (the measured pitch); the
//      focused track moves by ArrowRight, End and Home (and keeps focus); the next
//      slide peeks in;
//   3. every slide can be scrolled fully into view without the controls;
//   4. no autoplay by default: no rotation control, and nothing moves over two
//      default intervals;
//   5. the opt-in autoplay demo rotates within one interval, pauses under a hovering
//      mouse, and under reduced motion never starts (its control offers to play);
//      4 and 5 run on a faked clock (`withClock`), moved past the intervals;
//   6. dots under a real smooth scroll: two quick ArrowRight presses on the
//      "How it works" dots (the second while the first slide change is still
//      scrolling) land on the THIRD dot and slide, stepping from the target
//      rather than from the half-scrolled position;
//   7. RTL: next moves toward negative scrollLeft by one slide, its slide's right
//      edge lands on the start edge, ArrowLeft goes forward, and next sits to the
//      LEFT of previous;
//   8. the track draws no scrollbar (computed `scrollbar-width: none` on every track,
//      no gutter) while the demo frame, a content scroller, keeps its bar; it is still a
//      native scroller: a sideways wheel, shift + wheel and a CDP touch swipe each move
//      it; previous / next and the status are there, and under forced colours the
//      buttons keep an edge and the status its ink;
//   9. no console error and no uncaught page error.
//
// Run it through `bun run browser:check marketing-carousel`.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  /** The Marketing page (`"marketing"`), or an Overview section by itself. */
  const load = async (target, width) => {
    const view = { theme: "default", density: "comfortable", input: "fine" };
    if (target === "marketing") {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await openPage(page, "marketing", { width, view });
    } else {
      await openSection(page, target, { width, view });
    }
    await page.mouse.move(0, 0);
    await settle(page);
  };

  /** Waits until a scroller's scrollLeft holds still for a few frames; returns it. */
  const settleScroll = (selector, on = page) =>
    on.evaluate(async (selector) => {
      const el = document.querySelector(selector);
      let last = Number.NaN;
      let same = 0;
      for (let i = 0; i < 240 && same < 8; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        same = el.scrollLeft === last ? same + 1 : 0;
        last = el.scrollLeft;
      }
      return last;
    }, selector);

  const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
  /** Waits until `fn` (run in the page) returns true, up to `timeout`; never throws (the assertion after it reads the state). */
  const until = (fn, arg, timeout = 3000) => page.waitForFunction(fn, arg, { timeout }).catch(() => undefined);

  try {
    // 1. Per view by the carousel's own width, on the page.
    const Q = '[data-mkt="quotes"]';
    const TRACK = `${Q} .r-marketing-carousel-track`;
    const status = () => page.locator(`${Q} [role="status"]`).textContent();
    await load("marketing", 1280);
    await page.locator(Q).scrollIntoViewIfNeeded();
    await until((Q) => document.querySelector(`${Q} [role="status"]`)?.textContent === "Slides 1–3 of 5", Q, 1000);
    const wide = await status();
    if (wide !== "Slides 1–3 of 5") fail.push(`carousel: at 1280 the status reads "${wide}", expected three in view`);
    // Narrow only the carousel's own column: per view must follow it, not the viewport.
    await page.locator(Q).evaluate((el) => el.parentElement.style.setProperty("max-inline-size", "var(--COLUMN-LG)"));
    await until((Q) => document.querySelector(`${Q} [role="status"]`)?.textContent === "Slide 1 of 5", Q, 1000);
    const narrowColumn = await status();
    if (narrowColumn !== "Slide 1 of 5") fail.push(`carousel: in a narrowed column at 1280 the status reads "${narrowColumn}"`);
    await page.locator(Q).evaluate((el) => el.parentElement.style.removeProperty("max-inline-size"));
    await until((Q) => document.querySelector(`${Q} [role="status"]`)?.textContent === "Slides 1–3 of 5", Q, 1000);
    // A phone: the page's column is the viewport's, one quote per view, drawn whole inside it.
    await setView(page, { width: 375 });
    await page.locator(Q).scrollIntoViewIfNeeded();
    await until((Q) => document.querySelector(`${Q} [role="status"]`)?.textContent === "Slide 1 of 5", Q, 1000);
    const phone = await page.evaluate((TRACK) => {
      const track = document.querySelector(TRACK);
      const first = track.children[0].getBoundingClientRect();
      const second = track.children[1].getBoundingClientRect();
      return { left: first.left, right: first.right, secondLeft: second.left, width: document.documentElement.clientWidth };
    }, TRACK);
    const phoneStatus = await status();
    if (phoneStatus !== "Slide 1 of 5") fail.push(`carousel: at 375 the status reads "${phoneStatus}", expected one in view`);
    if (phone.left < 0 || phone.right > phone.width || phone.secondLeft < phone.right) fail.push(`carousel: at 375 the first slide is not drawn whole before the next ${JSON.stringify(phone)}`);
    await setView(page, { width: 1280 });
    await page.locator(Q).scrollIntoViewIfNeeded();
    await until((Q) => document.querySelector(`${Q} [role="status"]`)?.textContent === "Slides 1–3 of 5", Q, 1000);

    // 2. Buttons and keys move by one measured pitch; the next slide peeks.
    const geo = await page.evaluate((TRACK) => {
      const t = document.querySelector(TRACK);
      const s = [...t.children].map((el) => el.getBoundingClientRect());
      const tr = t.getBoundingClientRect();
      return { pitch: s[1].left - s[0].left, max: t.scrollWidth - t.clientWidth, peek: tr.right - s[3].left, behavior: getComputedStyle(t).scrollSnapType };
    }, TRACK);
    if (!(geo.pitch > 0) || !(geo.max > geo.pitch)) fail.push(`carousel: harness: pitch ${geo.pitch}, room ${geo.max}`);
    if (!(geo.peek > 4)) fail.push(`carousel: the fourth slide does not peek in (${geo.peek.toFixed(1)}px visible)`);
    if (!geo.behavior.startsWith("x")) fail.push(`carousel: the track does not snap (${geo.behavior})`);
    await page.getByRole("button", { name: "Next slide" }).first().click();
    const afterNext = await settleScroll(TRACK);
    if (!near(afterNext, geo.pitch)) fail.push(`carousel: next scrolled to ${afterNext}, one slide is ${geo.pitch}`);
    if ((await status()) !== "Slides 2–4 of 5") fail.push(`carousel: after next the status reads "${await status()}"`);
    await page.getByRole("button", { name: "Previous slide" }).first().click();
    const afterPrev = await settleScroll(TRACK);
    if (!near(afterPrev, 0)) fail.push(`carousel: previous scrolled to ${afterPrev}, expected 0`);

    await page.locator(TRACK).focus();
    await page.keyboard.press("ArrowRight");
    const keyNext = await settleScroll(TRACK);
    if (!near(keyNext, geo.pitch)) fail.push(`carousel: ArrowRight scrolled to ${keyNext}, one slide is ${geo.pitch}`);
    await page.keyboard.press("End");
    const keyEnd = await settleScroll(TRACK);
    if (!near(keyEnd, geo.max)) fail.push(`carousel: End scrolled to ${keyEnd}, the end is ${geo.max}`);
    await page.keyboard.press("Home");
    const keyHome = await settleScroll(TRACK);
    if (!near(keyHome, 0)) fail.push(`carousel: Home scrolled to ${keyHome}`);
    if (!(await page.locator(TRACK).evaluate((el) => el === document.activeElement))) {
      fail.push("carousel: the track lost focus while driven by keys");
    }

    // 3. Every slide fully into view by scrolling alone.
    const unreachable = await page.evaluate(async (TRACK) => {
      const t = document.querySelector(TRACK);
      const out = [];
      const slides = [...t.children];
      for (const [i, s] of slides.entries()) {
        s.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        for (let f = 0; f < 4; f++) await new Promise((r) => requestAnimationFrame(r));
        const tr = t.getBoundingClientRect();
        const r = s.getBoundingClientRect();
        if (r.left < tr.left - 1 || r.right > tr.right + 1) out.push(i);
      }
      t.scrollLeft = 0;
      return { out, total: slides.length };
    }, TRACK);
    if (unreachable.total !== 5) fail.push(`carousel: harness: ${unreachable.total} slides, the page lists 5 quotes`);
    if (unreachable.out.length) fail.push(`carousel: slides ${unreachable.out.join(", ")} never come fully into view`);

    // 4. No autoplay by default.
    const rotation = await page.locator(`${Q}`).evaluate((el) => ({
      playing: el.getAttribute("data-playing"),
      toggles: [...el.querySelectorAll("button")].filter((b) => /slide show/.test(b.getAttribute("aria-label") ?? "")).length,
    }));
    if (rotation.playing !== null || rotation.toggles !== 0) fail.push(`carousel: rotation is on by default (${JSON.stringify(rotation)})`);

    // 4 + 5 on a faked clock (a context of its own): run past the intervals instead of waiting them out.
    const AUTO = '[data-sc="carousel-autoplay"] section';
    const AUTO_TRACK = `${AUTO} .r-marketing-carousel-track`;
    const timed = await withClock(page, async (cp) => {
      const out = {};
      const view = { theme: "default", density: "comfortable", input: "fine" };
      await openPage(cp, "marketing", { view });
      await cp.locator(Q).scrollIntoViewIfNeeded();
      await cp.mouse.move(0, 0);
      const still0 = await settleScroll(TRACK, cp);
      // Two default intervals (6s each).
      await cp.clock.runFor(12_500);
      out.still = [still0, await settleScroll(TRACK, cp)];

      await openSection(cp, "marketing-carousel", { view });
      await cp.locator(AUTO).scrollIntoViewIfNeeded();
      await cp.mouse.move(0, 0);
      out.playing = await cp.locator(AUTO).getAttribute("data-playing");
      // The demo's interval is 5s.
      await cp.clock.runFor(5_100);
      out.rotated = await settleScroll(AUTO_TRACK, cp);
      await cp.locator(AUTO).hover();
      await cp.waitForFunction((AUTO) => document.querySelector(AUTO)?.getAttribute("data-playing") === "false", AUTO, { timeout: 2000 }).catch(() => undefined);
      out.hovered = await cp.locator(AUTO).getAttribute("data-playing");
      await cp.mouse.move(0, 0);

      await openSection(cp, "marketing-carousel", { view, reduced: true });
      await cp.locator(AUTO).scrollIntoViewIfNeeded();
      await cp.mouse.move(0, 0);
      out.reduced = await cp.locator(AUTO).evaluate((el) => ({
        playing: el.getAttribute("data-playing"),
        play: [...el.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Play slide show"),
      }));
      await cp.clock.runFor(10_500);
      out.reducedScroll = await settleScroll(AUTO_TRACK, cp);
      return out;
    });
    if (timed.still[0] !== timed.still[1]) fail.push(`carousel: moved by itself from ${timed.still[0]} to ${timed.still[1]}`);

    // 5. The opt-in autoplay demo in its section (timed above).
    if (timed.playing !== "true") fail.push("autoplay: the opt-in demo is not rotating");
    if (!(timed.rotated > 1)) fail.push(`autoplay: the opt-in demo did not advance in one interval (scrollLeft ${timed.rotated})`);
    if (timed.hovered !== "false") fail.push("autoplay: a hovering mouse does not pause it");
    if (timed.reduced.playing !== "false" || !timed.reduced.play) {
      fail.push(`autoplay (reduced motion): it starts (${JSON.stringify(timed.reduced)})`);
    }
    if (timed.reducedScroll !== 0) fail.push(`autoplay (reduced motion): it moved to ${timed.reducedScroll}`);

    // 6. Dots step from the target during a smooth scroll.
    await load("marketing-carousel", 1280);
    const steps = page.getByRole("region", { name: "How it works" });
    await steps.scrollIntoViewIfNeeded();
    const tabs = steps.getByRole("tab");
    if ((await tabs.count()) < 3) fail.push(`dots: harness: ${await tabs.count()} dots, expected at least three`);
    await tabs.first().focus();
    const quick = await steps.evaluate(async (region) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const track = region.querySelector(".r-marketing-carousel-track");
      const pitch = track.children[1].getBoundingClientRect().left - track.children[0].getBoundingClientRect().left;
      const press = (key) =>
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      press("ArrowRight");
      // Press again once the smooth scroll is under way, before it arrives.
      for (let i = 0; i < 60 && track.scrollLeft < 1; i++) await frame();
      const mid = track.scrollLeft;
      press("ArrowRight");
      return { pitch, mid, max: track.scrollWidth - track.clientWidth };
    });
    const stepped = await settleScroll(`#marketing-carousel [aria-label="How it works"] .r-marketing-carousel-track, #marketing-carousel section[aria-label="How it works"] .r-marketing-carousel-track`);
    const selected = await tabs.evaluateAll((list) => list.findIndex((t) => t.getAttribute("aria-selected") === "true"));
    const focused = await tabs.evaluateAll((list) => list.indexOf(document.activeElement));
    if (!(quick.mid > 0.5 && quick.mid < quick.pitch - 0.5)) fail.push(`dots: harness: the second press did not come mid-scroll (scrollLeft ${quick.mid}, one slide ${quick.pitch}), so it proves nothing`);
    if (selected !== 2 || focused !== 2) fail.push(`dots: two quick presses selected dot ${selected + 1} with focus on dot ${focused + 1}, expected 3`);
    if (!near(stepped, Math.min(2 * quick.pitch, quick.max))) fail.push(`dots: the track settled at ${stepped}, the third slide is at ${Math.min(2 * quick.pitch, quick.max)}`);

    // 7. RTL.
    const RTL = '[data-sc="carousel-rtl"] section';
    const RTL_TRACK = `${RTL} .r-marketing-carousel-track`;
    await load("marketing-carousel", 1280);
    await page.locator(RTL).scrollIntoViewIfNeeded();
    const rtl0 = await page.evaluate((TRACK) => {
      const t = document.querySelector(TRACK);
      const pad = Number.parseFloat(getComputedStyle(t).scrollPaddingRight);
      const s = [...t.children].map((el) => el.getBoundingClientRect());
      return { dir: getComputedStyle(t).direction, start: t.getBoundingClientRect().right - pad, first: s[0].right, pitch: s[0].right - s[1].right };
    }, RTL_TRACK);
    if (rtl0.dir !== "rtl") fail.push(`rtl: harness: the track's direction is ${rtl0.dir}`);
    if (!near(rtl0.first, rtl0.start)) fail.push(`rtl: the first slide starts at ${rtl0.first}, the start edge is ${rtl0.start}`);
    const [prevBox, nextBox] = await Promise.all(
      ["الشريحة السابقة", "الشريحة التالية"].map((name) => page.locator(RTL).getByRole("button", { name }).boundingBox()),
    );
    if (!(nextBox.x < prevBox.x)) fail.push("rtl: next does not sit to the left of previous");
    await page.locator(RTL).getByRole("button", { name: "الشريحة التالية" }).click();
    const rtlNext = await settleScroll(RTL_TRACK);
    if (!near(rtlNext, -rtl0.pitch)) fail.push(`rtl: next scrolled to ${rtlNext}, one slide forward is ${-rtl0.pitch}`);
    const landed = await page.evaluate((TRACK) => {
      const t = document.querySelector(TRACK);
      return t.children[1].getBoundingClientRect().right - (t.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(t).scrollPaddingRight));
    }, RTL_TRACK);
    if (!near(landed, 0)) fail.push(`rtl: after next the second slide is ${landed}px off the start edge`);
    await page.locator(RTL_TRACK).focus();
    await page.keyboard.press("ArrowLeft");
    const rtlKey = await settleScroll(RTL_TRACK);
    if (!near(rtlKey, -2 * rtl0.pitch)) fail.push(`rtl: ArrowLeft scrolled to ${rtlKey}, two slides forward is ${-2 * rtl0.pitch}`);
    await page.keyboard.press("ArrowRight");
    const rtlBack = await settleScroll(RTL_TRACK);
    if (!near(rtlBack, -rtl0.pitch)) fail.push(`rtl: ArrowRight scrolled to ${rtlBack}, expected back to ${-rtl0.pitch}`);

    // 8. The track draws no scrollbar and stays a native scroller.
    const CARDS = '[data-sc="carousel-cards"] section';
    const CARDS_TRACK = `${CARDS} .r-marketing-carousel-track`;
    await load("marketing-carousel", 1280);
    await page.locator(CARDS).scrollIntoViewIfNeeded();
    const bar = await page.evaluate((TRACK) => {
      const t = document.querySelector(TRACK);
      const s = getComputedStyle(t);
      const frame = t.closest(".sc-demo");
      const fs = frame ? getComputedStyle(frame) : null;
      return {
        tracks: [...document.querySelectorAll("#marketing-carousel .r-marketing-carousel-track")].map((el) => getComputedStyle(el).scrollbarWidth),
        overflow: s.overflowX,
        gutter: t.offsetHeight - Number.parseFloat(s.borderTopWidth) - Number.parseFloat(s.borderBottomWidth) - t.clientHeight,
        frame: fs ? { overflow: fs.overflowX, scrollbar: fs.scrollbarWidth } : null,
        room: t.scrollWidth - t.clientWidth,
      };
    }, CARDS_TRACK);
    // Headless Chromium hides every scrollbar, so the gutter alone cannot fail: the computed
    // `scrollbar-width` is the claim, and a content scroller (the demo frame) keeps its own.
    if (bar.tracks.length !== 4) fail.push(`scrollbar: harness: ${bar.tracks.length} carousel tracks, the demo writes 4`);
    if (bar.tracks.some((w) => w !== "none")) fail.push(`scrollbar: a carousel track keeps its bar (${bar.tracks.join(", ")})`);
    if (bar.overflow !== "auto" || !(bar.room > 0)) fail.push(`scrollbar: the track is not a scroller with room (${bar.overflow}, ${bar.room}px)`);
    if (bar.gutter !== 0) fail.push(`scrollbar: the track reserves ${bar.gutter}px for a bar`);
    if (!bar.frame || bar.frame.overflow !== "auto" || bar.frame.scrollbar === "none") fail.push(`scrollbar: positive control: the demo frame ${JSON.stringify(bar.frame)} must stay a scroller with its bar`);

    const trackBox = await page.locator(CARDS_TRACK).boundingBox();
    const cx = trackBox.x + trackBox.width / 2;
    const cy = trackBox.y + trackBox.height / 2;
    const reset = () => page.locator(CARDS_TRACK).evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(300, 0);
    const byWheel = await settleScroll(CARDS_TRACK);
    if (!(byWheel > 0)) fail.push(`scrollbar: a sideways wheel did not move the track (${byWheel})`);
    await reset();
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 300);
    await page.keyboard.up("Shift");
    const byShiftWheel = await settleScroll(CARDS_TRACK);
    if (!(byShiftWheel > 0)) fail.push(`scrollbar: shift + wheel did not move the track (${byShiftWheel})`);
    await reset();
    // A swipe needs a touch-capable context (this session's page has none, so its touch
    // events never scroll): a second one, touch enabled, real touch events through CDP.
    const touchContext = await page.context().browser().newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
    let bySwipe = null;
    try {
      const tp = await touchContext.newPage();
      await tp.goto(page.url());
      await waitForShowcase(tp);
      await tp.locator(CARDS_TRACK).scrollIntoViewIfNeeded();
      const tb = await tp.locator(CARDS_TRACK).boundingBox();
      const tcdp = await touchContext.newCDPSession(tp);
      const touch = (type, x, y) =>
        tcdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
      const ty = tb.y + tb.height / 2;
      await touch("touchStart", tb.x + tb.width * 0.8, ty);
      for (let i = 1; i <= 15; i++) {
        await touch("touchMove", tb.x + tb.width * 0.8 - i * 25, ty);
        await tp.waitForTimeout(16);
      }
      await touch("touchEnd");
      bySwipe = await settleScroll(CARDS_TRACK, tp);
    } finally {
      await touchContext.close();
    }
    if (!(bySwipe > 0)) fail.push(`scrollbar: a touch swipe did not move the track (${bySwipe})`);
    await page.mouse.move(0, 0);
    const affordances = await page.locator(CARDS).evaluate((el) => ({
      prev: [...el.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Previous slide"),
      next: [...el.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Next slide"),
      status: el.querySelector('[role="status"]')?.textContent ?? "",
    }));
    if (!affordances.prev || !affordances.next || !/^Slides? \d/.test(affordances.status)) fail.push(`scrollbar: affordances missing ${JSON.stringify(affordances)}`);

    // Forced colours: the prev / next buttons still draw an edge, and the status its text.
    await page.emulateMedia({ forcedColors: "active" });
    const forced = await page.locator(CARDS).evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.cssText = "color: CanvasText; background: Canvas; forced-color-adjust: none";
      document.body.append(probe);
      const ps = getComputedStyle(probe);
      const system = { ink: ps.color, canvas: ps.backgroundColor };
      probe.remove();
      const buttons = [...el.querySelectorAll("button")].filter((b) => /slide$/.test(b.getAttribute("aria-label") ?? ""));
      return {
        system,
        buttons: buttons.map((b) => {
          const s = getComputedStyle(b);
          return { style: s.borderTopStyle, width: Number.parseFloat(s.borderTopWidth), colour: s.borderTopColor, shown: b.getClientRects().length > 0 };
        }),
        status: getComputedStyle(el.querySelector('[role="status"]')).color,
      };
    });
    await page.emulateMedia({ forcedColors: "none" });
    if (forced.buttons.length !== 2) fail.push(`forced colours: harness: ${forced.buttons.length} prev/next buttons`);
    for (const b of forced.buttons) {
      if (!b.shown || b.style === "none" || !(b.width > 0) || b.colour === forced.system.canvas) fail.push(`forced colours: a prev/next edge is lost ${JSON.stringify(b)}`);
    }
    if (forced.status === forced.system.canvas) fail.push("forced colours: the status text is painted in Canvas");
  } finally {
    stopErrors();
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-carousel FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return "marketing-carousel OK (per view by container, one at 375, one-slide steps, keys, 5 slides reachable, no default autoplay, opt-in autoplay paused by hover and reduced motion, RTL, no scrollbar yet wheel / shift-wheel / swipe scroll)";
}
