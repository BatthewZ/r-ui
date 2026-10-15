// Prepended to every browser check by `scripts/browser-check.mjs` (inside the
// check's own `async (page) => …` scope), so each script can call these by name.

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

/** The showcase's View key (`STORAGE_KEY` in showcase/shell/view.ts). */
const SHOWCASE_VIEW_KEY = "r-ui-showcase:view";
/** The viewport `browser-check.mjs` opens the session at, restored after every check. */
const SHOWCASE_VIEWPORT = { width: 1280, height: 900 };

/**
 * The showcase's themes, as the app lists them (`THEMES` in
 * showcase/shell/view.ts, published on `<html data-showcase-themes>`), each
 * read under itself: `dark` from `--SCHEME-DARK`, and the first family of its
 * UI face (`--FONT-UI`) and of its display face (`--FONT-DISPLAY`, else
 * `--FONT-HEADING`, else the UI face). A check picks a theme by what it is
 * ("a dark theme", "a theme whose headings take another face"), never by an
 * example theme's name. Read it before emulating forced colours: under them
 * `--SCHEME-DARK` follows the forced palette.
 */
async function showcaseThemes(page) {
  const themes = await page.evaluate(() => {
    const root = document.documentElement;
    const names = (root.dataset.showcaseThemes ?? "").split(/\s+/).filter(Boolean);
    const saved = root.getAttribute("data-theme");
    const first = (stack) => stack.split(",")[0].replace(/["']/g, "").trim();
    try {
      return names.map((name) => {
        root.setAttribute("data-theme", name);
        const css = getComputedStyle(root);
        const read = (token) => css.getPropertyValue(token).trim();
        const ui = read("--FONT-UI");
        return {
          name,
          dark: Number(read("--SCHEME-DARK")) >= 1,
          ui: first(ui),
          display: first(read("--FONT-DISPLAY") || read("--FONT-HEADING") || ui),
        };
      });
    } finally {
      if (saved === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", saved);
    }
  });
  if (themes.length < 2) throw new Error(`harness: <html data-showcase-themes> lists ${themes.length} theme(s); the showcase ships several`);
  return themes;
}

/** The first dark theme the showcase lists. */
async function darkTheme(page) {
  const dark = (await showcaseThemes(page)).find((t) => t.dark);
  if (!dark) throw new Error("harness: the showcase lists no theme with --SCHEME-DARK: 1");
  return dark.name;
}

const errorCollectors = [];

/**
 * Collects console errors and uncaught page errors from now until `stop()`
 * (or until the check ends: the harness stops any still listening). `filter`
 * keeps only the texts a check owns.
 */
function collectErrors(page, { filter = () => true } = {}) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error" && filter(msg.text())) errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => {
    if (filter(`${err.message}\n${err.stack ?? ""}`)) errors.push(`pageerror: ${err.message}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  const stop = () => {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  };
  errorCollectors.push(stop);
  return { errors, stop };
}

/**
 * Puts the session back the way `browser-check.mjs` opened it, pass or fail, so
 * a check that throws halfway cannot hand its View, emulation or viewport to the
 * next: no stored `r-ui-showcase:*` state, no emulated media, the default
 * viewport, and a fresh load of `home` (which drops `<html>`'s View attributes
 * and anything left open). The harness calls it after every check.
 */
async function resetShowcase(page, home) {
  for (const stop of errorCollectors.splice(0)) stop();
  // No `URL` global in run-code's scope: compare origins as text.
  const origin = (url) => /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(url)?.[0];
  if (origin(page.url()) !== origin(home)) await page.goto(home, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("r-ui-showcase:")) localStorage.removeItem(key);
  });
  await page.emulateMedia({ media: null, colorScheme: null, reducedMotion: null, forcedColors: null });
  await page.setViewportSize(SHOWCASE_VIEWPORT);
  await page.goto(home);
}
