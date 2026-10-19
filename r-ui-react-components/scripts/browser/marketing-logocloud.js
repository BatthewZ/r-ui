// @covers   marketing/LogoCloud
// @sections marketing-logocloud
// @tier     component
// @flags    timing
//
// Browser check: LogoCloud and its marquee, on the LogoCloud section
// (`#marketing-logocloud`), opened alone.
//
// Run it through `bun run browser:check marketing-logocloud`.
//
// Asserts:
//   1. harness: the grid demo (`logos-grid`) is one list of the five wordmarks in the
//      source, with no toggle; the marquee demo (`logos-marquee`) says it is running;
//   2. monochrome: an image logo's computed filter is `grayscale(1) invert(0)` (light) and an inline SVG
//      wordmark paints in --C-TEXT-SECONDARY (a probe); hovering an image in the
//      colour-on-hover demo drops its filter to `none`;
//   3. the marquee moves toward the inline start at about its speed (32px/s ± 50%);
//      the RTL demo moves toward the right;
//   4. copies: every set after the first is aria-hidden and inert, all sets are one
//      width (the seam keeps the pitch), one loop (half the track) covers the viewport,
//      and the accessibility tree names a logo once (Tessellate and Halden Labs, aria snapshot);
//   5. no scrollbar: the viewport clips (`overflow-x: clip`), cannot be scrolled
//      (scrollLeft stays 0 when set) and reserves no scrollbar space;
//   6. the pause toggle: pressed, it reads aria-pressed="true" and the row holds still
//      for 600ms; pressed again, it moves;
//   7. hover: a mouse over the logos holds the row (its animation is paused and the
//      row holds still); over the toggle it runs;
//   8. focus: once the first logo link has scrolled out past the start edge, Tab into
//      the links demo (from the toggle before it) focuses that first link, which comes
//      fully inside the viewport's content box and holds still while focused; Tab
//      walks the three links (each fully inside when focused, never a copy) and on to
//      the toggle, where the row runs again;
//   9. reduced motion (emulated, reloaded): the marquee demo is one wrapped list, no
//      copies, no toggle, no running animation in the section;
//  10. coarse + 375: the toggle answers a press 1px inside its hit floor (off its drawn
//      box); no logo cloud draws past its demo;
//  11. no console or page error.
async (page) => {
  const fail = [];
  const notes = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const demo = (name) => `[data-sc="${name}"]`;
  const TRACK = (name) => `${demo(name)} .r-marketing-logo-cloud-track`;

  const load = async (width, { reduced = false, view = {} } = {}) => {
    await openSection(page, "marketing-logocloud", { width, reduced, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
    await page.locator(demo("logos-grid")).waitFor();
    await page.mouse.move(0, 0);
  };

  /** The first set's start edge in viewport px, read now. */
  const position = (name) => page.locator(`${TRACK(name)} > ul`).first().evaluate((ul) => ul.getBoundingClientRect().left);
  const moved = async (name, ms) => {
    const a = await position(name);
    await page.waitForTimeout(ms);
    return (await position(name)) - a;
  };

  /** A colour token as the browser paints it (a probe). */
  const colour = (token) =>
    page.evaluate((token) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, token);

  try {
    // ── 1–2: harness, monochrome ──────────────────────────────────────────────
    await load(1280);
    const grid = await page.locator(demo("logos-grid")).evaluate((el) => ({
      lists: el.querySelectorAll("ul").length,
      items: el.querySelectorAll("li").length,
      buttons: el.querySelectorAll("button").length,
      svgColour: getComputedStyle(el.querySelector("li svg")).color,
    }));
    if (grid.lists !== 1 || grid.items !== 5 || grid.buttons !== 0) fail.push(`harness: grid ${JSON.stringify(grid)}, expected one list of 5 and no toggle`);
    const secondary = await colour("--C-TEXT-SECONDARY");
    if (grid.svgColour !== secondary) fail.push(`mono: an inline wordmark paints ${grid.svgColour}, --C-TEXT-SECONDARY is ${secondary}`);
    if ((await page.locator(`${demo("logos-marquee")} > div`).getAttribute("data-marquee")) !== "running") fail.push("harness: the marquee demo is not running");

    const image = page.locator(`${demo("logos-images")} li img`).first();
    await image.scrollIntoViewIfNeeded();
    const restFilter = await image.evaluate((img) => getComputedStyle(img).filter);
    // The default theme is light: grayscale, not inverted (a dark scheme inverts).
    if (restFilter !== "grayscale(1) invert(0)") fail.push(`mono: an image logo's filter is ${restFilter}`);
    await image.hover();
    await page.waitForTimeout(400);
    const hoverFilter = await image.evaluate((img) => getComputedStyle(img).filter);
    if (hoverFilter !== "none") fail.push(`hover colour: the hovered image's filter is ${hoverFilter}`);
    await page.mouse.move(0, 0);

    // ── 3–5: motion, copies, no scrollbar ─────────────────────────────────────
    await page.locator(demo("logos-marquee")).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const dx = await moved("logos-marquee", 1000);
    if (!(dx < -16 && dx > -48)) fail.push(`motion: the marquee moved ${dx.toFixed(1)}px in 1s, expected about -32`);
    const copies = await page.locator(demo("logos-marquee")).evaluate((root) => {
      const viewport = root.querySelector(".r-marketing-logo-cloud-viewport");
      const track = viewport.querySelector(".r-marketing-logo-cloud-track");
      const sets = [...track.children];
      const vs = getComputedStyle(viewport);
      const before = viewport.scrollLeft;
      viewport.scrollLeft = 120;
      const after = viewport.scrollLeft;
      return {
        sets: sets.length,
        hidden: sets.slice(1).every((s) => s.getAttribute("aria-hidden") === "true" && s.hasAttribute("inert")),
        firstHidden: sets[0].hasAttribute("aria-hidden"),
        widths: sets.map((s) => s.getBoundingClientRect().width),
        loop: track.getBoundingClientRect().width / 2,
        room: viewport.clientWidth,
        overflow: vs.overflowX,
        scroll: [before, after],
        gutter: viewport.offsetHeight - Number.parseFloat(vs.borderTopWidth) - Number.parseFloat(vs.borderBottomWidth) - viewport.clientHeight,
      };
    });
    if (copies.sets < 2 || !copies.hidden || copies.firstHidden) fail.push(`copies: ${JSON.stringify({ sets: copies.sets, hidden: copies.hidden, firstHidden: copies.firstHidden })}`);
    if (Math.max(...copies.widths) - Math.min(...copies.widths) > 0.5) fail.push(`copies: sets differ in width ${copies.widths}`);
    if (!(copies.loop >= copies.room)) fail.push(`copies: one loop ${copies.loop}px is shorter than the viewport ${copies.room}px`);
    if (copies.overflow !== "clip" || copies.scroll[1] !== 0 || copies.gutter !== 0) fail.push(`scrollbar: overflow ${copies.overflow}, scrollLeft ${copies.scroll}, gutter ${copies.gutter}px`);
    const snapshot = await page.locator(demo("logos-marquee")).ariaSnapshot();
    for (const name of ["Tessellate", "Halden Labs"]) {
      const count = snapshot.split(name).length - 1;
      if (count !== 1) fail.push(`copies: the accessibility tree names ${name} ${count} times`);
    }

    const rtl = await moved("logos-rtl", 800);
    if (!(rtl > 8)) fail.push(`rtl: the RTL marquee moved ${rtl.toFixed(1)}px, expected toward the right`);

    // ── 6–7: the toggle, hover ────────────────────────────────────────────────
    const marquee = page.locator(demo("logos-marquee"));
    const toggle = marquee.getByRole("button", { name: "Pause moving logos" });
    await toggle.click();
    await page.mouse.move(0, 0);
    if ((await toggle.getAttribute("aria-pressed")) !== "true") fail.push("toggle: pressed, it is not aria-pressed");
    const held = await moved("logos-marquee", 600);
    if (Math.abs(held) > 0.5) fail.push(`toggle: paused, the row moved ${held}px`);
    await toggle.click();
    await page.mouse.move(0, 0);
    const resumed = await moved("logos-marquee", 600);
    if (!(resumed < -5)) fail.push(`toggle: resumed, the row moved ${resumed}px`);

    const viewportBox = await marquee.locator(".r-marketing-logo-cloud-viewport").boundingBox();
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await page.waitForTimeout(100);
    const hoverState = await page.locator(TRACK("logos-marquee")).evaluate((t) => t.getAnimations()[0]?.playState);
    const hoverMoved = await moved("logos-marquee", 600);
    if (hoverState !== "paused" || Math.abs(hoverMoved) > 0.5) fail.push(`hover: over the logos the row is ${hoverState} and moved ${hoverMoved}px`);
    await toggle.hover();
    const overToggle = await moved("logos-marquee", 600);
    if (!(overToggle < -5)) fail.push(`hover: over the toggle the row moved ${overToggle}px, expected to run`);
    await page.mouse.move(0, 0);

    // ── 8: keyboard focus never leaves a logo out of view ─────────────────────
    const LINKS = demo("logos-marquee-links");
    await page.locator(LINKS).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const gone = await page.locator(LINKS).evaluate(async (root) => {
      const viewport = root.querySelector(".r-marketing-logo-cloud-viewport");
      const first = viewport.querySelector("ul li");
      const start = () => viewport.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(viewport).paddingLeft);
      for (let i = 0; i < 600; i++) {
        if (first.getBoundingClientRect().right < start()) return true;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return false;
    });
    if (!gone) fail.push("focus: harness: the first link never scrolled out past the start edge within 10s");
    await marquee.getByRole("button", { name: "Pause moving logos" }).focus();
    const inside = () =>
      page.locator(LINKS).evaluate((root) => {
        const a = document.activeElement;
        const viewport = root.querySelector(".r-marketing-logo-cloud-viewport");
        const vs = getComputedStyle(viewport);
        const box = viewport.getBoundingClientRect();
        const r = (a.closest("li") ?? a).getBoundingClientRect();
        return {
          inLinks: root.contains(a) && a.tagName === "A",
          inCopy: a.closest("[aria-hidden]") !== null,
          index: [...root.querySelectorAll("ul:first-of-type a")].indexOf(a),
          left: r.left - (box.left + Number.parseFloat(vs.paddingLeft)),
          right: box.right - Number.parseFloat(vs.paddingRight) - r.right,
          x: r.left,
        };
      });
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      const f = await inside();
      if (!f.inLinks || f.inCopy || f.index !== i) fail.push(`focus: Tab ${i + 1} landed on ${JSON.stringify(f)}, expected link ${i + 1} of the list`);
      if (f.left < -1 || f.right < -1) fail.push(`focus: link ${i + 1} is ${f.left.toFixed(1)}px / ${f.right.toFixed(1)}px past the viewport's edges`);
      await page.waitForTimeout(500);
      const later = await inside();
      if (Math.abs(later.x - f.x) > 0.5) fail.push(`focus: link ${i + 1} moved ${later.x - f.x}px while focused`);
    }
    await page.keyboard.press("Tab");
    const onToggle = await page.evaluate((LINKS) => document.activeElement.closest(LINKS) !== null && document.activeElement.tagName === "BUTTON", LINKS);
    if (!onToggle) fail.push("focus: Tab after the last link does not reach the links demo's toggle");
    const afterFocus = await moved("logos-marquee-links", 600);
    if (!(afterFocus < -5)) fail.push(`focus: with focus on the toggle the row moved ${afterFocus}px, expected to run`);

    // ── 9: reduced motion ─────────────────────────────────────────────────────
    await load(1280, { reduced: true });
    const still = await page.locator(demo("logos-marquee")).evaluate((el) => {
      const section = el.closest(".sc-section");
      const lists = el.querySelectorAll("ul");
      return {
        lists: lists.length,
        wrap: lists[0] ? getComputedStyle(lists[0]).flexWrap : null,
        buttons: el.querySelectorAll("button").length,
        marquee: el.querySelector("[data-marquee]") !== null,
        // Under 1ms is reduced motion's collapsed duration: no visible motion, so not counted.
        running: document
          .getAnimations()
          .filter((a) => section.contains(a.effect?.target ?? null) && a.playState === "running" && a.effect?.getComputedTiming().activeDuration >= 1).length,
      };
    });
    if (still.lists !== 1 || still.wrap !== "wrap" || still.buttons !== 0 || still.marquee || still.running !== 0) {
      fail.push(`reduced motion: ${JSON.stringify(still)}, expected one wrapped list, no toggle, nothing running`);
    }

    // ── 10: coarse + 375 ──────────────────────────────────────────────────────
    await load(375, { view: { input: "coarse" } });
    const floor = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.inlineSize = "var(--HIT-MIN)";
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    if (floor < 40) fail.push(`coarse: harness: --HIT-MIN is ${floor}px`);
    const press = await page.locator(demo("logos-marquee")).evaluate((root, floor) => {
      const button = root.querySelector("button");
      button.scrollIntoView({ block: "center" });
      const r = button.getBoundingClientRect();
      const y = r.top + r.height / 2 - (floor / 2 - 1);
      return { drawn: r.height, outside: y < r.top, hit: button.contains(document.elementFromPoint(r.left + r.width / 2, y)) };
    }, floor);
    if (!press.outside) fail.push(`coarse: harness: the toggle is ${press.drawn}px tall, the probe point is on it`);
    if (!press.hit) fail.push("coarse: a press inside the toggle's hit floor, off its drawn box, misses it");
    const spill = await page.evaluate(() => {
      const demos = [...document.querySelectorAll('#marketing-logocloud [data-sc^="logos-"]')];
      const out = demos.flatMap((d) => {
        const box = d.getBoundingClientRect();
        const cloud = d.querySelector(".r-marketing-logo-cloud");
        if (!cloud) return [];
        const r = cloud.getBoundingClientRect();
        return r.right > box.right + 0.5 || r.left < box.left - 0.5 ? [d.dataset.sc] : [];
      });
      return { demos: demos.length, out };
    });
    if (spill.demos !== 7) fail.push(`375: harness: ${spill.demos} logo demos`);
    if (spill.out.length) fail.push(`375: drawn past the demo: ${spill.out.join(", ")}`);
    notes.push(`moved ${dx.toFixed(1)}px/s`, `${copies.sets} sets`);
  } finally {
    stopErrors();
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-logocloud FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return `marketing-logocloud OK (monochrome and hover colour; the loop moves at its speed, mirrored in RTL; copies hidden and inert, one name each; clipped, no scrollbar; held by the toggle, hover and focus; keyboard focus brings each link into view and holds it; static under reduced motion; coarse toggle hit area; no spill at 375; ${notes.join(", ")})`;
}
