// @covers   feedback/ProgressBar, feedback/Banner
// @sections feedback-progressbar feedback-banner
// @tier     component
// @flags    timing
//
// Browser check: ProgressBar's value and its motion, which jsdom cannot paint, and a
// sticky Banner's place on a real scroller.
//
// Run it through `bun run browser:check feedback`.
//
// Asserts, on the ProgressBar section opened alone (`#feedback-progressbar`):
//   1. harness: the "Indexing documents" bar (`[data-sc="progress-static"]`, value 45 in
//      the source) is a progressbar with aria-valuenow 45, aria-valuetext "45%", the same
//      text visible, and its fill 45% of its track's width (±1px);
//   2. once the demos' timers settle (the release pipeline reaches 5 of 5), every
//      determinate bar in the section (counted first): the visible value is the spoken
//      value (aria-valuetext is the visible text, or it plus ", <tone word>"); a bar whose
//      text is a percentage reads floor(valuenow / max × 100); a continuous fill spans
//      valuenow / max of its track (±1px); a segmented bar fills floor(valuenow) segments;
//   3. the indeterminate bar (`[data-sc="progress-indeterminate"]`) has no aria-valuenow
//      and says its word, visibly and in aria-valuetext; with no motion preference its
//      sweep runs the `r-feedback-progress-sweep` animation and moves between frames;
//   4. under emulated reduced motion (reloaded), the same sweep runs no animation
//      (`getAnimations()` empty, `animation-name: none`), stands still across the whole
//      track, and is striped (a mask image), while the word stays.
// On the Banner section opened alone (`#feedback-banner`):
//   5. the sticky banner (`[data-sc="banner-sticky"]`), its scroller scrolled to the end,
//      stays on the scroller's top edge (±1px) on the sticky layer (z-index =
//      --LAYER-STICKY, read from the token).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /progress/i.test(text) });

  const load = async ({ reduced = false, on = page } = {}) => {
    // The demos' timers keep starting fills for seconds: settle on what the load started.
    await openSection(on, "feedback-progressbar", { view: { theme: "default", density: "comfortable", input: "fine" }, reduced, settle: "started" });
    await on.locator('[data-sc="progress-static"]').waitFor();
    await on.locator('[data-sc="progress-static"]').scrollIntoViewIfNeeded();
  };

  /** The bar's own facts: what it says, what it shows, how much of each track is filled. */
  const readBars = (on = page) =>
    on.evaluate(() => {
      const section = document.getElementById("feedback-progressbar");
      return [...section.querySelectorAll('[role="progressbar"]')].map((bar) => {
        const tracks = [...bar.querySelectorAll(".r-feedback-progress-track")];
        return {
          name: bar.getAttribute("aria-labelledby") ? document.getElementById(bar.getAttribute("aria-labelledby"))?.textContent : null,
          now: bar.getAttribute("aria-valuenow"),
          max: bar.getAttribute("aria-valuemax"),
          spoken: bar.getAttribute("aria-valuetext"),
          shown: bar.querySelector('[aria-hidden="true"]')?.textContent ?? null,
          segmented: bar.querySelector("[data-segment]") !== null,
          shares: tracks.map((track) => {
            const fill = track.firstElementChild;
            const w = track.getBoundingClientRect().width;
            return { track: w, fill: fill ? fill.getBoundingClientRect().width : 0 };
          }),
        };
      });
    });

  // 1 + 2 on a faked clock (a context of its own): the demos' timers are run to their end
  // instead of waited out; the fills' own transitions still run, and are settled on.
  const { errors: clockErrors, bars } = await withClock(page, async (cp) => {
    const { errors: cpErrors } = collectErrors(cp, { filter: (text) => /progress/i.test(text) });
    await load({ on: cp });

    // 1. harness
    await settle(cp, { until: "started" }); // past the fill's own transition
    const harness = (await readBars(cp)).find((b) => b.name === "Indexing documents");
    if (!harness) fail.push("harness: no 'Indexing documents' bar in the section");
    else {
      if (harness.now !== "45" || harness.spoken !== "45%" || harness.shown !== "45%")
        fail.push(`harness: static bar ${JSON.stringify(harness)}, expected 45 / "45%" shown and spoken`);
      const [s] = harness.shares;
      if (!s || Math.abs(s.fill - s.track * 0.45) > 1) fail.push(`harness: static fill ${JSON.stringify(s)} is not 45% of its track`);
    }

    // 2. every determinate bar, once the timers settle: run them to the end (the pipeline
    // takes 20 ticks of 350ms, the slowest upload 25 of 300ms), then let the fills finish.
    await cp.clock.runFor(20_000);
    await cp
      .waitForFunction(
        () => document.querySelector('[data-sc="progress-pipeline"] [role="progressbar"]')?.getAttribute("aria-valuenow") === "5",
        null,
        { timeout: 5_000 },
      )
      .catch(() => fail.push("harness: the release pipeline is not at 5 of 5 after 20s of its timers"));
    await settle(cp);
    return { errors: cpErrors, bars: (await readBars(cp)).filter((b) => b.now !== null) };
  });
  errors.push(...clockErrors);
  if (bars.length < 10) fail.push(`harness: only ${bars.length} determinate bars found in the section`);
  for (const b of bars) {
    const label = `"${b.name}"`;
    if (!b.shown) {
      if (b.name !== "Quiet bar, name only") fail.push(`${label}: no visible value`);
    } else if (b.spoken !== b.shown && !b.spoken.startsWith(`${b.shown}, `)) {
      fail.push(`${label}: shows "${b.shown}" but says "${b.spoken}"`);
    }
    const now = Number(b.now);
    const max = Number(b.max);
    const percent = /^(\d+)\s?%$/.exec(b.shown ?? "");
    if (percent && Number(percent[1]) !== Math.floor((now / max) * 100 + 1e-9))
      fail.push(`${label}: shows ${b.shown} for ${now} of ${max}`);
    if (b.segmented) {
      const full = b.shares.filter((s) => s.track > 0 && Math.abs(s.fill - s.track) <= 1).length;
      if (b.shares.length !== max) fail.push(`${label}: ${b.shares.length} segments for max ${max}`);
      if (full !== Math.floor(now)) fail.push(`${label}: ${full} full segments for value ${now}`);
    } else {
      const [s] = b.shares;
      if (!s || Math.abs(s.fill - (s.track * now) / max) > 1)
        fail.push(`${label}: fill ${s?.fill.toFixed(1)} of ${s?.track.toFixed(1)} for ${now}/${max}`);
    }
  }

  await load();

  // 3 + 4. the indeterminate sweep, then the same under reduced motion
  const readSweep = () =>
    page.evaluate(async () => {
      const bar = document.querySelector('[data-sc="progress-indeterminate"]');
      const sweep = bar.querySelector(".r-feedback-progress-sweep");
      const track = sweep.parentElement;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const x0 = sweep.getBoundingClientRect().left;
      for (let i = 0; i < 10; i += 1) await frame();
      const x1 = sweep.getBoundingClientRect().left;
      const css = getComputedStyle(sweep);
      return {
        now: bar.getAttribute("aria-valuenow"),
        spoken: bar.getAttribute("aria-valuetext"),
        shown: bar.querySelector('[aria-hidden="true"]')?.textContent ?? null,
        animations: sweep.getAnimations().map((a) => a.animationName ?? a.constructor.name),
        name: css.animationName,
        mask: css.maskImage || css.webkitMaskImage,
        moved: Math.abs(x1 - x0),
        width: sweep.getBoundingClientRect().width,
        track: track.getBoundingClientRect().width,
      };
    });

  const moving = await readSweep();
  if (moving.now !== null) fail.push(`indeterminate: aria-valuenow ${moving.now}, expected none`);
  if (moving.spoken !== "In progress" || moving.shown !== "In progress")
    fail.push(`indeterminate: says "${moving.spoken}", shows "${moving.shown}", expected "In progress" for both`);
  if (!moving.animations.includes("r-feedback-progress-sweep")) fail.push(`indeterminate: animations ${JSON.stringify(moving.animations)}, expected the sweep`);
  if (!(moving.moved > 0.5)) fail.push(`indeterminate: the sweep did not move over 10 frames (${moving.moved}px)`);

  await load({ reduced: true });
  const still = await readSweep();
  if (still.animations.length !== 0 || still.name !== "none")
    fail.push(`reduced motion: the sweep still animates (${JSON.stringify(still.animations)}, animation-name ${still.name})`);
  if (still.moved !== 0) fail.push(`reduced motion: the sweep moved ${still.moved}px`);
  if (Math.abs(still.width - still.track) > 1) fail.push(`reduced motion: the stripes span ${still.width} of a ${still.track}px track`);
  if (!still.mask || still.mask === "none") fail.push("reduced motion: no striped mask on the still fill");
  if (still.spoken !== "In progress" || still.shown !== "In progress") fail.push(`reduced motion: says "${still.spoken}", shows "${still.shown}"`);

  // 5. the sticky Banner on its scroller's edge
  await openSection(page, "feedback-banner", { view: { theme: "default", density: "comfortable", input: "fine" } });
  const sticky = await page.evaluate(() => {
    const scroller = document.querySelector('[data-sc="banner-sticky"]');
    scroller.scrollIntoView({ block: "center" });
    scroller.scrollTop = scroller.scrollHeight;
    const band = scroller.querySelector('[role="region"]');
    const probe = document.createElement("div");
    probe.style.zIndex = "var(--LAYER-STICKY)";
    probe.style.position = "relative";
    scroller.appendChild(probe);
    const layer = getComputedStyle(probe).zIndex;
    probe.remove();
    return {
      scrolled: scroller.scrollTop,
      gap: band.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop,
      z: getComputedStyle(band).zIndex,
      layer,
    };
  });
  if (!(sticky.scrolled > 0)) fail.push(`sticky harness: the scroller did not scroll (${sticky.scrolled})`);
  if (Math.abs(sticky.gap) > 1) fail.push(`sticky: the band is ${sticky.gap}px from its scroller's top edge`);
  if (sticky.layer === "auto" || sticky.z !== sticky.layer) fail.push(`sticky: z-index ${sticky.z}, the sticky layer is ${sticky.layer}`);

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`feedback FAILED:\n  ${fail.join("\n  ")}`);
  return `feedback OK ${bars.length} determinate bars show what they say and fill their share; the sweep moves ${moving.moved.toFixed(1)}px in 10 frames, and under reduced motion stands still, striped, across the track; sticky band on its scroller's edge at z ${sticky.z}`;
}
