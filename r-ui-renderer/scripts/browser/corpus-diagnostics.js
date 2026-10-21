// @covers corpus
// @cost   45
//
// Browser check: every corpus document renders in a real browser, in the
// default theme, with nothing wrong anywhere in the page.
//
// For each product and coverage document, loaded fresh at `?view=<name>` and
// read once `<html data-renderer-ready>` is set:
//   1. not one renderer diagnostic in `document.body` (overlays render outside
//      the view);
//   2. no console error and no uncaught error while it loaded and settled
//      (React's development build reports bad nesting and duplicate keys there);
//      the one image the media document shows as missing may 404;
//   3. the view rendered something: one view root, with text, taller than a row.
async (page) => {
  const problems = [];
  // The media document shows an image that does not exist, to show Image's fallback.
  const expectedMissing = (text, url) => url.includes("/fixtures/img/missing-photo.svg") || /missing-photo\.svg/.test(text);

  for (const name of CORPUS_NAMES) {
    const { errors, stop } = collectErrors(page, { ignore: (text, url) => expectedMissing(text, url) });
    await openView(page, name);
    await frames(page);
    stop();

    problems.push(...(await diagnosticProblems(page, name)));
    for (const error of errors) problems.push(`${name}: ${error}`);

    const view = await page.evaluate(() => {
      const roots = document.querySelectorAll(".r-renderer-view");
      const root = roots[0];
      return { roots: roots.length, text: (root?.textContent ?? "").trim().length, height: root ? root.getBoundingClientRect().height : 0 };
    });
    if (view.roots !== 1) problems.push(`${name}: ${view.roots} view roots, expected 1`);
    else if (view.text === 0 || view.height < 40) problems.push(`${name}: the view is empty (${view.text} characters, ${Math.round(view.height)}px tall)`);
  }

  return report(problems, `${CORPUS_NAMES.length} documents, no diagnostic and no console error in any`);
};
