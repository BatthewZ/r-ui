// Browser check: a theme that names web faces gets them, and a theme that does not pays nothing.
//
// Run it through `bun run browser:check fonts`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print theme-fonts)"
//
// The showcase loads web faces in its own CSS (`showcase/fonts.css`); a theme only
// names them. The theme under test is found, not named: the first the showcase lists
// whose UI or display face is one the app declares (`@font-face`). Asserts, on the
// Marketing page:
//   1. harness: the View's theme reaches <html data-theme>; the app declares some
//      face, some listed theme names one, and the default theme names none;
//   2. that theme: after `document.fonts.ready` each declared face it names is LOADED
//      (`document.fonts.check` alone is not proof: it is also true when no face is
//      declared), body text resolves to its UI face and the hero heading to its
//      display face;
//   3. default: no declared face is downloaded (the browser fetches a face only when
//      something renders in it, so a theme that names system faces costs nothing).
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const problems = [];

  /** A fresh document in `theme`, so faces an earlier load fetched are not in its set. */
  const measure = async (theme) => {
    await page.goto(`${base}#/marketing`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, { theme, density: "comfortable", input: "fine" }]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("main h1").first().waitFor();
    return page.evaluate(async () => {
      await document.fonts.ready;
      const family = (f) => f.family.replace(/["']/g, "");
      const first = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null);
      return {
        theme: document.documentElement.dataset.theme ?? "default",
        declared: [...new Set([...document.fonts].map(family))],
        loaded: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map(family))],
        body: first(document.body),
        heading: first(document.querySelector("main h1")),
      };
    });
  };

  const themes = await showcaseThemes(page);
  const plain = await measure("default");
  if (plain.theme !== "default") problems.push(`harness: <html data-theme> is "${plain.theme}", the View set the default`);
  if (plain.declared.length === 0) problems.push("harness: the app declares no @font-face, so nothing here proves loading");
  const declared = new Set(plain.declared);
  const names = (t) => [...new Set([t.ui, t.display])].filter((f) => declared.has(f));
  const fallback = themes.find((t) => t.name === "default");
  if (!fallback || names(fallback).length) problems.push(`harness: the default theme names declared face(s) ${fallback && names(fallback).join(", ")}`);
  const downloaded = plain.loaded.filter((f) => declared.has(f));
  if (downloaded.length) problems.push(`default: downloaded ${downloaded.join(" and ")}, which it never names`);

  const web = themes.find((t) => t.name !== "default" && names(t).length > 0);
  if (!web) problems.push(`harness: no listed theme (${themes.map((t) => t.name).join(", ")}) names a face the app declares`);
  else {
    const m = await measure(web.name);
    if (m.theme !== web.name) problems.push(`harness: <html data-theme> is "${m.theme}", the View set "${web.name}"`);
    for (const face of names(web)) if (!m.loaded.includes(face)) problems.push(`${web.name}: names ${face}, but no ${face} face loaded`);
    if (m.body !== web.ui) problems.push(`${web.name}: body text is "${m.body}", expected its UI face ${web.ui}`);
    if (m.heading !== web.display) problems.push(`${web.name}: the hero heading is "${m.heading}", expected its display face ${web.display}`);
  }

  if (problems.length) throw new Error(`theme-fonts FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `theme-fonts OK (${web.name}: ${names(web).join(" + ")} loaded, body ${web.ui}, heading ${web.display}; default: none downloaded)`;
}
