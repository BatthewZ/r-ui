// Browser check: the Marketing page keeps UI inside prose at UI scale, and its
// display type is fluid with no viewport step.
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
//   4. at 375, in every theme and on every axis, the page has no horizontal scroll
//      and the pricing table fits its own box (no scroll inside it either);
//   5. the hero is the library's Hero: its title takes the DISPLAY face role (a
//      stylesheet that sets only --FONT-DISPLAY moves it, and in the first listed theme
//      whose display face differs from its UI face it resolves to that display face,
//      not the body's) at exactly --DISPLAY-1, and
//      its section runs edge to edge inside the showcase shell (the band pattern: its
//      box spans the shell's main region, padding included) at 1280 and 375;
//   6. no console error and no uncaught page error throughout.
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
        const m = await page.evaluate(() => {
          const html = document.documentElement;
          const table = document.querySelector("#pricing table");
          const box = table?.parentElement;
          return {
            scroll: html.scrollWidth,
            client: html.clientWidth,
            table: table ? table.scrollWidth : -1,
            box: box ? box.clientWidth : -1,
          };
        });
        fitCombos++;
        if (m.scroll > m.client) fail.push(`${label}: horizontal page scroll (${m.scroll} > ${m.client})`);
        if (m.table < 0) fail.push(`${label}: pricing table missing`);
        else if (m.table > m.box) fail.push(`${label}: pricing table scrolls inside its box (${m.table} > ${m.box})`);
      }
    }
  } finally {
    stopErrors();
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-page FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  const fmt = (k) => [375, 600, 640, 680, 1440].map((w) => samples[w][k].toFixed(1)).join("/");
  return `marketing-page OK (prose UI on ${uiCombos} density×input combos; hero display role, size and full bleed in ${heroViews} views; display-1 ${fmt("d1")}px, display-2 ${fmt("d2")}px at 375/600/640/680/1440; ${fitCombos} narrow views fit)`;
}
