// @covers theme, corpus
// @cost   6
//
// Browser check: a palette below the contrast floors never paints, not for one
// frame, and the refusal is in the DOM.
//
// On the control document `refused-theme` (pale text on a pink canvas), with
// a watcher served first in <head> that records, from the first script on,
// the view root's canvas role and painted background at every change to its
// style or class, what each change replaced (so a value set and undone within
// one task is seen too), and every animation frame until the page settles:
//   1. the watcher saw the view root (it is not blind);
//   2. not one record carries the document's canvas, as a role, as an inline
//      value or as paint, and the root was never marked themed;
//   3. the page shows exactly the diagnostics the document declares (the
//      refusal), at the role that fails, naming both roles and a ratio.
async (page) => {
  const NAME = "refused-theme";
  const CANVAS = "oklch(0.965 0.03 350)";
  const problems = [];

  const WATCH = `<script>(() => {
    const seen = (window.__themeFrames = []);
    const record = (when) => {
      const root = document.querySelector(${JSON.stringify(VIEW_SELECTOR)});
      if (root === null) return;
      const style = getComputedStyle(root);
      seen.push({ when, canvas: style.getPropertyValue("--C-CANVAS").trim(), background: style.backgroundColor, themed: root.classList.contains(${JSON.stringify(THEMED_CLASS)}) });
    };
    const view = ${JSON.stringify(VIEW_SELECTOR)};
    new MutationObserver((mutations) => {
      // What the root carried before each change, even one undone before the observer ran.
      for (const { target, attributeName, oldValue } of mutations) {
        if (attributeName !== null && target instanceof Element && target.matches(view)) seen.push({ when: "replaced", canvas: oldValue ?? "", background: "", themed: (oldValue ?? "").split(/\s+/).includes(${JSON.stringify(THEMED_CLASS)}) });
      }
      record("mutation");
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ["style", "class"] });
    const frame = () => {
      record("frame");
      if (!document.documentElement.hasAttribute("data-renderer-ready")) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })();</script>`;
  const servesView = (url) => url.searchParams.get("view") === NAME;
  const watch = async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace("<head>", `<head>${WATCH}`) });
  };
  await page.route(servesView, watch);
  try {
    await openView(page, NAME);
  } finally {
    await page.unroute(servesView, watch);
  }

  // The painted canvas, as this browser computes the document's value.
  const painted = await page.evaluate((colour) => {
    const probe = document.createElement("span");
    probe.style.color = colour;
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  }, CANVAS);
  const records = await page.evaluate(() => window.__themeFrames ?? null);

  // 1. not blind
  if (!Array.isArray(records) || records.length === 0) throw new Error("harness: the watcher recorded no view root");

  // 2. never painted
  const leaks = records.filter((record) => record.canvas.includes(CANVAS) || record.background === painted || record.themed);
  if (leaks.length > 0) problems.push(`the refused palette reached the view in ${leaks.length} of ${records.length} records, first at a ${leaks[0].when}: ${JSON.stringify(leaks[0])}`);

  // 3. reported
  const found = await diagnostics(page);
  if (JSON.stringify(found.map((d) => d.code)) !== JSON.stringify(CORPUS.controls[NAME])) {
    problems.push(`diagnostics ${JSON.stringify(found.map((d) => d.code))}, the document declares ${JSON.stringify(CORPUS.controls[NAME])}`);
  }
  const refusal = found.find((d) => d.code === "theme-contrast");
  if (refusal !== undefined) {
    if (refusal.path !== "/theme/tokens/--C-TEXT-PRIMARY") problems.push(`the refusal is reported at ${refusal.path}, not at --C-TEXT-PRIMARY`);
    if (!/`--C-TEXT-PRIMARY` on `--C-[A-Z0-9-]+` is \d+\.\d\d:1/.test(refusal.text)) problems.push(`the refusal does not name both roles and a ratio: ${refusal.text}`);
  }

  return report(problems, `${records.length} records of the view root, none with the refused palette; refused at ${refusal?.path}`);
};
