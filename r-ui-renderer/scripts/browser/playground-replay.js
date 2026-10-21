// @covers playground, stream
// @cost   15
//
// Browser check: "Replay stream" mounts a fresh view exactly once, and the
// replay then builds up in that one view.
//
// A replay is a new view (its state, forms and requests start over), so the
// playground keys it: the view in the preview is replaced on the click, once,
// and never again while the text streams in. On `/` with ops-dashboard chosen
// and 256 characters a frame, a probe samples the preview on every frame from
// before the click until the replay has settled. For each of two replays:
//   1. exactly one new view root appeared, the old one left the page, and the
//      settled view is that new root;
//   2. no frame showed two view roots in the preview;
//   3. the replay streamed: many frames showed the new view part-built
//      before it settled.
async (page) => {
  const problems = [];
  await page.goto("about:blank");
  await page.goto(BROWSER_CHECK_HOME);
  await waitForReady(page);
  await page.getByLabel("Document").selectOption("ops-dashboard");
  await page.getByLabel("Replay speed").selectOption("256");
  const preview = page.getByRole("region", { name: "Preview" });
  await preview.getByRole("table", { name: "Production services" }).waitFor({ timeout: 10_000 });
  await waitForReady(page);

  const replayOnce = async () => {
    await page.evaluate((view) => {
      const region = document.querySelector('[aria-label="Preview"]');
      const before = region.querySelector(view);
      const probe = { before, roots: [], frames: [], readyRun: 0, sawPending: false, done: false };
      window.__replayProbe = probe;
      const sample = () => {
        const all = region.querySelectorAll(view);
        const root = all[0] ?? null;
        if (root && root !== before && !probe.roots.includes(root)) probe.roots.push(root);
        const ready = document.documentElement.hasAttribute("data-renderer-ready");
        if (!ready) probe.sawPending = true;
        probe.readyRun = ready && probe.sawPending ? probe.readyRun + 1 : 0;
        probe.frames.push({ views: all.length, text: root ? root.textContent.length : 0, ready, fresh: root !== null && root !== before });
        if (probe.readyRun >= 3 || probe.frames.length > 3_000) probe.done = true;
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, VIEW_SELECTOR);
    await page.getByRole("button", { name: "Replay stream" }).click();
    await page.waitForFunction(() => window.__replayProbe?.done === true, null, { timeout: 60_000 });
    return page.evaluate((view) => {
      const probe = window.__replayProbe;
      const now = document.querySelector('[aria-label="Preview"]').querySelector(view);
      return {
        frames: probe.frames.length,
        settled: probe.readyRun >= 3,
        newRoots: probe.roots.length,
        beforeGone: probe.before !== null && !probe.before.isConnected,
        settledOnNew: now !== null && now === probe.roots[0],
        manyViews: probe.frames.filter((frame) => frame.views > 1).length,
        partial: probe.frames.filter((frame) => frame.fresh && !frame.ready && frame.text > 0).length,
      };
    }, VIEW_SELECTOR);
  };

  for (const run of [1, 2]) {
    const seen = await replayOnce();
    const label = `replay ${run}`;
    if (!seen.settled) problems.push(`${label}: never settled in ${seen.frames} frames`);
    if (seen.newRoots !== 1) problems.push(`${label}: ${seen.newRoots} new view roots mounted, expected 1`);
    if (!seen.beforeGone) problems.push(`${label}: the view from before the click is still in the page`);
    if (!seen.settledOnNew) problems.push(`${label}: the settled view is not the one the click mounted`);
    if (seen.manyViews > 0) problems.push(`${label}: ${seen.manyViews} frame(s) showed two view roots`);
    if (seen.partial < 10) problems.push(`${label}: only ${seen.partial} frames showed the view part-built; it did not stream`);
  }

  problems.push(...(await diagnosticProblems(page)));
  return report(problems, "each replay mounted one fresh view and streamed into it");
};
