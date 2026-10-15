// Browser check: the Marketing page keeps UI inside prose at UI scale, and its
// display type is fluid with no viewport step.
//
//   1. harness: at 375 the hero heading sits on --DISPLAY-1's floor (2.25rem = 36px;
//      its container is narrower than the clamp's 360px-equivalent knee), and
//      --CONTROL-H reads max(the density's named value, --HIT-MIN) as the source says;
//   2. UI inside prose stays UI: in comfortable / compact × fine / coarse, the Button
//      and the Select inside the journal's `.prose` article are exactly --CONTROL-H
//      tall, and their font size and line height are the UI body text's
//      (--BodyText-1 / --BodyText-1-line-height, resolved in place), never the
//      reading line height of the paragraphs around them;
//   3. display type is fluid: the hero <h1> (display-1) and a section <h2>
//      (display-2) are strictly larger at 1440 than at 375, and sampled at 600, 640
//      and 680 they grow monotonically by near-equal steps (no jump at 640, the old
//      family's breakpoint);
//   4. at 375, in every theme and on every axis, the page has no horizontal scroll
//      and the pricing table fits its own box (no scroll inside it either);
//   5. no console error and no uncaught page error throughout.
//
// Run it through `bun run browser:check marketing`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

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

    // ── 3: fluid display type, no viewport step ──────────────────────────────
    await load({ theme: "default", density: "comfortable", input: "fine" }, 375);
    const sizes = {};
    for (const width of [375, 600, 640, 680, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      sizes[width] = await page.evaluate(() => ({
        d1: Number.parseFloat(getComputedStyle(document.querySelector('h1[data-mkt="display"]')).fontSize),
        d2: Number.parseFloat(getComputedStyle(document.querySelector("#mkt-features-title")).fontSize),
      }));
    }
    samples = sizes;
    if (sizes[375].d1 !== 36) fail.push(`harness: hero display-1 at 375 is ${sizes[375].d1}px, the --DISPLAY-1 floor is 36px`);
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
    for (const theme of ["default", "nightfall", "harbour", "atelier"]) {
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
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-page FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  const fmt = (k) => [375, 600, 640, 680, 1440].map((w) => samples[w][k].toFixed(1)).join("/");
  return `marketing-page OK (prose UI on ${uiCombos} density×input combos; display-1 ${fmt("d1")}px, display-2 ${fmt("d2")}px at 375/600/640/680/1440; ${fitCombos} narrow views fit)`;
}
