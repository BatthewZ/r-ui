// @covers   motion
// @sections motion-viewtransition
// @tier     component
// @cost     10
//
// Browser check: the View transitions demos run their own choreographies.
//
// jsdom has no View Transitions API. Each press is read while its transition runs
// (the `::view-transition-*` animations the document reports), then finished at once.
// On the motion-viewtransition section opened alone (1280, comfortable, fine):
//   1. the layout switch (the library's useViewTransition) captures its six cards;
//   2. each choreographed demo captures ITS elements and the page, nothing else (the
//      layout cards keep out): the drill-down its three KPI tiles, the price roll its
//      three prices, the tour its panel, the theme reveal only the page;
//   3. each runs its own animations: the drill-down morphs the opened tile's group
//      and swaps the page without a fade; prices `sc-vt-roll-out` / `-in`; the tour
//      `sc-vt-slide-out` / `-in`; the reveal `sc-vt-reveal` on the new page, the old
//      one unanimated;
//   4. while each runs, `<html data-sc-vt>` names its kind and carries its direction or
//      origin: `--sc-vt-roll` 1 to yearly and -1 back, `--sc-vt-dir` 1 forward and -1
//      back, `--sc-vt-x` / `-y` at the press (±1px); once finished, all are gone;
//   5. each lands where it says: the panel open with Back focused, then the tile
//      focused again; "$290 / year"; "Step 2 of 3"; the next theme;
//   6. under emulated reduced motion (reloaded), a press applies at once: no
//      transition runs and `data-sc-vt` is on `<html>` at no frame (the helper sets it
//      before the library decides to skip, and clears it when `finished` settles right
//      after the update; positive control: the same per-frame sampler sees it during
//      the full-motion presses).
//
// Suggested break: have `startViewTransition` (src/components/motion/view-transition.ts)
// return the update's promise as `finished` too: every marker and variable is gone
// before the animations it shapes start (3 and 4 fail).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const view = { theme: "default", density: "comfortable", input: "fine" };

  // Presses `act`, waits for the transition to start, reads it, then finishes it.
  const during = async (act) => {
    await act();
    await page.waitForFunction(() => document.getAnimations().some((a) => a.effect?.pseudoElement?.startsWith("::view-transition")), null, {
      timeout: 5000,
    });
    const seen = await page.evaluate(() => {
      const root = document.documentElement;
      const anims = document.getAnimations().filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition"));
      const names = new Set();
      const runs = {};
      for (const a of anims) {
        const pe = a.effect.pseudoElement;
        const m = /^::view-transition-([a-z-]+)\((.+)\)$/.exec(pe);
        if (!m) continue;
        names.add(m[2]);
        (runs[`${m[1]}(${m[2]})`] ??= []).push(a.animationName ?? "");
      }
      const css = getComputedStyle(root);
      return {
        kind: root.dataset.scVt ?? null,
        names: [...names].sort(),
        runs,
        vars: Object.fromEntries(["--sc-vt-roll", "--sc-vt-dir", "--sc-vt-x", "--sc-vt-y"].map((v) => [v, css.getPropertyValue(v).trim()])),
      };
    });
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a.effect?.pseudoElement?.startsWith("::view-transition")) a.finish();
    });
    await page.waitForFunction(() => !document.documentElement.dataset.scVt && !document.getAnimations().some((a) => a.effect?.pseudoElement?.startsWith("::view-transition")));
    await settle(page);
    const after = await page.evaluate(() => {
      const css = document.documentElement.style;
      return ["--sc-vt-roll", "--sc-vt-dir", "--sc-vt-x", "--sc-vt-y"].filter((v) => css.getPropertyValue(v) !== "");
    });
    return { ...seen, leftover: after };
  };
  const expectNames = (label, got, want) => {
    if (JSON.stringify(got.names) !== JSON.stringify([...want].sort())) fail.push(`${label}: captured ${JSON.stringify(got.names)}, expected ${JSON.stringify([...want].sort())}`);
    if (got.leftover.length) fail.push(`${label}: left ${got.leftover.join(", ")} on <html>`);
  };
  const ran = (got, key) => got.runs[key] ?? [];
  // Whether `<html data-sc-vt>` is there at any frame from now on (until the page reloads).
  const sampleMarker = () =>
    page.evaluate(() => {
      window.__scVtSeen = false;
      const tick = () => {
        if (document.documentElement.dataset.scVt) window.__scVtSeen = true;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  try {
    const section = await openSection(page, "motion-viewtransition", { view });
    await sampleMarker();
    const centre = (loc) => loc.evaluate((e) => e.scrollIntoView({ block: "center" }));

    // 1. The library hook: the six layout cards.
    const grid = section.locator("label", { hasText: "Grid" });
    await centre(grid);
    const layout = await during(() => grid.click());
    if (layout.names.filter((n) => n.startsWith("sc-vt-") && !n.startsWith("sc-vt-kpi") && !n.startsWith("sc-vt-price") && n !== "sc-vt-tour").length !== 6)
      fail.push(`layout: captured ${JSON.stringify(layout.names)}, expected its six cards`);
    if (layout.kind !== null) fail.push(`layout: the library hook set data-sc-vt "${layout.kind}"`);

    // 2–5. Drill down, and back.
    const tile = section.locator('[data-kpi="latency"]');
    await centre(tile);
    const drill = await during(() => tile.click());
    expectNames("drill", drill, ["root", "sc-vt-kpi-latency", "sc-vt-kpi-errors", "sc-vt-kpi-throughput"]);
    if (drill.kind !== "drill") fail.push(`drill: data-sc-vt was "${drill.kind}"`);
    if (!ran(drill, "group(sc-vt-kpi-latency)").length) fail.push("drill: the opened tile's group did not morph");
    if (ran(drill, "old(root)").length || ran(drill, "new(root)").length) fail.push(`drill: the page fades (${JSON.stringify(drill.runs["new(root)"])}), expected an instant swap`);
    const opened = await page.evaluate(() => ({ panel: !!document.querySelector('[data-sc="vt-kpi-detail"]'), focus: document.activeElement?.textContent?.trim() }));
    if (!opened.panel || opened.focus !== "Back to overview") fail.push(`drill: after it, ${JSON.stringify(opened)}`);
    await during(() => section.getByRole("button", { name: "Back to overview" }).click());
    const home = await page.evaluate(() => document.activeElement?.getAttribute("data-kpi"));
    if (home !== "latency") fail.push(`drill: back home, focus is on ${home}, expected the latency tile`);

    // Price roll, up then down.
    const yearly = section.locator("label", { hasText: "Yearly" });
    await centre(yearly);
    const up = await during(() => yearly.click());
    expectNames("roll", up, ["root", "sc-vt-price-business", "sc-vt-price-starter", "sc-vt-price-team"]);
    if (up.kind !== "roll" || up.vars["--sc-vt-roll"] !== "1") fail.push(`roll up: kind ${up.kind}, --sc-vt-roll "${up.vars["--sc-vt-roll"]}"`);
    if (!ran(up, "old(sc-vt-price-team)").includes("sc-vt-roll-out") || !ran(up, "new(sc-vt-price-team)").includes("sc-vt-roll-in"))
      fail.push(`roll: the Team price ran ${JSON.stringify([up.runs["old(sc-vt-price-team)"], up.runs["new(sc-vt-price-team)"]])}`);
    const price = (await section.locator('[data-price="team"]').textContent())?.replace(/\s+/g, " ").trim();
    if (price !== "$290 / year") fail.push(`roll: the Team price reads "${price}"`);
    const down = await during(() => section.locator("label", { hasText: "Monthly" }).click());
    if (down.vars["--sc-vt-roll"] !== "-1") fail.push(`roll down: --sc-vt-roll "${down.vars["--sc-vt-roll"]}", expected -1`);

    // Tour, forward then back.
    const next = section.getByRole("button", { name: "Next" });
    await centre(next);
    const fwd = await during(() => next.click());
    expectNames("tour", fwd, ["root", "sc-vt-tour"]);
    if (fwd.kind !== "tour" || fwd.vars["--sc-vt-dir"] !== "1") fail.push(`tour forward: kind ${fwd.kind}, --sc-vt-dir "${fwd.vars["--sc-vt-dir"]}"`);
    if (!ran(fwd, "old(sc-vt-tour)").includes("sc-vt-slide-out") || !ran(fwd, "new(sc-vt-tour)").includes("sc-vt-slide-in")) fail.push(`tour: ran ${JSON.stringify(fwd.runs)}`);
    if (!(await section.getByText("Step 2 of 3").isVisible())) fail.push("tour: not on step 2 after Next");
    const back = await during(() => section.getByRole("button", { name: "Previous" }).click());
    if (back.vars["--sc-vt-dir"] !== "-1") fail.push(`tour back: --sc-vt-dir "${back.vars["--sc-vt-dir"]}", expected -1`);

    // Theme reveal from the press.
    const before = await page.evaluate(() => document.documentElement.dataset.theme ?? "default");
    const switcher = section.getByRole("button", { name: /^Switch to / });
    await centre(switcher);
    const target = (await switcher.textContent()).replace("Switch to ", "").trim().toLowerCase();
    const box = await switcher.boundingBox();
    const press = { x: Math.round(box.x + 12), y: Math.round(box.y + box.height / 2) };
    const reveal = await during(() => page.mouse.click(press.x, press.y));
    expectNames("reveal", reveal, ["root"]);
    if (!ran(reveal, "new(root)").includes("sc-vt-reveal") || ran(reveal, "old(root)").length) fail.push(`reveal: ran ${JSON.stringify(reveal.runs)}`);
    if (Math.abs(Number.parseFloat(reveal.vars["--sc-vt-x"]) - press.x) > 1 || Math.abs(Number.parseFloat(reveal.vars["--sc-vt-y"]) - press.y) > 1)
      fail.push(`reveal: spreads from ${reveal.vars["--sc-vt-x"]}, ${reveal.vars["--sc-vt-y"]}, the press was ${press.x}, ${press.y}`);
    const now = await page.evaluate(() => document.documentElement.dataset.theme);
    if (now === before || now !== target) fail.push(`reveal: the theme is "${now}", expected "${target}" (was "${before}")`);

    if (!(await page.evaluate(() => window.__scVtSeen))) fail.push("harness: the per-frame sampler never saw data-sc-vt during the full-motion presses");

    // 6. Reduced motion: every press applies at once.
    const still = await openSection(page, "motion-viewtransition", { view, reduced: true });
    await sampleMarker();
    const quiet = still.locator('[data-kpi="latency"]');
    await centre(quiet);
    await quiet.click();
    await still.locator("label", { hasText: "Yearly" }).click();
    // Two frames for the sampler; not `settle`, which would wait out a transition that ran.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const reduced = await page.evaluate(() => ({
      marker: document.documentElement.dataset.scVt ?? null,
      seen: window.__scVtSeen,
      running: document.getAnimations().filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition")).length,
      panel: !!document.querySelector('[data-sc="vt-kpi-detail"]'),
      price: document.querySelector('[data-price="team"]')?.textContent.replace(/\s+/g, " ").trim(),
    }));
    if (reduced.seen || reduced.marker !== null || reduced.running) fail.push(`reduced motion: a transition ran (${JSON.stringify(reduced)})`);
    if (!reduced.panel || reduced.price !== "$290 / year") fail.push(`reduced motion: the presses did not apply (${JSON.stringify(reduced)})`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`motion-view-transitions:\n  ${fail.join("\n  ")}`);
  return "motion-view-transitions OK: the layout hook morphs its cards; drill-down, price roll, tour and theme reveal each capture only their own elements, run their own animations with their direction or origin, land where they say and clean up; reduced motion applies at once";
}
