// @covers playground, harness
// @cost   5
//
// Browser check: a route the playground cannot show still settles and says
// why on <html>, so a check fails on what it sees instead of on a timeout.
//   1. `?view=<no such document>` settles (`data-renderer-ready`) with
//      `data-renderer-error="unknown-view"`, shows an alert and no view root;
//   2. a bad parameter (`density=roomy`) settles with `data-renderer-error="invalid-route"`;
//   3. the prelude's `waitForReady` refuses both, naming the code;
//   4. a good route after them settles with no error marker.
async (page) => {
  const problems = [];
  const markers = () =>
    page.evaluate((view) => {
      const root = document.documentElement;
      return {
        ready: root.hasAttribute("data-renderer-ready"),
        error: root.getAttribute("data-renderer-error"),
        alert: document.querySelector('[role="alert"]') !== null,
        views: document.querySelectorAll(view).length,
      };
    }, VIEW_SELECTOR);

  for (const [label, url, code] of [
    ["an unknown document", viewUrl("no-such-document"), "unknown-view"],
    ["a bad parameter", viewUrl("ops-dashboard", { density: "roomy" }), "invalid-route"],
  ]) {
    await page.goto("about:blank");
    await page.goto(url);
    // 3. the harness refuses it, by its code
    const refusal = await waitForReady(page, { timeout: 10_000 }).then(
      () => "accepted",
      (error) => error.message,
    );
    if (!refusal.includes(`refused the route: ${code}`)) problems.push(`${label}: waitForReady said ${JSON.stringify(refusal)}, not a refusal naming ${code}`);
    // 1, 2. settled, marked, explained
    const seen = await markers();
    if (!seen.ready) problems.push(`${label}: never settled`);
    if (seen.error !== code) problems.push(`${label}: data-renderer-error is ${JSON.stringify(seen.error)}, not "${code}"`);
    if (!seen.alert) problems.push(`${label}: no alert says why`);
    if (seen.views !== 0) problems.push(`${label}: ${seen.views} view root(s) rendered`);
  }

  // 4. the markers do not outlive their page
  await openView(page, "release-notes");
  const good = await markers();
  if (good.error !== null || good.views !== 1) problems.push(`a good route after them: error ${JSON.stringify(good.error)}, ${good.views} view root(s)`);

  return report(problems, "unknown-view and invalid-route settle, mark <html> and stop the harness; a good route after them is clean");
};
