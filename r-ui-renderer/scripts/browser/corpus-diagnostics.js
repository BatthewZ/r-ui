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
// Then the positive control: each control document, loaded the same way, shows
// exactly the diagnostics it declares (`CORPUS.controls`), so the probe that
// found none in the corpus is proven to find one when there is one.
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

    const view = await page.evaluate((selector) => {
      const roots = document.querySelectorAll(selector);
      const root = roots[0];
      return { roots: roots.length, text: (root?.textContent ?? "").trim().length, height: root ? root.getBoundingClientRect().height : 0 };
    }, VIEW_SELECTOR);
    if (view.roots !== 1) problems.push(`${name}: ${view.roots} view roots, expected 1`);
    else if (view.text === 0 || view.height < 40) problems.push(`${name}: the view is empty (${view.text} characters, ${Math.round(view.height)}px tall)`);
  }

  const declared = CONTROL_NAMES.filter((name) => CORPUS.controls[name].length > 0);
  if (declared.length === 0) throw new Error("harness: no control document declares a diagnostic; nothing proves the probe can see one");
  for (const name of declared) {
    await openView(page, name);
    await frames(page);
    const found = (await diagnostics(page)).map((d) => d.code);
    const expected = CORPUS.controls[name];
    if (JSON.stringify(found) !== JSON.stringify(expected)) {
      problems.push(`control ${name}: found diagnostics ${JSON.stringify(found)}, it declares ${JSON.stringify(expected)}`);
    }
  }

  return report(problems, `${CORPUS_NAMES.length} documents, no diagnostic and no console error in any; ${declared.length} control(s) showed theirs`);
};
