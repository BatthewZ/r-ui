// Prepended to every browser check by `scripts/browser-check.mjs` (inside the
// check's own `async (page) => …` scope), so each script can call it by name.

/**
 * Waits until the showcase page the URL hash names has committed everything it
 * suspends on: the shell sets `<html data-showcase-ready="<page>">` once the
 * page's chunk (and, for the Overview, every section's) has rendered. A cold dev
 * server compiles a page's modules on its first visit, far past an action's
 * default timeout, so every check waits here after a load or a page change
 * instead of on an element of its own with a timeout of its own.
 */
async function waitForShowcase(page, { timeout = 30_000 } = {}) {
  await page.waitForFunction(
    () => {
      const wanted = location.hash.replace(/^#\/?/, "").split("/")[0] || "overview";
      return document.documentElement.dataset.showcaseReady === wanted;
    },
    null,
    { timeout },
  );
}
