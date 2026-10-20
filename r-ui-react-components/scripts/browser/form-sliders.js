// @covers   form/Slider, form/RangeSlider, form/Rating
// @sections form-slider form-rangeslider form-rating
// @tier     component
//
// Browser check: Slider, RangeSlider and Rating with a real pointer, real keys and real layout.
//
// jsdom has no layout, no pointer capture and no :focus-visible, so the drag, where the
// thumbs and labels land, the hit areas and the bubble are settled here. It asserts:
//   1. harness: the threshold demo's thumb reads 70 / "70%" (its source value), the
//      control strip is exactly max(--HIT-MIN, 1.25 × --ICON) tall (a probe resolves the
//      expression inside the slider), and the thumb's centre sits at 70% of the rail;
//   2. pointer drag on the threshold: the press moves the value to the pointer, the
//      bubble shows the value while dragging, moves follow (also past the rail's end, so
//      the pointer is captured), and the release commits exactly once (the demo's
//      commit counter); nothing commits mid-drag; a move after the release changes nothing;
//   3. after a key on the threshold the bubble shows its value (keyboard focus); what each
//      key moves to and that each press commits once (none at a bound) are Slider.test.tsx's;
//   4. RTL: ArrowLeft raises the RTL demo's value and moves its thumb left; its fill runs
//      from the rail's right edge to the thumb;
//   5. mark labels: "Warn" is centred on the 50 tick, "0%" starts at the rail's start and
//      "100%" ends at its end;
//   6. vertical: ArrowUp raises the Bass slider and moves its thumb up;
//   7. RangeSlider: dragging the price's low thumb past the high one stops it 5 steps
//      below (590 / 640) and the readout follows; Home on the high thumb leaves it at 640;
//      End on the high thumb and then on the low one ends at 950 / 1000, the low thumb drawn
//      before the high one and each thumb's aria-valuemin/max tracking the other; a press
//      on the coincident pair dragged right moves only the high
//      thumb; in RTL the low thumb sits right of the high one;
//   8. Rating (its half steps by key, End and Delete are Rating.test.tsx's): a press on the
//      review's Overall icon's start quarter picks the half, on its end the whole, again
//      clears (clearable); a hovering mouse previews (fills) without changing the value;
//      posting with no rating focuses it, invalid, with the Field error; RTL ArrowLeft
//      raises; the cards' read-only ratings are images named "4.5 out of 5", "4.8 out of 5",
//      "No rating", none focusable, the half star filled to half its glyph; the filled star
//      paints the rating colour (`--C-RATING-*` blended by the scheme), not the accent, in
//      the default (light) theme and in a dark one, and the two schemes differ;
//   9. density and input: the compact demo's thumb is smaller than the comfortable one;
//      at coarse input and 375px a slider thumb (and a range thumb) answers a press 20px
//      from its centre on both axes and its hit box is at least 44px (a slider's control
//      strip too), the review's Overall rating icons are at least 44 × 44, and no section
//      scrolls sideways;
//  10. forced colours: the fill is the system Highlight, the thumb edge CanvasText, the
//      track keeps a CanvasText edge; a read-only star's fill is CanvasText while an empty
//      star stays an outline (no fill, CanvasText edge); a disabled rating's filled star is
//      GrayText.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (anchor, { input = "fine", width = 1280 } = {}) => {
    const section = await openSection(page, anchor, { width, view: { theme: "default", density: "comfortable", input } });
    await section.scrollIntoViewIfNeeded();
  };
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  /** A thumb's value, value text, centre and size, and its rail's box. */
  const read = (thumb) =>
    thumb.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rail = el.closest(".r-form-slider-rail").getBoundingClientRect();
      return {
        now: Number(el.getAttribute("aria-valuenow")),
        text: el.getAttribute("aria-valuetext"),
        min: Number(el.getAttribute("aria-valuemin")),
        max: Number(el.getAttribute("aria-valuemax")),
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        w: r.width,
        rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom, w: rail.width, h: rail.height },
      };
    });
  const bubbleShown = (thumb) =>
    thumb.evaluate((el) => {
      const anchor = el.querySelector(".r-form-slider-bubble-anchor");
      return anchor ? getComputedStyle(anchor).display !== "none" && anchor.textContent : false;
    });
  const focused = (locator) => locator.evaluate((el) => el === document.activeElement);

  try {
    // ── 1: harness ──────────────────────────────────────────────────────────
    await open("form-slider");
    const threshold = page.locator('[data-sc="slider-threshold"]');
    const tThumb = threshold.getByRole("slider", { name: "CPU alert threshold", exact: true });
    const commits = async () => Number(await threshold.locator('[data-sc="slider-commits"]').innerText());
    const harness = await tThumb.evaluate((el) => {
      const root = el.closest(".r-form-slider");
      const probe = document.createElement("div");
      probe.style.inlineSize = "max(var(--HIT-MIN), calc(var(--ICON) * 1.25))";
      root.append(probe);
      const predicted = probe.getBoundingClientRect().width;
      probe.remove();
      return { predicted, strip: root.querySelector(".r-form-slider-control").getBoundingClientRect().height };
    });
    const t0 = await read(tThumb);
    if (t0.now !== 70 || t0.text !== "70%") fail.push(`harness: threshold reads ${t0.now} / ${t0.text}, source says 70 / 70%`);
    if (!(harness.predicted > 0) || !near(harness.strip, harness.predicted)) fail.push(`harness: control strip ${JSON.stringify(harness)}`);
    if (!near(t0.x, t0.rail.left + t0.rail.w * 0.7)) fail.push(`harness: thumb centre ${t0.x} is not 70% along the rail ${JSON.stringify(t0.rail)}`);

    // ── 2: pointer drag ─────────────────────────────────────────────────────
    const at = (f) => ({ x: t0.rail.left + t0.rail.w * f, y: (t0.rail.top + t0.rail.bottom) / 2 });
    const before = await commits();
    await page.mouse.move(at(0.2).x, at(0.2).y);
    await page.mouse.down();
    const pressed = await read(tThumb);
    const pressBubble = await bubbleShown(tThumb);
    if (pressed.now !== 20) fail.push(`drag: the press read ${pressed.now}, expected 20`);
    if (pressBubble !== "20%") fail.push(`drag: bubble while dragging is ${JSON.stringify(pressBubble)}, expected "20%"`);
    await page.mouse.move(at(0.6).x, at(0.6).y, { steps: 6 });
    const mid = { state: await read(tThumb), commits: await commits() };
    if (mid.state.now !== 60 || mid.commits !== before) fail.push(`drag: mid-drag ${JSON.stringify({ now: mid.state.now, commits: mid.commits, before })}`);
    await page.mouse.move(at(1.3).x, at(1.3).y + 30, { steps: 4 });
    await page.mouse.up();
    const dropped = { state: await read(tThumb), commits: await commits(), readout: await threshold.locator('[data-sc="slider-readout"]').innerText() };
    if (dropped.state.now !== 100) fail.push(`drag: past the end (captured) reads ${dropped.state.now}, expected 100`);
    if (dropped.commits !== before + 1 || !dropped.readout.includes("saved 100%")) fail.push(`drag: release ${JSON.stringify({ ...dropped, before })}`);
    if (!(await focused(tThumb))) fail.push("drag: the press did not leave focus on the thumb");
    await page.mouse.move(at(0.1).x, at(0.1).y, { steps: 3 });
    if ((await read(tThumb)).now !== 100) fail.push("drag: a move after the release changed the value");

    // ── 3: a key shows the bubble ───────────────────────────────────────────
    await page.keyboard.press("ArrowLeft");
    if ((await bubbleShown(tThumb)) !== "95%") fail.push(`keys: bubble after a key is ${JSON.stringify(await bubbleShown(tThumb))}, expected "95%"`);

    // ── 4: RTL ──────────────────────────────────────────────────────────────
    const rtlThumb = page.locator('[data-sc="slider-rtl"] [role="slider"]');
    await rtlThumb.focus();
    const rtl0 = await read(rtlThumb);
    await page.keyboard.press("ArrowLeft");
    const rtl1 = await read(rtlThumb);
    const rtlFill = await rtlThumb.evaluate((el) => {
      const r = el.closest(".r-form-slider").querySelector(".r-form-slider-fill").getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    if (rtl1.now !== rtl0.now + 1 || !(rtl1.x < rtl0.x)) fail.push(`rtl: ArrowLeft ${JSON.stringify({ before: rtl0.now, after: rtl1.now, x0: rtl0.x, x1: rtl1.x })}`);
    if (!near(rtlFill.right, rtl1.rail.right, 2) || !near(rtlFill.left, rtl1.x, 2)) fail.push(`rtl: fill ${JSON.stringify(rtlFill)} should run from the rail's right ${rtl1.rail.right} to the thumb ${rtl1.x}`);

    // ── 5: mark labels ──────────────────────────────────────────────────────
    const marks = await tThumb.evaluate((el) => {
      const root = el.closest(".r-form-slider");
      const rail = root.querySelector(".r-form-slider-rail").getBoundingClientRect();
      const ticks = [...root.querySelectorAll(".r-form-slider-tick")].map((t) => {
        const r = t.getBoundingClientRect();
        return r.x + r.width / 2;
      });
      const labels = Object.fromEntries(
        [...root.querySelectorAll(".r-form-slider-mark-label")].map((l) => {
          const r = l.getBoundingClientRect();
          return [l.textContent, { left: r.left, right: r.right, centre: r.x + r.width / 2 }];
        }),
      );
      return { rail: { left: rail.left, right: rail.right }, ticks, labels };
    });
    if (marks.ticks.length !== 4) fail.push(`marks: ${marks.ticks.length} ticks, expected 4`);
    else {
      if (!near(marks.labels.Warn?.centre, marks.ticks[1])) fail.push(`marks: "Warn" centre ${marks.labels.Warn?.centre} vs tick ${marks.ticks[1]}`);
      if (!near(marks.labels["0%"]?.left, marks.rail.left)) fail.push(`marks: "0%" starts at ${marks.labels["0%"]?.left}, rail at ${marks.rail.left}`);
      if (!near(marks.labels["100%"]?.right, marks.rail.right)) fail.push(`marks: "100%" ends at ${marks.labels["100%"]?.right}, rail at ${marks.rail.right}`);
    }

    // ── 6: vertical ─────────────────────────────────────────────────────────
    const bass = page.locator('[id="form-slider"]').getByRole("slider", { name: "Bass", exact: true });
    await bass.focus();
    const bass0 = await read(bass);
    await page.keyboard.press("ArrowUp");
    const bass1 = await read(bass);
    if (bass1.now !== bass0.now + 1 || !(bass1.y < bass0.y)) fail.push(`vertical: ArrowUp ${JSON.stringify({ before: bass0, after: bass1 })}`);

    // ── 9a: density ─────────────────────────────────────────────────────────
    const compactThumb = page.locator('[id="form-slider"]').getByRole("slider", { name: "Compact", exact: true });
    const compactW = (await read(compactThumb)).w;
    if (!(compactW > 0 && compactW < t0.w)) fail.push(`density: compact thumb ${compactW}px is not smaller than comfortable ${t0.w}px`);

    // ── 7: RangeSlider ──────────────────────────────────────────────────────
    await open("form-rangeslider");
    const price = page.locator('[data-sc="range-price"]');
    const low = price.getByRole("slider", { name: "Minimum", exact: true });
    const high = price.getByRole("slider", { name: "Maximum", exact: true });
    const p0 = { low: await read(low), high: await read(high) };
    if (p0.low.now !== 120 || p0.high.now !== 640) fail.push(`range harness: ${p0.low.now} / ${p0.high.now}, source says 120 / 640`);
    await page.mouse.move(p0.low.x, p0.low.y);
    await page.mouse.down();
    await page.mouse.move(p0.low.rail.right + 40, p0.low.y, { steps: 8 });
    await page.mouse.up();
    const p1 = { low: await read(low), high: await read(high), readout: await price.locator('[data-sc="range-readout"]').innerText() };
    if (p1.low.now !== 590 || p1.high.now !== 640 || !(p1.low.x < p1.high.x)) fail.push(`range drag: ${JSON.stringify({ low: p1.low.now, high: p1.high.now, lx: p1.low.x, hx: p1.high.x })}`);
    if (!p1.readout.includes("590") || !p1.readout.includes("640")) fail.push(`range drag: readout "${p1.readout}"`);
    await high.focus();
    await page.keyboard.press("Home");
    if ((await read(high)).now !== 640) fail.push(`range keys: Home on the high thumb crossed to ${(await read(high)).now}`);
    await page.keyboard.press("End");
    await low.focus();
    await page.keyboard.press("End");
    const p2 = { low: await read(low), high: await read(high) };
    if (p2.low.now !== 950 || p2.high.now !== 1000 || p2.low.max !== 950 || p2.high.min !== 1000 || !(p2.low.x < p2.high.x)) {
      fail.push(`range keys: ${JSON.stringify({ low: [p2.low.now, p2.low.min, p2.low.max], high: [p2.high.now, p2.high.min, p2.high.max] })}`);
    }
    const meet = page.locator('[data-sc="range-meet"]');
    const meetLow = meet.getByRole("slider", { name: "Minimum", exact: true });
    const meetHigh = meet.getByRole("slider", { name: "Maximum", exact: true });
    const m0 = await read(meetHigh);
    await page.mouse.move(m0.x, m0.y);
    await page.mouse.down();
    await page.mouse.move(m0.x + 40, m0.y, { steps: 5 });
    await page.mouse.up();
    const m1 = { low: (await read(meetLow)).now, high: (await read(meetHigh)).now };
    if (m1.low !== 50 || !(m1.high > 50)) fail.push(`range tie: a press on the coincident pair dragged right gave ${JSON.stringify(m1)}`);
    const rtlRange = page.locator('[data-sc="range-rtl"] [role="slider"]');
    const [rtlLow, rtlHigh] = [await read(rtlRange.nth(0)), await read(rtlRange.nth(1))];
    if (!(rtlLow.now < rtlHigh.now && rtlLow.x > rtlHigh.x)) fail.push(`range rtl: low ${rtlLow.now}@${rtlLow.x}, high ${rtlHigh.now}@${rtlHigh.x}`);

    // ── 8: Rating ───────────────────────────────────────────────────────────
    await open("form-rating");
    const review = page.locator('[data-sc="rating-review"]');
    const overall = review.getByRole("slider", { name: "Overall", exact: true });
    const text = () => overall.getAttribute("aria-valuetext");
    const fills = () => overall.evaluate((el) => [...el.querySelectorAll(".r-form-rating-item")].map((i) => i.dataset.fill));
    if ((await text()) !== "No rating") fail.push(`rating harness: Overall starts "${await text()}"`);
    await page.getByRole("button", { name: "Post review" }).click();
    await page
      .waitForFunction(() => document.activeElement?.closest('[data-sc="rating-review"]') && document.activeElement.getAttribute("role") === "slider", null, { timeout: 4000 })
      .catch(() => {});
    const posted = await overall.evaluate((el) => ({
      focused: el === document.activeElement,
      invalid: el.getAttribute("aria-invalid"),
      described: (el.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" | "),
    }));
    if (!posted.focused || posted.invalid !== "true" || !posted.described.includes("Pick a rating before posting.")) fail.push(`rating submit: ${JSON.stringify(posted)}`);
    const fourth = await overall.evaluate((el) => {
      const r = el.querySelectorAll(".r-form-rating-item")[3].querySelector(".r-form-rating-glyph").getBoundingClientRect();
      return { left: r.left, w: r.width, y: r.y + r.height / 2 };
    });
    await page.mouse.click(fourth.left + fourth.w * 0.25, fourth.y);
    const half = await text();
    await page.mouse.click(fourth.left + fourth.w * 0.8, fourth.y);
    const whole = await text();
    await page.mouse.click(fourth.left + fourth.w * 0.8, fourth.y);
    const cleared = await text();
    if (half !== "3.5 out of 5" || whole !== "4 out of 5" || cleared !== "No rating") fail.push(`rating presses: ${JSON.stringify({ half, whole, cleared })}`);
    await page.mouse.move(fourth.left - fourth.w, fourth.y, { steps: 3 });
    const preview = { fills: await fills(), text: await text() };
    if (preview.text !== "No rating" || preview.fills.filter((f) => f !== "empty").length < 2) fail.push(`rating hover preview: ${JSON.stringify(preview)}`);
    await page.mouse.move(0, 0);
    if ((await fills()).some((f) => f !== "empty")) fail.push(`rating hover preview stays after the mouse leaves: ${JSON.stringify(await fills())}`);
    const rtlRating = page.locator('[data-sc="rating-rtl"] [role="slider"]');
    await rtlRating.focus();
    await page.keyboard.press("ArrowLeft");
    if ((await rtlRating.getAttribute("aria-valuetext")) !== "3 من 5") fail.push(`rating rtl: ArrowLeft gave "${await rtlRating.getAttribute("aria-valuetext")}"`);
    const cards = await page.locator('[data-sc="rating-cards"] [role="img"]').evaluateAll((imgs) =>
      imgs.map((img) => {
        const fill = img.querySelectorAll(".r-form-rating-item")[4]?.querySelector(".r-form-rating-fill");
        const glyph = img.querySelectorAll(".r-form-rating-item")[4]?.querySelector(".r-form-rating-glyph");
        return { name: img.getAttribute("aria-label"), tabIndex: img.tabIndex, fill: fill?.getBoundingClientRect().width, glyph: glyph?.getBoundingClientRect().width };
      }),
    );
    if (JSON.stringify(cards.map((c) => c.name)) !== JSON.stringify(["4.5 out of 5", "4.8 out of 5", "No rating"])) fail.push(`rating cards: names ${JSON.stringify(cards.map((c) => c.name))}`);
    if (cards.some((c) => c.tabIndex >= 0)) fail.push("rating cards: a read-only rating is focusable");
    if (!(cards[0]?.glyph > 0) || !near(cards[0].fill, cards[0].glyph / 2)) fail.push(`rating cards: the half star fills ${cards[0]?.fill} of ${cards[0]?.glyph}`);
    // A rating is data: its fill is the domain pair, never the accent.
    const starColour = () =>
      page
        .locator('[data-sc="rating-cards"] [role="img"]')
        .first()
        .evaluate((img) => {
          const probe = (color) => {
            const p = document.createElement("span");
            p.style.color = color;
            img.append(p);
            const value = getComputedStyle(p).color;
            p.remove();
            return value;
          };
          return {
            fill: getComputedStyle(img.querySelector(".r-form-rating-fill > svg")).fill,
            rating: probe("color-mix(in oklch, var(--C-RATING-LIGHT), var(--C-RATING-DARK) calc(var(--SCHEME-DARK) * 100%))"),
            accents: [probe("var(--C-ACCENT)"), probe("var(--C-TEXT-ACCENT)")],
            scheme: getComputedStyle(document.documentElement).getPropertyValue("--SCHEME-DARK").trim(),
          };
        });
    const lightStar = await starColour();
    await setView(page, { theme: await darkTheme(page) });
    const darkStar = await starColour();
    await setView(page, { theme: "default" });
    for (const [label, star, scheme] of [["light", lightStar, "0"], ["dark", darkStar, "1"]]) {
      if (star.scheme !== scheme) fail.push(`rating colour harness: the ${label} theme has --SCHEME-DARK ${star.scheme}`);
      if (star.fill !== star.rating || star.accents.includes(star.fill)) fail.push(`rating colour (${label}): ${JSON.stringify(star)}`);
    }
    if (lightStar.fill === darkStar.fill) fail.push(`rating colour: the light and dark themes paint the same ${lightStar.fill}`);

    // ── 9b: coarse at 375 ───────────────────────────────────────────────────
    const answersAround = (thumb) =>
      thumb.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = el.querySelector(".r-form-slider-thumb-hit");
        const box = getComputedStyle(hit, "::before");
        const owner = (x, y) => document.elementFromPoint(x, y)?.closest('[role="slider"]') === el;
        return {
          answers: [owner(cx + 20, cy), owner(cx - 20, cy), owner(cx, cy + 20), owner(cx, cy - 20)],
          hit: [Number.parseFloat(box.width), Number.parseFloat(box.height)],
          strip: el.closest(".r-form-slider-control").getBoundingClientRect().height,
        };
      });
    const noSpill = async (anchor) => {
      const spill = await page.evaluate((id) => {
        const section = document.getElementById(id);
        const scroller = document.scrollingElement;
        return { page: scroller.scrollWidth - scroller.clientWidth, section: section.scrollWidth - section.clientWidth };
      }, anchor);
      if (spill.page > 0 || spill.section > 0) fail.push(`375 ${anchor}: sideways scroll ${JSON.stringify(spill)}`);
    };
    await open("form-slider", { input: "coarse", width: 375 });
    const coarseHit = await tThumb.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.inlineSize = "var(--HIT-MIN)";
      el.closest(".r-form-slider").append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
    if (Math.round(coarseHit) !== 44) fail.push(`coarse harness: --HIT-MIN resolves to ${coarseHit}px, expected 44`);
    await tThumb.scrollIntoViewIfNeeded();
    const coarseSlider = await answersAround(tThumb);
    if (coarseSlider.answers.includes(false) || coarseSlider.hit.some((n) => !(n >= 44)) || !(coarseSlider.strip >= 44)) fail.push(`coarse slider: ${JSON.stringify(coarseSlider)}`);
    await noSpill("form-slider");
    await open("form-rangeslider", { input: "coarse", width: 375 });
    await low.scrollIntoViewIfNeeded();
    const coarseRange = await answersAround(high);
    if (coarseRange.answers.includes(false) || coarseRange.hit.some((n) => !(n >= 44))) fail.push(`coarse range: ${JSON.stringify(coarseRange)}`);
    await noSpill("form-rangeslider");
    await open("form-rating", { input: "coarse", width: 375 });
    const coarseStars = await overall.evaluate((el) => [...el.querySelectorAll(".r-form-rating-item")].map((i) => [i.getBoundingClientRect().width, i.getBoundingClientRect().height]));
    if (coarseStars.length !== 5 || coarseStars.some(([w, h]) => w < 44 || h < 44)) fail.push(`coarse rating: icon cells ${JSON.stringify(coarseStars)}`);
    await noSpill("form-rating");

    // ── 10: forced colours ──────────────────────────────────────────────────
    await open("form-slider");
    await setView(page, { forced: true });
    const forced = await tThumb.evaluate((el) => {
      const probe = (color) => {
        const p = document.createElement("div");
        p.style.cssText = `forced-color-adjust: none; color: ${color}; background-color: ${color}`;
        document.body.append(p);
        const value = getComputedStyle(p).backgroundColor;
        p.remove();
        return value;
      };
      const root = el.closest(".r-form-slider");
      const track = getComputedStyle(root.querySelector(".r-form-slider-track"));
      return {
        highlight: probe("Highlight"),
        canvasText: probe("CanvasText"),
        fill: getComputedStyle(root.querySelector(".r-form-slider-fill")).backgroundColor,
        thumbEdge: getComputedStyle(el).borderTopColor,
        trackEdge: track.borderTopColor,
        trackWidth: Number.parseFloat(track.borderTopWidth),
      };
    });
    if (forced.fill !== forced.highlight || forced.thumbEdge !== forced.canvasText || forced.trackEdge !== forced.canvasText || !(forced.trackWidth > 0)) {
      fail.push(`forced colours: ${JSON.stringify(forced)}`);
    }
    await open("form-rating");
    await setView(page, { forced: true });
    const forcedStar = await page.locator('[data-sc="rating-cards"] [role="img"]').first().evaluate((img) => {
      const probe = (color) => {
        const p = document.createElement("div");
        p.style.cssText = `forced-color-adjust: none; color: ${color}`;
        document.body.append(p);
        const value = getComputedStyle(p).color;
        p.remove();
        return value;
      };
      // The fill is the rating pair's blend of two CanvasTexts (serialised in oklch), so
      // colours compare as painted pixels, not as strings.
      const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
      const pixel = (color) => {
        if (color === "none") return color;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data.join();
      };
      const base = getComputedStyle(img.querySelectorAll(".r-form-rating-item")[4].querySelector(".r-form-rating-base > svg"));
      return {
        canvasText: pixel(probe("CanvasText")),
        fill: pixel(getComputedStyle(img.querySelector(".r-form-rating-fill > svg")).fill),
        emptyFill: base.fill,
        emptyEdge: pixel(base.stroke),
      };
    });
    if (forcedStar.fill !== forcedStar.canvasText || forcedStar.emptyFill !== "none" || forcedStar.emptyEdge !== forcedStar.canvasText) {
      fail.push(`forced colours: read-only star fill vs outline ${JSON.stringify(forcedStar)}`);
    }
    const forcedDisabled = await page.getByRole("slider", { name: "Locked after 30 days" }).evaluate((el) => {
      const p = document.createElement("div");
      p.style.cssText = "forced-color-adjust: none; color: GrayText";
      document.body.append(p);
      const grayText = getComputedStyle(p).color;
      p.remove();
      return { grayText, fill: getComputedStyle(el.querySelector(".r-form-rating-fill > svg")).fill };
    });
    if (forcedDisabled.fill !== forcedDisabled.grayText) fail.push(`forced colours: disabled star fill ${JSON.stringify(forcedDisabled)}`);
  } finally {
    stopErrors();
  }
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`form-sliders:\n  ${fail.join("\n  ")}`);
  return "form-sliders: drag + commit once, bubble on a key, RTL and vertical keys, marks aligned, range thumbs never cross, rating presses/hover/read-only text, coarse hit ≥ 44px, forced colours";
}
