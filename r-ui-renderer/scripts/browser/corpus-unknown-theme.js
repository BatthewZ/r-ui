// @covers corpus, theme
// @cost   45
//
// Browser check: a host theme the stylesheet has never heard of still renders
// every document, exactly as the default theme does.
//
// The theme is the host's axis (`<html data-theme>`); a document never names
// one. With an invented name, no theme rule matches and the contract's own
// defaults apply. For each corpus document at `?view=<name>&theme=aurora`:
//   1. `<html data-theme="aurora">` is set (the route applied the axis);
//   2. not one renderer diagnostic in the page;
//   3. the page's canvas and ink are the default theme's, read on the same
//      document without the theme (so "renders" means "readable", not "no throw"),
//      and the canvas and the ink differ.
async (page) => {
  const THEME = "aurora";
  const problems = [];
  const colours = () =>
    page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const clear = (colour) => colour === "transparent" || /^rgba\(.*,\s*0\)$/.test(colour);
      // The canvas is painted on <body> or, failing that, on <html>.
      const canvas = clear(body.backgroundColor) ? getComputedStyle(document.documentElement).backgroundColor : body.backgroundColor;
      return { canvas, ink: body.color, theme: document.documentElement.getAttribute("data-theme") };
    });

  for (const name of CORPUS_NAMES) {
    await openView(page, name);
    const reference = await colours();
    await openView(page, name, { theme: THEME });
    const seen = await colours();

    if (seen.theme !== THEME) problems.push(`${name}: <html data-theme> is ${JSON.stringify(seen.theme)}, not "${THEME}"`);
    problems.push(...(await diagnosticProblems(page, name)));
    if (seen.canvas !== reference.canvas || seen.ink !== reference.ink) {
      problems.push(`${name}: canvas/ink ${seen.canvas} / ${seen.ink} under "${THEME}", ${reference.canvas} / ${reference.ink} by default`);
    }
    if (seen.canvas === seen.ink) problems.push(`${name}: the ink is the canvas colour (${seen.ink})`);
  }

  return report(problems, `${CORPUS_NAMES.length} documents under an unknown theme: no diagnostic, the default canvas and ink`);
};
