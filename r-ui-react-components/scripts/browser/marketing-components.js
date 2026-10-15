// Browser check: MediaCard and Carousel, in the Marketing page and the Overview.
//
//   MediaCard (the Marketing page's journal grid):
//   1. harness: the grid holds the four posts the page's content lists;
//   2. Tab from the essay's last link visits card 1's link, then card 1's save
//      button, then card 2's link: one stop for the card, one for its action;
//   3. the focused link draws no ring of its own; its stretched box draws one
//      --FOCUS-WIDTH ring;
//   4. the whole card is the link's target: the media, the badge, the title, the
//      description and the meta all hit-test to the link, and a real click on the
//      description follows it; the save button takes its own press (it toggles and
//      the page stays put);
//   5. the image is lazy with its intrinsic width and height, in a 16:9 box;
//   6. hover lifts the card by --MOTION-DISTANCE-SM and firms its edge; under
//      reduced motion the edge still firms and the card does not move;
//   Carousel:
//   7. slides per view follow the CAROUSEL's width: three in the page's column at
//      1280, one when only its column is narrowed (same viewport), one at 375;
//   8. next and previous move by exactly one slide (the measured pitch); the
//      focused track moves by ArrowRight, End and Home (and keeps focus); the next
//      slide peeks in;
//   9. every slide can be scrolled fully into view without the controls;
//  10. no autoplay by default: no rotation control, and nothing moves for longer
//      than the default interval;
//  11. the opt-in autoplay demo rotates, pauses under a hovering mouse, and under
//      reduced motion never starts (its control offers to play);
//  12. RTL: next moves toward negative scrollLeft by one slide, its slide's right
//      edge lands on the start edge, ArrowLeft goes forward, and next sits to the
//      LEFT of previous;
//  12b. dots under a real smooth scroll: two quick ArrowRight presses on the
//      "How it works" dots (the second while the first slide change is still
//      scrolling) land on the THIRD dot and slide, stepping from the target
//      rather than from the half-scrolled position;
//  13. at 375 the Overview's marketing sections and the page scroll nothing sideways;
//  14. no console error and no uncaught page error.
//
// Run it through `bun run browser:check marketing`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (hash, width, { reduced = false, view = {} } = {}) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/${hash}`);
    await page.evaluate(
      (v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)),
      { theme: "default", density: "comfortable", input: "fine", ...view },
    );
    await page.reload();
    await waitForShowcase(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
  };

  /** Waits until a scroller's scrollLeft holds still for a few frames; returns it. */
  const settle = (selector) =>
    page.evaluate(async (selector) => {
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
  const notes = [];

  try {
    // ── MediaCard ──────────────────────────────────────────────────────────────
    await load("marketing", 1280);
    const POSTS = '[data-mkt="posts"]';
    await page.locator(`${POSTS} article`).first().scrollIntoViewIfNeeded();
    const cards = await page.locator(`${POSTS} article.r-marketing-media-card`).count();
    if (cards !== 4) fail.push(`media: harness: ${cards} cards in the journal grid, the page lists 4 posts`);

    // 2: tab stops.
    await page.locator('#journal a[href$="faq"]').focus();
    const stops = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      stops.push(
        await page.evaluate((POSTS) => {
          const a = document.activeElement;
          const cards = [...document.querySelectorAll(`${POSTS} article`)];
          const card = cards.indexOf(a.closest("article"));
          const kind = a.tagName === "A" ? "link" : a.tagName === "BUTTON" ? "button" : a.tagName;
          return `${card}:${kind}`;
        }, POSTS),
      );
      if (i === 0) {
        // 3: the ring is on the stretched box, around the card, and only there.
        const ring = await page.evaluate(() => {
          const a = document.activeElement;
          const after = getComputedStyle(a, "::after");
          const probe = document.createElement("span");
          probe.style.outlineWidth = "var(--FOCUS-WIDTH)";
          probe.style.outlineStyle = "solid";
          a.append(probe);
          const expected = getComputedStyle(probe).outlineWidth;
          probe.remove();
          return {
            own: getComputedStyle(a).outlineWidth,
            after: after.outlineWidth,
            afterStyle: after.outlineStyle,
            position: after.position,
            expected,
          };
        });
        if (ring.own !== "0px") fail.push(`media: the focused link draws its own ${ring.own} ring`);
        if (ring.after !== ring.expected || ring.afterStyle !== "solid" || ring.position !== "absolute") {
          fail.push(`media: the card ring is ${ring.after} ${ring.afterStyle} (${ring.position}), --FOCUS-WIDTH is ${ring.expected}`);
        }
      }
    }
    if (stops.join(" ") !== "0:link 0:button 1:link") {
      fail.push(`media: Tab visits ${stops.join(" → ")}, expected card 0 link → its button → card 1 link`);
    }

    // 4: hit-testing over the card (in view: elementFromPoint sees only the viewport), then real clicks.
    const hits = await page.evaluate((POSTS) => {
      const card = document.querySelector(`${POSTS} article`);
      card.scrollIntoView({ block: "center", behavior: "instant" });
      const link = card.querySelector("a.r-marketing-media-card-link");
      const button = card.querySelector(".r-marketing-media-card-actions button");
      const at = (el) => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      };
      const parts = {
        media: card.querySelector(".r-marketing-media-card-media"),
        badge: card.querySelector(".r-marketing-media-card-media > div"),
        title: card.querySelector("h3"),
        description: card.querySelector("p"),
        meta: card.querySelector("time"),
      };
      const result = {};
      for (const [name, el] of Object.entries(parts)) result[name] = el ? at(el) === link : "missing";
      result.button = button ? button.contains(at(button)) : "missing";
      return result;
    }, POSTS);
    for (const [part, ok] of Object.entries(hits)) {
      if (ok !== true) fail.push(`media: a press on the ${part} ${ok === "missing" ? "(missing)" : "does not reach its target"}`);
    }
    const save = page.locator(`${POSTS} article`).first().locator(".r-marketing-media-card-actions button");
    await save.click();
    const afterSave = await page.evaluate(() => location.hash);
    if ((await save.getAttribute("aria-pressed")) !== "true") fail.push("media: the save button did not toggle");
    if (afterSave !== "#/marketing") fail.push(`media: pressing save followed the card link (${afterSave})`);
    // A raw mouse press at the description's centre: the stretched link is on top there, by design.
    const desc = await page.locator(`${POSTS} article`).first().locator("p").boundingBox();
    await page.mouse.click(desc.x + desc.width / 2, desc.y + desc.height / 2);
    await page.waitForTimeout(100);
    const afterCard = await page.evaluate(() => location.hash);
    if (afterCard !== "#/marketing/journal") fail.push(`media: a click on the description went to ${afterCard}, not the card's link`);

    // 5: the image.
    const img = await page.evaluate((POSTS) => {
      const im = document.querySelector(`${POSTS} article img`);
      const box = im.parentElement.getBoundingClientRect();
      return { loading: im.loading, w: im.getAttribute("width"), h: im.getAttribute("height"), ratio: box.width / box.height };
    }, POSTS);
    if (img.loading !== "lazy" || !img.w || !img.h) fail.push(`media: image loading=${img.loading} width=${img.w} height=${img.h}`);
    if (!near(img.ratio, 16 / 9, 0.02)) fail.push(`media: media box ratio ${img.ratio.toFixed(3)}, expected 16:9`);

    // 6: hover lift, then the same under reduced motion.
    for (const reduced of [false, true]) {
      await load("marketing", 1280, { reduced });
      const card = page.locator(`${POSTS} article`).nth(1);
      await card.scrollIntoViewIfNeeded();
      const rest = await card.evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, y: el.getBoundingClientRect().top }));
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(450);
      const hover = await card.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.marginTop = "var(--MOTION-DISTANCE-SM)";
        el.append(probe);
        const distance = Number.parseFloat(getComputedStyle(probe).marginTop);
        probe.remove();
        return { border: getComputedStyle(el).borderTopColor, y: el.getBoundingClientRect().top, distance };
      });
      const label = reduced ? "reduced motion" : "motion";
      if (hover.border === rest.border) fail.push(`media (${label}): hover does not firm the card's edge`);
      if (!reduced && (hover.distance <= 0 || !near(rest.y - hover.y, hover.distance, 0.5))) {
        fail.push(`media: hover lifted the card ${rest.y - hover.y}px, --MOTION-DISTANCE-SM is ${hover.distance}px`);
      }
      if (reduced && (hover.distance !== 0 || !near(rest.y, hover.y, 0.25))) {
        fail.push(`media (reduced motion): the card moved ${rest.y - hover.y}px (distance token ${hover.distance}px)`);
      }
      await page.mouse.move(0, 0);
    }

    // ── Carousel on the page ──────────────────────────────────────────────────
    const Q = '[data-mkt="quotes"]';
    const TRACK = `${Q} .r-marketing-carousel-track`;
    const status = () => page.locator(`${Q} [role="status"]`).textContent();
    await load("marketing", 1280);
    await page.locator(Q).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const wide = await status();
    if (wide !== "Slides 1–3 of 5") fail.push(`carousel: at 1280 the status reads "${wide}", expected three in view`);
    // Narrow only the carousel's own column: per view must follow it, not the viewport.
    await page.locator(Q).evaluate((el) => el.parentElement.style.setProperty("max-inline-size", "var(--COLUMN-LG)"));
    await page.waitForTimeout(300);
    const narrowColumn = await status();
    if (narrowColumn !== "Slide 1 of 5") fail.push(`carousel: in a narrowed column at 1280 the status reads "${narrowColumn}"`);
    await page.locator(Q).evaluate((el) => el.parentElement.style.removeProperty("max-inline-size"));
    await page.waitForTimeout(300);

    // 8: buttons and keys move by one measured pitch; the next slide peeks.
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
    const afterNext = await settle(TRACK);
    if (!near(afterNext, geo.pitch)) fail.push(`carousel: next scrolled to ${afterNext}, one slide is ${geo.pitch}`);
    if ((await status()) !== "Slides 2–4 of 5") fail.push(`carousel: after next the status reads "${await status()}"`);
    await page.getByRole("button", { name: "Previous slide" }).first().click();
    const afterPrev = await settle(TRACK);
    if (!near(afterPrev, 0)) fail.push(`carousel: previous scrolled to ${afterPrev}, expected 0`);

    await page.locator(TRACK).focus();
    await page.keyboard.press("ArrowRight");
    const keyNext = await settle(TRACK);
    if (!near(keyNext, geo.pitch)) fail.push(`carousel: ArrowRight scrolled to ${keyNext}, one slide is ${geo.pitch}`);
    await page.keyboard.press("End");
    const keyEnd = await settle(TRACK);
    if (!near(keyEnd, geo.max)) fail.push(`carousel: End scrolled to ${keyEnd}, the end is ${geo.max}`);
    await page.keyboard.press("Home");
    const keyHome = await settle(TRACK);
    if (!near(keyHome, 0)) fail.push(`carousel: Home scrolled to ${keyHome}`);
    if (!(await page.locator(TRACK).evaluate((el) => el === document.activeElement))) {
      fail.push("carousel: the track lost focus while driven by keys");
    }

    // 9: every slide fully into view by scrolling alone.
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

    // 10: no autoplay by default.
    const rotation = await page.locator(`${Q}`).evaluate((el) => ({
      playing: el.getAttribute("data-playing"),
      toggles: [...el.querySelectorAll("button")].filter((b) => /slide show/.test(b.getAttribute("aria-label") ?? "")).length,
    }));
    if (rotation.playing !== null || rotation.toggles !== 0) fail.push(`carousel: rotation is on by default (${JSON.stringify(rotation)})`);
    const still0 = await settle(TRACK);
    await page.waitForTimeout(6500);
    const still1 = await settle(TRACK);
    if (still0 !== still1) fail.push(`carousel: moved by itself from ${still0} to ${still1}`);

    // ── Carousel demos in the Overview ────────────────────────────────────────
    const AUTO = '[data-sc="carousel-autoplay"] section';
    const AUTO_TRACK = `${AUTO} .r-marketing-carousel-track`;
    await load("overview/marketing-carousel", 1280);
    await page.locator(AUTO).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    if ((await page.locator(AUTO).getAttribute("data-playing")) !== "true") fail.push("autoplay: the opt-in demo is not rotating");
    let rotated = 0;
    for (let i = 0; i < 70 && rotated <= 1; i++) {
      await page.waitForTimeout(100);
      rotated = await page.locator(AUTO_TRACK).evaluate((el) => el.scrollLeft);
    }
    if (!(rotated > 1)) fail.push("autoplay: the opt-in demo did not advance within 7s");
    await page.locator(AUTO).hover();
    await page.waitForTimeout(100);
    if ((await page.locator(AUTO).getAttribute("data-playing")) !== "false") fail.push("autoplay: a hovering mouse does not pause it");
    await page.mouse.move(0, 0);

    await load("overview/marketing-carousel", 1280, { reduced: true });
    await page.locator(AUTO).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const reducedState = await page.locator(AUTO).evaluate((el) => ({
      playing: el.getAttribute("data-playing"),
      play: [...el.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Play slide show"),
    }));
    if (reducedState.playing !== "false" || !reducedState.play) {
      fail.push(`autoplay (reduced motion): it starts (${JSON.stringify(reducedState)})`);
    }
    await page.waitForTimeout(5600);
    const reducedScroll = await page.locator(AUTO_TRACK).evaluate((el) => el.scrollLeft);
    if (reducedScroll !== 0) fail.push(`autoplay (reduced motion): it moved to ${reducedScroll}`);

    // 12b: dots step from the target during a smooth scroll.
    await load("overview/marketing-carousel", 1280);
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
    const stepped = await settle(`#marketing-carousel [aria-label="How it works"] .r-marketing-carousel-track, #marketing-carousel section[aria-label="How it works"] .r-marketing-carousel-track`);
    const selected = await tabs.evaluateAll((list) => list.findIndex((t) => t.getAttribute("aria-selected") === "true"));
    const focused = await tabs.evaluateAll((list) => list.indexOf(document.activeElement));
    if (!(quick.mid > 0.5 && quick.mid < quick.pitch - 0.5)) fail.push(`dots: harness: the second press did not come mid-scroll (scrollLeft ${quick.mid}, one slide ${quick.pitch}), so it proves nothing`);
    if (selected !== 2 || focused !== 2) fail.push(`dots: two quick presses selected dot ${selected + 1} with focus on dot ${focused + 1}, expected 3`);
    if (!near(stepped, Math.min(2 * quick.pitch, quick.max))) fail.push(`dots: the track settled at ${stepped}, the third slide is at ${Math.min(2 * quick.pitch, quick.max)}`);

    // 12: RTL.
    const RTL = '[data-sc="carousel-rtl"] section';
    const RTL_TRACK = `${RTL} .r-marketing-carousel-track`;
    await load("overview/marketing-carousel", 1280);
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
    const rtlNext = await settle(RTL_TRACK);
    if (!near(rtlNext, -rtl0.pitch)) fail.push(`rtl: next scrolled to ${rtlNext}, one slide forward is ${-rtl0.pitch}`);
    const landed = await page.evaluate((TRACK) => {
      const t = document.querySelector(TRACK);
      return t.children[1].getBoundingClientRect().right - (t.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(t).scrollPaddingRight));
    }, RTL_TRACK);
    if (!near(landed, 0)) fail.push(`rtl: after next the second slide is ${landed}px off the start edge`);
    await page.locator(RTL_TRACK).focus();
    await page.keyboard.press("ArrowLeft");
    const rtlKey = await settle(RTL_TRACK);
    if (!near(rtlKey, -2 * rtl0.pitch)) fail.push(`rtl: ArrowLeft scrolled to ${rtlKey}, two slides forward is ${-2 * rtl0.pitch}`);
    await page.keyboard.press("ArrowRight");
    const rtlBack = await settle(RTL_TRACK);
    if (!near(rtlBack, -rtl0.pitch)) fail.push(`rtl: ArrowRight scrolled to ${rtlBack}, expected back to ${-rtl0.pitch}`);

    // 13: nothing scrolls sideways at 375.
    for (const hash of ["overview/marketing-hero", "marketing"]) {
      await load(hash, 375, { view: { input: "coarse" } });
      const m = await page.evaluate(() => {
        const html = document.documentElement;
        const sections = [...document.querySelectorAll('[id^="marketing-"].sc-section, [data-mkt]')].filter((el) => el.matches("section"));
        const over = sections.filter((el) => el.getBoundingClientRect().right > html.clientWidth + 0.5).map((el) => el.id || el.dataset.mkt);
        return { scroll: html.scrollWidth, client: html.clientWidth, sections: sections.length, over };
      });
      if (m.sections === 0) fail.push(`375 ${hash}: harness: no marketing sections found`);
      if (m.scroll > m.client) fail.push(`375 ${hash}: horizontal page scroll (${m.scroll} > ${m.client})`);
      if (m.over.length) fail.push(`375 ${hash}: sections past the viewport: ${m.over.join(", ")}`);
      notes.push(`${hash}@375 ${m.sections} sections`);
    }
  } finally {
    stopErrors();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-components FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return `marketing-components OK (card: 2 tab stops, whole-card hits, lift and reduced motion; carousel: per view by container, one-slide steps, keys, 5 slides reachable, no default autoplay, opt-in autoplay paused by hover and reduced motion, RTL; ${notes.join(", ")})`;
}
