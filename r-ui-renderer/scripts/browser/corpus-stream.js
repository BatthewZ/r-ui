// @covers stream, corpus
// @flags  timing
// @cost   25
//
// Browser check: a dashboard streamed through the parser, one push per real
// animation frame (`?view=ops-dashboard&stream=96`), builds up in place.
//
// A probe installed before the page's own scripts samples the view on every
// frame until `<html data-renderer-ready>`. It asserts:
//   1. progressive: content shows on many frames before the document is
//      complete, and the page heading is seen part-written (text streams in);
//   2. no remount: the view root is one element from its first frame to the
//      last, and every anchor seen on the way (headings, tables, figures) is
//      still in the page at the end, the same element;
//   3. no flash: the view's text never drops below nine tenths of the most it
//      has shown (an unmount and remount would blank it for a frame);
//   4. no diagnostic on any frame (a half-written prop never reaches a component);
//   5. the settled page is the page `?view=ops-dashboard` renders whole: the same text.
// The probe runs only while a sessionStorage key this check sets is present,
// and is disposed of at the end where Playwright supports it.
async (page) => {
  const NAME = "ops-dashboard";
  const KEY = "corpus-stream-probe";
  const problems = [];

  const probe = await page.addInitScript((key) => {
    if (sessionStorage.getItem(key) === null) return;
    const seen = { frames: [], anchors: [], roots: [], headings: new Set(), diagnostics: 0, done: false };
    window.__corpusStreamProbe = seen;
    const sample = () => {
      const root = document.querySelector(".r-renderer-view");
      if (root && !seen.roots.includes(root)) seen.roots.push(root);
      const ready = document.documentElement.hasAttribute("data-renderer-ready");
      seen.frames.push({ text: root ? root.textContent.length : 0, ready, views: document.querySelectorAll(".r-renderer-view").length });
      seen.diagnostics = Math.max(seen.diagnostics, document.querySelectorAll(".r-renderer-diagnostic").length);
      if (root) {
        for (const anchor of root.querySelectorAll("h1, h2, table, [role=figure], figure")) {
          if (!seen.anchors.includes(anchor)) seen.anchors.push(anchor);
        }
        const h1 = root.querySelector("h1");
        if (h1) seen.headings.add(h1.textContent);
      }
      const settled = seen.frames.filter((f) => f.ready).length;
      if (settled >= 3) seen.done = true;
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, KEY);

  try {
    // Set the probe's key on the playground's origin, then load the streamed view in the same tab.
    await page.goto("about:blank");
    await page.goto(`${BROWSER_CHECK_HOME}?view=__probe__`);
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), KEY);
    await page.goto(viewUrl(NAME, { stream: 96 }));
    await waitForReady(page, { timeout: 60_000 });
    await page.waitForFunction(() => window.__corpusStreamProbe?.done === true, null, { timeout: 5_000 });

    const result = await page.evaluate(() => {
      const seen = window.__corpusStreamProbe;
      const root = document.querySelector(".r-renderer-view");
      const final = root ? root.textContent.length : 0;
      let most = 0;
      const drops = [];
      seen.frames.forEach((frame, index) => {
        if (frame.text < most * 0.9) drops.push(`frame ${index}: ${frame.text} characters after ${most}`);
        most = Math.max(most, frame.text);
      });
      return {
        frames: seen.frames.length,
        partialFrames: seen.frames.filter((f) => !f.ready && f.text > 0 && f.text < final).length,
        manyViews: seen.frames.filter((f) => f.views > 1).length,
        roots: seen.roots.length,
        sameRoot: seen.roots[0] === root,
        anchors: seen.anchors.length,
        lost: seen.anchors.filter((a) => !a.isConnected).map((a) => `${a.tagName.toLowerCase()} "${(a.textContent ?? "").trim().slice(0, 40)}"`),
        headings: [...seen.headings],
        drops,
        diagnostics: seen.diagnostics,
        text: (root?.innerText ?? "").replace(/\s+/g, " ").trim(),
      };
    });

    // 1. progressive
    const title = "Production operations";
    if (result.partialFrames < 10) problems.push(`only ${result.partialFrames} frames showed part of the document (of ${result.frames})`);
    if (!result.headings.some((h) => h.length > 0 && h.length < title.length && title.startsWith(h))) {
      problems.push(`the heading was never seen part-written: ${JSON.stringify(result.headings.slice(0, 5))}`);
    }
    // 2. no remount
    if (result.roots !== 1 || !result.sameRoot) problems.push(`the view root was replaced (${result.roots} roots seen)`);
    if (result.manyViews > 0) problems.push(`${result.manyViews} frames showed more than one view root`);
    if (result.anchors < 5) problems.push(`harness: only ${result.anchors} anchors seen; the probe is not watching the view`);
    for (const lost of result.lost) problems.push(`remounted: ${lost} left the page while the document streamed`);
    // 3. no flash
    for (const drop of result.drops.slice(0, 5)) problems.push(`the view's text dropped: ${drop}`);
    // 4. no diagnostic on any frame
    if (result.diagnostics > 0) problems.push(`a frame showed ${result.diagnostics} diagnostic(s)`);

    // 5. the same page as the whole document
    await openView(page, NAME);
    const whole = await page.evaluate(() => (document.querySelector(".r-renderer-view")?.innerText ?? "").replace(/\s+/g, " ").trim());
    if (whole !== result.text) {
      const at = [...whole].findIndex((c, i) => c !== result.text[i]);
      problems.push(`the streamed page differs from the whole one at character ${at}: …${result.text.slice(at, at + 60)}… vs …${whole.slice(at, at + 60)}…`);
    }

    return report(problems, `${result.frames} frames, ${result.partialFrames} partial, ${result.anchors} anchors kept, heading seen ${result.headings.length} ways`);
  } finally {
    // Back on the playground's origin (a failure may have left the tab elsewhere) to take the key away.
    await page.goto(`${BROWSER_CHECK_HOME}?view=__probe__`);
    await page.evaluate((key) => sessionStorage.removeItem(key), KEY);
    if (typeof probe?.dispose === "function") await probe.dispose();
  }
};
