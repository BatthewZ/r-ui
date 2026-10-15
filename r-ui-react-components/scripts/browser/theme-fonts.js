// Browser check: a theme that names web faces gets them, and a theme that does not pays nothing.
//
// Run it through `bun run browser:check fonts`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print theme-fonts)"
//
// The showcase loads the example faces in its own CSS (`showcase/fonts.css`); the
// atelier example theme only names them. Asserts, on the Marketing page:
//   1. harness: the View's theme reaches <html data-theme>;
//   2. atelier: after `document.fonts.ready` an "Inter Variable" and a
//      "Fraunces Variable" face are LOADED (`document.fonts.check` alone is not
//      proof: it is also true when no face is declared), body text resolves to
//      Inter and a heading to Fraunces;
//   3. default: neither face is downloaded (the browser fetches a face only when
//      something renders in it, so a theme that names system faces costs nothing).
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const problems = [];

  const measure = async (theme) => {
    await page.goto(`${base}#/marketing`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, { theme, density: "comfortable", input: "fine" }]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("main h1").first().waitFor();
    return page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = (family) => [...document.fonts].some((f) => f.family.replace(/"/g, "") === family && f.status === "loaded");
      const first = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "").trim() : null);
      return {
        theme: document.documentElement.dataset.theme ?? "default",
        inter: loaded("Inter Variable"),
        fraunces: loaded("Fraunces Variable"),
        body: first(document.body),
        heading: first(document.querySelector("main h1")),
      };
    });
  };

  let atelier;
  try {
    atelier = await measure("atelier");
    if (atelier.theme !== "atelier") problems.push(`harness: <html data-theme> is "${atelier.theme}", the View set "atelier"`);
    if (!atelier.inter) problems.push("atelier: no Inter Variable face loaded");
    if (!atelier.fraunces) problems.push("atelier: no Fraunces Variable face loaded");
    if (atelier.body !== "Inter Variable") problems.push(`atelier: body text is "${atelier.body}", expected Inter Variable`);
    if (atelier.heading !== "Fraunces Variable") problems.push(`atelier: the page heading is "${atelier.heading}", expected Fraunces Variable`);

    // A fresh document, so faces the atelier run loaded are not still in the set.
    const plain = await measure("default");
    if (plain.theme !== "default") problems.push(`harness: <html data-theme> is "${plain.theme}", the View set the default`);
    if (plain.inter || plain.fraunces) problems.push(`default: downloaded ${[plain.inter && "Inter", plain.fraunces && "Fraunces"].filter(Boolean).join(" and ")}, which it never names`);
  } finally {
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
  }

  if (problems.length) throw new Error(`theme-fonts FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `theme-fonts OK (atelier: Inter body + Fraunces headings loaded; default: neither downloaded)`;
}
