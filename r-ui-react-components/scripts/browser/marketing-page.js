// @covers   marketing, layout/Prose, motion/ReadingProgress
// @tier     page
//
// Browser check: the Marketing page keeps UI inside prose at UI scale, its display
// type is fluid with no viewport step, and its site header and anchors work under
// the showcase's own sticky bar.
//
//   1. harness: at 375 the hero heading is --DISPLAY-1's clamp as the source writes it,
//      `clamp(2.25rem, 1.663rem + 2.609cqi, 3.75rem)` over the Hero's own width (the
//      Hero is its title's size container), and
//      --CONTROL-H reads max(the density's named value, --HIT-MIN) as the source says;
//   2. UI inside prose stays UI: in comfortable / compact × fine / coarse, the Button
//      and the Select inside the journal's `.prose` article are exactly --CONTROL-H
//      tall, and their font size and line height are the UI body text's
//      (--BodyText-1 / --BodyText-1-line-height, resolved in place), never the
//      reading line height of the paragraphs around them;
//   3. display type is fluid: the hero's <h1> (display-1) and a section <h2>
//      (display-2) are strictly larger at 1440 than at 375, and sampled at 600, 640
//      and 680 they grow monotonically by near-equal steps (no jump at 640, the old
//      family's breakpoint);
//   4. at 375, in every theme and on every axis, the page has no horizontal scroll;
//      the comparison table keeps its columns inside its own scroll frame (the frame
//      ends inside the viewport) with the feature column pinned: scrolled to its
//      end, the first feature cell still starts at the frame's start edge (at least
//      one view must actually overflow, or the pin was never exercised);
//   5. the hero is the library's Hero: its title takes the DISPLAY face role (a
//      stylesheet that sets only --FONT-DISPLAY moves it, and in the first listed theme
//      whose display face differs from its UI face it resolves to that display face,
//      not the body's) at exactly --DISPLAY-1, and
//      its section runs edge to edge inside the showcase shell (the band pattern: its
//      box spans the shell's main region, padding included) at 1280 and 375;
//   6. no console error and no uncaught page error throughout;
//   7. the site header (reduced motion, so the slide is instant), at 1280 and at 375
//      compact/coarse: at the top it is transparent (no data-scrolled, no painted
//      background), sits on the showcase bar's bottom edge and takes no room (the
//      hero starts at its top); the hero's top padding is exactly the bar height
//      plus --SECTION-2 and the hero's text starts below the bar; scrolled down then
//      up it is stuck right under the showcase bar (not at 0, behind it) and solid
//      (data-scrolled, a background that is not transparent); scrolled further down it is hidden
//      (data-hidden) and slid fully past the bar: its bottom at the viewport's top
//      (its own height plus the `--r-marketing-site-header-top` offset); half slid
//      (an inline translate) it crosses the bar's edge and paints under that bar (a
//      hit-test just above the bar's bottom edge finds the bar: the page's `isolate`);
//      scrolled up again it is back under the bar;
//   8. anchors clear both sticky bars: `#/marketing/pricing` and
//      `#/marketing/compare` scroll their target to exactly the showcase bar's
//      height plus --r-marketing-site-header-h from the top (±1px), at 1280 and at
//      375 compact/coarse, where both bars have other heights; leaving the page
//      clears the document's scroll padding;
//   9. a picture inside prose: the journal's figure Image (no `data-not-prose`) has its
//      picture flush with its box (same rect ±0.5px), so prose's `* + img` flow margin
//      and image radius never reach a picture Image places itself;
//  10. the essay's ReadingProgress: scrolled into the essay, its bar sticks right
//      under the showcase bar (±1px; the page's `classNames.bar` offset), in the
//      sticky layer, and its fill grows as the reader goes further.
//
// Run it through `bun run browser:check marketing`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (view, width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/marketing`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), view);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-mkt="prose-button"]').waitFor();
    await page.waitForTimeout(200);
  };

  let uiCombos = 0;
  let heroViews = 0;
  let fitCombos = 0;
  let pinnedViews = 0;
  let headerViews = 0;
  let anchorViews = 0;
  let samples = null;
  try {
    // ── 1 + 2: UI inside prose, on every density × input ─────────────────────
    for (const density of ["comfortable", "compact"]) {
      for (const [input, hitPx] of Object.entries({ fine: 24, coarse: 44 })) {
        const label = `${density}/${input}`;
        await load({ theme: "default", density, input }, 1280);
        const m = await page.evaluate((density) => {
          const html = document.documentElement;
          const rootCss = getComputedStyle(html);
          const rem = (v) => (v.endsWith("rem") ? Number.parseFloat(v) * Number.parseFloat(rootCss.fontSize) : Number.NaN);
          const prose = document.querySelector('[data-mkt="prose"]');
          const button = prose?.querySelector('[data-mkt="prose-button"]');
          const select = prose?.querySelector('select[data-mkt="prose-select"]');
          const para = [...(prose?.querySelectorAll(":scope > p:not([class])") ?? [])][0];
          if (!prose?.classList.contains("prose") || !button || !select || !para) return { missing: true };
          // The UI text values, resolved where the controls sit (inside the prose region).
          const probe = document.createElement("span");
          probe.style.fontSize = "var(--BodyText-1)";
          probe.style.lineHeight = "var(--BodyText-1-line-height)";
          button.parentElement.append(probe);
          const ui = getComputedStyle(probe);
          const expected = { fontSize: ui.fontSize, lineHeight: ui.lineHeight };
          probe.remove();
          const read = (el) => {
            const cs = getComputedStyle(el);
            return {
              height: el.getBoundingClientRect().height,
              control: Number.parseFloat(cs.getPropertyValue("--CONTROL-H")),
              fontSize: cs.fontSize,
              lineHeight: cs.lineHeight,
            };
          };
          return {
            hit: rem(rootCss.getPropertyValue("--HIT-MIN").trim()),
            named: rem(rootCss.getPropertyValue(`--CONTROL-H-${density.toUpperCase()}`).trim()),
            rootControl: Number.parseFloat(rootCss.getPropertyValue("--CONTROL-H")),
            expected,
            proseLineHeight: getComputedStyle(para).lineHeight,
            button: read(button),
            select: read(select),
          };
        }, density);
        uiCombos++;
        if (m.missing) {
          fail.push(`${label}: the prose article, its Button, Select or a plain paragraph is missing`);
          continue;
        }
        if (m.hit !== hitPx) fail.push(`${label}: harness --HIT-MIN ${m.hit}px, source predicts ${hitPx}px`);
        if (m.rootControl !== Math.max(m.named, hitPx)) {
          fail.push(`${label}: harness --CONTROL-H ${m.rootControl}px, expected max(${m.named}, ${hitPx})`);
        }
        if (m.expected.lineHeight === m.proseLineHeight) {
          fail.push(`${label}: harness cannot tell UI leading (${m.expected.lineHeight}) from prose leading`);
        }
        for (const [name, el] of [
          ["Button", m.button],
          ["Select", m.select],
        ]) {
          if (Math.abs(el.height - el.control) > 0.5 || el.control !== m.rootControl) {
            fail.push(`${label}: prose ${name} is ${el.height}px tall, --CONTROL-H is ${el.control}px (root ${m.rootControl}px)`);
          }
          if (el.fontSize !== m.expected.fontSize) {
            fail.push(`${label}: prose ${name} font-size ${el.fontSize}, UI body text is ${m.expected.fontSize}`);
          }
          if (el.lineHeight !== m.expected.lineHeight || el.lineHeight === m.proseLineHeight) {
            fail.push(
              `${label}: prose ${name} line-height ${el.lineHeight}; UI leading is ${m.expected.lineHeight}, the prose around it ${m.proseLineHeight}`,
            );
          }
        }
      }
    }

    // ── 5: the Hero: display role, display size, edge to edge ───────────────
    const PROBE_FACE = "C4 Display Probe";
    const themes = await showcaseThemes(page);
    const split = themes.find((t) => t.display !== t.ui);
    if (!split) fail.push(`harness: no listed theme (${themes.map((t) => t.name).join(", ")}) gives its display face a family of its own`);
    for (const [theme, width] of [
      ["default", 1280],
      ["default", 375],
      ...(split ? [[split.name, 1280]] : []),
    ]) {
      const label = `hero ${theme}@${width}`;
      await load({ theme, density: "comfortable", input: "fine" }, width);
      const m = await page.evaluate((face) => {
        const hero = document.querySelector('section[data-mkt="hero"]');
        const h1 = hero?.querySelector("h1");
        const main = hero?.closest("main");
        if (!hero || !h1 || !main) return { missing: true };
        const probe = document.createElement("span");
        probe.style.fontSize = "var(--DISPLAY-1)";
        h1.parentElement.append(probe);
        const displaySize = getComputedStyle(probe).fontSize;
        probe.remove();
        const before = getComputedStyle(h1).fontFamily;
        const body = getComputedStyle(document.body).fontFamily;
        // Only the display role moves: a heading-role or UI-role reader would not follow.
        const style = document.createElement("style");
        style.textContent = `:root { --FONT-DISPLAY: "${face}", serif; }`;
        document.head.append(style);
        const moved = getComputedStyle(h1).fontFamily;
        const bodyAfter = getComputedStyle(document.body).fontFamily;
        style.remove();
        const hr = hero.getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        return {
          before,
          body,
          moved,
          bodyAfter,
          size: getComputedStyle(h1).fontSize,
          displaySize,
          hero: [hr.left, hr.right],
          main: [mr.left, mr.right],
          mainPad: getComputedStyle(main).paddingInlineStart,
        };
      }, PROBE_FACE);
      heroViews++;
      if (m.missing) {
        fail.push(`${label}: the hero section, its h1 or the shell's <main> is missing`);
        continue;
      }
      if (!m.moved.includes(PROBE_FACE)) fail.push(`${label}: title ignores --FONT-DISPLAY (${m.moved})`);
      if (m.bodyAfter.includes(PROBE_FACE)) fail.push(`${label}: harness: --FONT-DISPLAY moved the body face too`);
      if (theme === split?.name && (m.before === m.body || m.before.split(",")[0].replace(/["']/g, "").trim() !== split.display)) {
        fail.push(`${label}: title face ${m.before} is not the theme's display face ${split.display} (body ${m.body})`);
      }
      if (m.size !== m.displaySize) fail.push(`${label}: title is ${m.size}, --DISPLAY-1 resolves to ${m.displaySize}`);
      if (Number.parseFloat(m.mainPad) <= 0) fail.push(`${label}: harness: the shell's main has no padding to cancel`);
      if (Math.abs(m.hero[0] - m.main[0]) > 0.5 || Math.abs(m.hero[1] - m.main[1]) > 0.5) {
        fail.push(`${label}: hero spans ${m.hero.map(Math.round)}, the shell's main ${m.main.map(Math.round)}: not edge to edge`);
      }
    }

    // ── 3: fluid display type, no viewport step ──────────────────────────────
    await load({ theme: "default", density: "comfortable", input: "fine" }, 375);
    const sizes = {};
    for (const width of [375, 600, 640, 680, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      sizes[width] = await page.evaluate(() => ({
        heroWidth: document.querySelector('section[data-mkt="hero"]').clientWidth,
        d1: Number.parseFloat(getComputedStyle(document.querySelector('[data-mkt="hero"] h1')).fontSize),
        d2: Number.parseFloat(getComputedStyle(document.querySelector("#mkt-features-title")).fontSize),
      }));
    }
    samples = sizes;
    const predicted = Math.min(60, Math.max(36, 1.663 * 16 + (2.609 / 100) * sizes[375].heroWidth));
    if (Math.abs(sizes[375].d1 - predicted) > 0.05) {
      fail.push(`harness: hero display-1 at 375 is ${sizes[375].d1}px, the source's clamp predicts ${predicted.toFixed(2)}px`);
    }
    for (const key of ["d1", "d2"]) {
      const f = (w) => sizes[w][key];
      if (!(f(1440) > f(375))) fail.push(`${key}: ${f(1440)}px at 1440 is not larger than ${f(375)}px at 375`);
      const step1 = f(640) - f(600);
      const step2 = f(680) - f(640);
      if (!(step1 > 0 && step2 > 0)) fail.push(`${key}: not monotonic across 600/640/680 (${f(600)}, ${f(640)}, ${f(680)})`);
      if (Math.abs(step1 - step2) > 0.35) {
        fail.push(`${key}: uneven steps around 640 (${step1.toFixed(2)}px then ${step2.toFixed(2)}px): a viewport step, not a fluid scale`);
      }
    }

    // ── 4: nothing scrolls sideways at 375 ───────────────────────────────────
    for (const { name: theme } of themes) {
      for (const [density, input] of [
        ["comfortable", "fine"],
        ["compact", "fine"],
        ["comfortable", "coarse"],
      ]) {
        const label = `${theme}/${density}/${input}@375`;
        await load({ theme, density, input }, 375);
        const m = await page.evaluate(async () => {
          const html = document.documentElement;
          const table = document.querySelector("#pricing table");
          let box = table?.parentElement ?? null;
          while (box && !/auto|scroll/.test(getComputedStyle(box).overflowX)) box = box.parentElement;
          const cell = table?.querySelector('tbody th[scope="row"]');
          if (!table || !box || !cell) return { missing: true, scroll: html.scrollWidth, client: html.clientWidth };
          const frame = box.getBoundingClientRect();
          const overflows = box.scrollWidth > box.clientWidth + 1;
          box.scrollLeft = box.scrollWidth;
          for (let f = 0; f < 2; f++) await new Promise((r) => requestAnimationFrame(r));
          const start = frame.left + Number.parseFloat(getComputedStyle(box).borderLeftWidth);
          const pinnedOff = cell.getBoundingClientRect().left - start;
          const scrolled = box.scrollLeft;
          box.scrollLeft = 0;
          return {
            scroll: html.scrollWidth,
            client: html.clientWidth,
            frameRight: frame.right,
            overflows,
            scrolled,
            position: getComputedStyle(cell).position,
            pinnedOff,
          };
        });
        fitCombos++;
        if (m.scroll > m.client) fail.push(`${label}: horizontal page scroll (${m.scroll} > ${m.client})`);
        if (m.missing) fail.push(`${label}: the comparison table, its scroll frame or a feature cell is missing`);
        else {
          if (m.frameRight > m.client + 0.5) fail.push(`${label}: the comparison table's frame ends at ${m.frameRight}, past the viewport (${m.client})`);
          if (m.position !== "sticky") fail.push(`${label}: the feature column is ${m.position}, not pinned`);
          if (m.overflows) {
            pinnedViews++;
            if (!(m.scrolled > 0)) fail.push(`${label}: the comparison table overflows but its frame did not scroll`);
            if (Math.abs(m.pinnedOff) > 1) fail.push(`${label}: scrolled to its end, the feature cell is ${m.pinnedOff.toFixed(1)}px off the frame's start edge`);
          }
        }
      }
    }
    if (fitCombos > 0 && pinnedViews === 0) fail.push("harness: the comparison table fit every 375 view, so the pinned column was never exercised");

    // ── 7: the site header under the showcase's bar ──────────────────────────
    await page.emulateMedia({ reducedMotion: "reduce" });
    // React renders a scroll's state change in a later task, and even a reduced-motion
    // transition (a token near 0, not 0) starts on the frame after that: wait for the
    // header's transitions to finish rather than counting frames.
    const scrollTo = async (top) => {
      await page.evaluate((t) => window.scrollTo({ top: t, behavior: "instant" }), top);
      await page.evaluate(async () => {
        const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await frames();
        await frames();
        const header = document.querySelector('[data-mkt="page"] header.r-marketing-site-header');
        await Promise.all((header?.getAnimations() ?? []).map((a) => a.finished.catch(() => {})));
        await frames();
      });
    };
    const readHeader = () =>
      page.evaluate(() => {
        const header = document.querySelector('[data-mkt="page"] header.r-marketing-site-header');
        const bar = document.querySelector(".sc-topbar");
        const hero = document.querySelector('section[data-mkt="hero"]');
        if (!header || !bar || !hero) return { missing: true };
        const h = header.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const probe = document.createElement("div");
        probe.style.blockSize = "var(--SECTION-2)";
        hero.before(probe);
        const section2 = probe.getBoundingClientRect().height;
        probe.remove();
        const x = h.left + h.width / 2;
        const above = document.elementFromPoint(x, b.bottom - 2);
        return {
          variant: header.dataset.variant,
          scrolled: header.hasAttribute("data-scrolled"),
          hidden: header.hasAttribute("data-hidden"),
          background: getComputedStyle(header).backgroundColor,
          top: h.top,
          bottom: h.bottom,
          height: h.height,
          barBottom: b.bottom,
          heroTop: hero.getBoundingClientRect().top,
          heroPad: Number.parseFloat(getComputedStyle(hero).paddingTop),
          textTop: hero.querySelector("h1").parentElement.getBoundingClientRect().top,
          section2,
          barOnTop: Boolean(above && bar.contains(above)),
        };
      });
    const transparent = (c) => c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
    for (const [view, width] of [
      [{ theme: "default", density: "comfortable", input: "fine" }, 1280],
      [{ theme: "default", density: "compact", input: "coarse" }, 375],
    ]) {
      const label = `header ${view.density}/${view.input}@${width}`;
      await load(view, width);
      await scrollTo(0);
      const top = await readHeader();
      headerViews++;
      if (top.missing) {
        fail.push(`${label}: the site header, the showcase bar or the hero is missing`);
        continue;
      }
      if (top.variant !== "transparent" || top.scrolled || !transparent(top.background)) {
        fail.push(`${label}: at the top the header is ${top.variant}, scrolled=${top.scrolled}, background ${top.background}: not transparent`);
      }
      if (Math.abs(top.top - top.barBottom) > 0.5) fail.push(`${label}: at the top the header starts at ${top.top}, the showcase bar ends at ${top.barBottom}`);
      if (Math.abs(top.heroTop - top.top) > 0.5) fail.push(`${label}: the hero starts at ${top.heroTop}, not under the header (${top.top}): the header takes room`);
      if (!(top.section2 > 0) || Math.abs(top.heroPad - (top.height + top.section2)) > 0.5) {
        fail.push(`${label}: hero top padding ${top.heroPad}px, expected the bar (${top.height}) + --SECTION-2 (${top.section2})`);
      }
      if (top.textTop < top.bottom - 0.5) fail.push(`${label}: the hero's text starts at ${top.textTop}, under the header (bottom ${top.bottom})`);

      await scrollTo(600);
      await scrollTo(500);
      const stuck = await readHeader();
      if (stuck.hidden || !stuck.scrolled || transparent(stuck.background)) {
        fail.push(`${label}: scrolled down then up the header is hidden=${stuck.hidden}, scrolled=${stuck.scrolled}, background ${stuck.background}: not shown and solid`);
      }
      if (Math.abs(stuck.top - stuck.barBottom) > 0.5) fail.push(`${label}: stuck at ${stuck.top}, not under the showcase bar (${stuck.barBottom})`);

      await scrollTo(1100);
      const gone = await readHeader();
      if (!gone.hidden || Math.abs(gone.bottom) > 0.5) {
        fail.push(`${label}: scrolled down the header is hidden=${gone.hidden}, its bottom at ${gone.bottom} (expected 0: slid past the bar, which ends at ${gone.barBottom})`);
      }
      // Mid-slide it crosses the bar: half slid (an inline translate), it must pass under it.
      const crossing = await page.evaluate(() => {
        const header = document.querySelector('[data-mkt="page"] header.r-marketing-site-header');
        const bar = document.querySelector(".sc-topbar");
        header.style.transition = "none";
        header.style.translate = "0 calc(var(--r-marketing-site-header-h) / -2)";
        const h = header.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const hit = document.elementFromPoint(h.left + h.width / 2, b.bottom - 2);
        header.style.translate = "";
        header.style.transition = "";
        return { overlaps: h.top < b.bottom - 2 && h.bottom > b.bottom, barOnTop: Boolean(hit && bar.contains(hit)) };
      });
      if (!crossing.overlaps) fail.push(`${label}: harness: the half-slid header does not cross the showcase bar's edge`);
      else if (!crossing.barOnTop) fail.push(`${label}: sliding away, the header paints over the showcase bar`);

      await scrollTo(1000);
      const back = await readHeader();
      if (back.hidden || Math.abs(back.top - back.barBottom) > 0.5) fail.push(`${label}: scrolled up again the header is hidden=${back.hidden} at ${back.top} (bar ends at ${back.barBottom})`);
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // ── 8: anchors clear both sticky bars ────────────────────────────────────
    for (const [view, width] of [
      [{ theme: "default", density: "comfortable", input: "fine" }, 1280],
      [{ theme: "default", density: "compact", input: "coarse" }, 375],
    ]) {
      await load(view, width);
      for (const id of ["pricing", "compare"]) {
        const label = `anchor #${id} ${view.density}/${view.input}@${width}`;
        await page.evaluate((id) => {
          location.hash = `#/marketing/${id}`;
        }, id);
        await page.waitForTimeout(300);
        const m = await page.evaluate((id) => {
          const target = document.getElementById(id);
          const bar = document.querySelector(".sc-topbar");
          if (!target || !bar) return { missing: true };
          const probe = document.createElement("div");
          probe.style.blockSize = "var(--r-marketing-site-header-h)";
          document.body.append(probe);
          const header = probe.getBoundingClientRect().height;
          probe.remove();
          return { top: target.getBoundingClientRect().top, bar: bar.getBoundingClientRect().height, header, y: window.scrollY };
        }, id);
        anchorViews++;
        if (m.missing) {
          fail.push(`${label}: the target or the showcase bar is missing`);
          continue;
        }
        if (!(m.header > 0) || !(m.y > 0)) fail.push(`${label}: harness: header height ${m.header}, scrolled ${m.y}`);
        if (Math.abs(m.top - (m.bar + m.header)) > 1) {
          fail.push(`${label}: the target lands at ${m.top.toFixed(1)}px, expected the showcase bar (${m.bar}) + the site header (${m.header})`);
        }
      }
    }

    // ── 9: a picture inside prose is flush with its Image box ───────────────
    await load({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    await page.locator('[data-mkt="prose"] figure .r-media-image').scrollIntoViewIfNeeded();
    const figure = await page.evaluate(() => {
      const box = document.querySelector('[data-mkt="prose"] figure .r-media-image');
      const img = box?.querySelector("img.r-media-image-picture");
      if (!box || !img) return { missing: true };
      const b = box.getBoundingClientRect();
      const i = img.getBoundingClientRect();
      return {
        optedOut: box.closest("[data-not-prose], .not-prose") !== null,
        off: [i.top - b.top, i.left - b.left, i.bottom - b.bottom, i.right - b.right],
        radius: getComputedStyle(img).borderTopLeftRadius,
      };
    });
    if (figure.missing) fail.push("prose figure: the Image box or its picture is missing");
    else {
      if (figure.optedOut) fail.push("prose figure: harness: the Image opts out of prose, so the check proves nothing");
      if (figure.off.some((d) => Math.abs(d) > 0.5)) fail.push(`prose figure: the picture is off its box by ${figure.off.map((d) => d.toFixed(1))} (top, left, bottom, right)`);
      if (Number.parseFloat(figure.radius) !== 0) fail.push(`prose figure: the picture rounds itself (${figure.radius}) apart from its box`);
    }

    // ── 10: the essay's reading bar sticks under the showcase bar and fills ──
    const readBar = () =>
      page.evaluate(() => {
        const region = document.querySelector('[data-mkt="prose"]')?.closest(".r-motion-reading");
        const bar = region?.querySelector(".r-motion-reading-bar");
        const fill = bar?.querySelector(".r-motion-reading-fill");
        const shell = document.querySelector(".sc-topbar");
        if (!region || !bar || !fill || !shell) return { missing: true };
        const r = region.getBoundingClientRect();
        return {
          regionTop: r.top + window.scrollY,
          regionHeight: r.height,
          top: bar.getBoundingClientRect().top,
          shellBottom: shell.getBoundingClientRect().bottom,
          zIndex: getComputedStyle(bar).zIndex,
          sticky: getComputedStyle(document.documentElement).getPropertyValue("--LAYER-STICKY").trim(),
          share: fill.getBoundingClientRect().width / bar.getBoundingClientRect().width,
        };
      });
    const essay = await readBar();
    const shares = [];
    if (essay.missing) fail.push("reading bar: the essay's ReadingProgress, its bar or the showcase bar is missing");
    else {
      for (const frac of [0.3, 0.6]) {
        await scrollTo(essay.regionTop + essay.regionHeight * frac - 450);
        const m = await readBar();
        shares.push(m.share);
        if (Math.abs(m.top - m.shellBottom) > 1) fail.push(`reading bar at ${frac}: sticks at ${m.top.toFixed(1)}, not under the showcase bar (${m.shellBottom})`);
        if (m.zIndex !== m.sticky) fail.push(`reading bar at ${frac}: z-index ${m.zIndex}, not the sticky layer (${m.sticky})`);
      }
      if (!(shares[0] > 0 && shares[1] > shares[0] && shares[1] < 1)) fail.push(`reading bar: the fill does not grow through the essay (${shares.map((v) => v.toFixed(2))})`);
    }

    await page.goto(`${base}#/overview`);
    await waitForShowcase(page);
    const leftover = await page.evaluate(() => document.documentElement.style.scrollPaddingBlockStart);
    if (leftover !== "") fail.push(`leaving the page left the document's scroll padding at "${leftover}"`);
  } finally {
    stopErrors();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-page FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  const fmt = (k) => [375, 600, 640, 680, 1440].map((w) => samples[w][k].toFixed(1)).join("/");
  return `marketing-page OK (prose UI on ${uiCombos} density×input combos; hero display role, size and full bleed in ${heroViews} views; display-1 ${fmt("d1")}px, display-2 ${fmt("d2")}px at 375/600/640/680/1440; ${fitCombos} narrow views fit, ${pinnedViews} with the comparison scrolled under its pinned column; site header in ${headerViews} views; ${anchorViews} anchors clear both bars; a prose figure's picture flush; the reading bar under the showcase bar)`;
}
