// Browser check: ProgressBar's value and its motion, which jsdom cannot paint.
//
// Run it through `bun run browser:check feedback-progress`.
//
// Asserts, on the Overview's ProgressBar section (`#feedback-progressbar`):
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
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /progress/i.test(text) });

  const load = async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}#/overview/feedback-progressbar`);
    await page.evaluate(
      ([key, view]) => localStorage.setItem(key, JSON.stringify(view)),
      [SHOWCASE_VIEW_KEY, { theme: "default", density: "comfortable", input: "fine" }],
    );
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-sc="progress-static"]').waitFor();
    await page.locator('[data-sc="progress-static"]').scrollIntoViewIfNeeded();
  };

  /** The bar's own facts: what it says, what it shows, how much of each track is filled. */
  const readBars = () =>
    page.evaluate(() => {
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

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await load();

  // 1. harness
  await page.waitForTimeout(400); // past the fill's own transition
  const harness = (await readBars()).find((b) => b.name === "Indexing documents");
  if (!harness) fail.push("harness: no 'Indexing documents' bar in the section");
  else {
    if (harness.now !== "45" || harness.spoken !== "45%" || harness.shown !== "45%")
      fail.push(`harness: static bar ${JSON.stringify(harness)}, expected 45 / "45%" shown and spoken`);
    const [s] = harness.shares;
    if (!s || Math.abs(s.fill - s.track * 0.45) > 1) fail.push(`harness: static fill ${JSON.stringify(s)} is not 45% of its track`);
  }

  // 2. every determinate bar, once the timers settle
  await page.waitForFunction(
    () => document.querySelector('[data-sc="progress-pipeline"] [role="progressbar"]')?.getAttribute("aria-valuenow") === "5",
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(2500); // the slowest upload, then its transition
  const bars = (await readBars()).filter((b) => b.now !== null);
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

  await page.emulateMedia({ reducedMotion: "reduce" });
  await load();
  const still = await readSweep();
  await page.emulateMedia({ reducedMotion: null });
  if (still.animations.length !== 0 || still.name !== "none")
    fail.push(`reduced motion: the sweep still animates (${JSON.stringify(still.animations)}, animation-name ${still.name})`);
  if (still.moved !== 0) fail.push(`reduced motion: the sweep moved ${still.moved}px`);
  if (Math.abs(still.width - still.track) > 1) fail.push(`reduced motion: the stripes span ${still.width} of a ${still.track}px track`);
  if (!still.mask || still.mask === "none") fail.push("reduced motion: no striped mask on the still fill");
  if (still.spoken !== "In progress" || still.shown !== "In progress") fail.push(`reduced motion: says "${still.spoken}", shows "${still.shown}"`);

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`feedback-progress FAILED:\n  ${fail.join("\n  ")}`);
  return `feedback-progress OK ${bars.length} determinate bars show what they say and fill their share; the sweep moves ${moving.moved.toFixed(1)}px in 10 frames, and under reduced motion stands still, striped, across the track`;
}
