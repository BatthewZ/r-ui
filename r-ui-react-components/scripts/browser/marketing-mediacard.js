// @covers   marketing/MediaCard
// @tier     component
//
// Browser check: MediaCard on the Marketing page's journal grid. Nothing scrolling sideways
// at 375 is sweep-overview's (every section) and marketing-page's (the page).
//
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
//   7. no console error and no uncaught page error.
//
// Run it through `bun run browser:check marketing-mediacard`.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  /** The Marketing page at 1280, reduced motion or not. */
  const load = async ({ reduced = false } = {}) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await openPage(page, "marketing", { width: 1280, view: { theme: "default", density: "comfortable", input: "fine" } });
    await page.mouse.move(0, 0);
    await settle(page);
  };

  const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
  /** Waits until `fn` (run in the page) returns true, up to `timeout`; never throws (the assertion after it reads the state). */
  const until = (fn, arg, timeout = 3000) => page.waitForFunction(fn, arg, { timeout }).catch(() => undefined);

  try {
    // 1. Harness.
    await load();
    const POSTS = '[data-mkt="posts"]';
    await page.locator(`${POSTS} article`).first().scrollIntoViewIfNeeded();
    const cards = await page.locator(`${POSTS} article.r-marketing-media-card`).count();
    if (cards !== 4) fail.push(`media: harness: ${cards} cards in the journal grid, the page lists 4 posts`);

    // 2. Tab stops.
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
        // 3. The ring is on the stretched box, around the card, and only there.
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

    // 4. Hit-testing over the card (in view: elementFromPoint sees only the viewport), then real clicks.
    const hits = await page.evaluate((POSTS) => {
      const card = document.querySelector(`${POSTS} article`);
      card.scrollIntoView({ block: "center", behavior: "instant" });
      const link = card.querySelector("a.r-marketing-stretched-link");
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
    await until(() => location.hash === "#/marketing/journal");
    const afterCard = await page.evaluate(() => location.hash);
    if (afterCard !== "#/marketing/journal") fail.push(`media: a click on the description went to ${afterCard}, not the card's link`);

    // 5. The image.
    const img = await page.evaluate((POSTS) => {
      const im = document.querySelector(`${POSTS} article img`);
      const box = im.parentElement.getBoundingClientRect();
      return { loading: im.loading, w: im.getAttribute("width"), h: im.getAttribute("height"), ratio: box.width / box.height };
    }, POSTS);
    if (img.loading !== "lazy" || !img.w || !img.h) fail.push(`media: image loading=${img.loading} width=${img.w} height=${img.h}`);
    if (!near(img.ratio, 16 / 9, 0.02)) fail.push(`media: media box ratio ${img.ratio.toFixed(3)}, expected 16:9`);

    // 6. Hover lift, then the same under reduced motion.
    for (const reduced of [false, true]) {
      await load({ reduced });
      const card = page.locator(`${POSTS} article`).nth(1);
      await card.scrollIntoViewIfNeeded();
      const rest = await card.evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, y: el.getBoundingClientRect().top }));
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // The lift and the edge are transitions: wait for them to finish, not for a guess.
      await settle(page);
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
  } finally {
    stopErrors();
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-mediacard FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return `marketing-mediacard OK (card: 2 tab stops, whole-card hits, lift and reduced motion)`;
}
