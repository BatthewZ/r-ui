// Prepended to every browser check by `scripts/browser-check.mjs` (inside the
// check's own `async (page) => …` scope), so each script can call these by name.

/**
 * Waits until the showcase page the URL hash names has committed everything it
 * suspends on: the shell sets `<html data-showcase-ready="<page>">` once the
 * page's chunk (and every section it shows) has rendered. A cold dev
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
  await profileLoad(page);
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

/** Where a check starts and the reset lands: the shell with no page in it, which loads no section. */
const SHOWCASE_BLANK = "#/blank";

/**
 * Puts the session back the way `browser-check.mjs` opened it, pass or fail, so
 * a check that throws halfway cannot hand its View, emulation or viewport to the
 * next: no stored `r-ui-showcase:*` state, no emulated media, the default
 * viewport, and a fresh document on the blank route (which drops `<html>`'s View
 * attributes and anything left open, and loads no page). The harness calls it
 * after every check.
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
  // A hash-only goto keeps the document; leaving it first makes the next one fresh.
  await page.goto("about:blank");
  await page.goto(`${home}${SHOWCASE_BLANK}`);
  await waitForShowcase(page);
}

/**
 * Waits until the page has settled after a load or a View change: two frames,
 * the fonts, and every finite animation on the document timeline finished
 * (spinners, marquees and scroll-driven timelines never finish, so they are not
 * waited for). Throws, naming them, if some are still running after `timeout`.
 * `until: "started"` waits only for the animations running when it is called,
 * for a demo whose own timers keep starting new ones (a simulated upload).
 */
async function settle(page, { timeout = 5_000, until = "quiet" } = {}) {
  if (until !== "quiet" && until !== "started") throw new Error(`harness: settle: until "${until}" is not "quiet" or "started"`);
  // Bounded: an evaluate has no timeout of its own, and a font that never lands or a frame that never comes would hang the run.
  const framed = await page.evaluate(
    (ms) =>
      Promise.race([
        document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))),
        new Promise((done) => setTimeout(() => done(document.fonts.status === "loading" ? "the fonts are still loading" : "no animation frame came"), ms)),
      ]),
    timeout,
  );
  if (framed) throw new Error(`harness: settle: ${framed} after ${timeout}ms`);
  // `started` tags the animations running now and then waits for those alone.
  const running = (tag) =>
    page.evaluate(
      ({ tag, onlyTagged }) =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" && a.timeline === document.timeline && Number.isFinite(a.effect?.getComputedTiming().endTime))
          .filter((a) => {
            if (tag) a.__settle = true;
            return !onlyTagged || a.__settle;
          })
          .map((a) => `${a.animationName ?? a.transitionProperty ?? a.constructor.name} on ${a.effect?.target?.className || a.effect?.target?.tagName}`),
      { tag, onlyTagged: until === "started" },
    );
  const deadline = Date.now() + timeout;
  let left = await running(until === "started");
  while (left.length > 0) {
    if (Date.now() > deadline) throw new Error(`harness: settle: still animating after ${timeout}ms: ${left.slice(0, 5).join("; ")}`);
    await page.waitForTimeout(50);
    left = await running(false);
  }
}

/**
 * Switches the View live, without a reload, the way a user does: theme, density
 * and input through the showcase's preference hooks (`window.__showcase`), `dir`
 * on `<html>`; `width` / `height` resize the viewport (the other side kept);
 * `reduced` / `forced` emulate reduced motion / forced colours. Give any
 * subset. Then waits for `settle` (`settle` is its `until`), and throws if
 * `<html>` does not show what was asked for.
 */
async function setView(page, { theme, density, input, dir, width, height, reduced, forced, settle: until = "quiet" } = {}) {
  if (width !== undefined || height !== undefined) {
    const now = page.viewportSize() ?? SHOWCASE_VIEWPORT;
    await page.setViewportSize({ width: width ?? now.width, height: height ?? now.height });
  }
  if (reduced !== undefined) await page.emulateMedia({ reducedMotion: reduced ? "reduce" : null });
  if (forced !== undefined) await page.emulateMedia({ forcedColors: forced ? "active" : null });
  const view = Object.fromEntries(Object.entries({ theme, density, input, dir }).filter(([, v]) => v !== undefined));
  if (Object.keys(view).length > 0) {
    const shown = await page.evaluate((view) => {
      if (!window.__showcase) throw new Error("harness: setView: the showcase publishes no window.__showcase");
      window.__showcase.setView(view);
      const root = document.documentElement;
      return {
        theme: root.dataset.theme ?? "default",
        density: root.dataset.density ?? "comfortable",
        input: root.dataset.input ?? "auto",
        dir: root.dir || "ltr",
      };
    }, view);
    const wrong = Object.keys(view).filter((axis) => shown[axis] !== view[axis]);
    if (wrong.length) throw new Error(`harness: setView asked for ${JSON.stringify(view)}, <html> shows ${JSON.stringify(shown)}`);
  }
  await settle(page, { until });
}

/**
 * Opens showcase sections by themselves, on a fresh document: `#/solo/<ids>`
 * renders only those sections (a group page's exact markup, their chunks only).
 * `ids` is one id or a list (`<group>-<file>`, as in `#/overview/<id>`). Before the load it sets
 * the viewport (`width`, `height`: 1280 × 900 unless given), reduced motion
 * and forced colours, and stores `view`
 * (theme, density, input) so the pre-paint script mounts the sections under it;
 * `view.dir` is applied live after. `runway` puts a viewport of page above and
 * below (a section that must start below the fold, or scroll away). `route:
 * "all"` opens the same ids among every other section (`#/all`) instead (also
 * forced for a whole run by `browser:check --all`, to prove a check equal on both).
 * Throws if any id rendered no section, or a section tripped its boundary.
 * Then settles (`settle` is its `until`). Returns the first section's locator.
 */
async function openSection(
  page,
  ids,
  { view = {}, width, height, reduced = false, forced = false, runway = false, settle: until = "quiet", route = BROWSER_CHECK_ROUTE } = {},
) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) throw new Error("harness: openSection needs at least one section id");
  const base = page.url().split("#")[0];
  const { dir, ...stored } = view;
  await page.setViewportSize({ width: width ?? SHOWCASE_VIEWPORT.width, height: height ?? SHOWCASE_VIEWPORT.height });
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : null, forcedColors: forced ? "active" : null });
  const hash = route === "all" ? `#/all/${list[0]}` : `#/solo/${list.join(",")}${runway ? "?runway" : ""}`;
  await page.goto(`${base}${hash}`);
  await page.evaluate(
    ({ key, stored }) => (Object.keys(stored).length ? localStorage.setItem(key, JSON.stringify(stored)) : localStorage.removeItem(key)),
    { key: SHOWCASE_VIEW_KEY, stored },
  );
  await page.reload();
  await waitForShowcase(page);
  if (route !== "all") await page.waitForFunction((want) => document.documentElement.dataset.showcaseSolo === want, list.join(","));
  const problems = await page.evaluate((list) => {
    const missing = list.filter((id) => !document.querySelector(`section.sc-section[id="${id}"]`));
    const tripped = list.filter((id) => document.querySelector(`section.sc-section[id="${id}"] [data-section-error]`));
    return [...missing.map((id) => `no section "${id}"`), ...tripped.map((id) => `section "${id}" threw`)];
  }, list);
  if (problems.length) throw new Error(`harness: openSection(${list.join(", ")}): ${problems.join("; ")}`);
  if (dir !== undefined) await setView(page, { dir, settle: until });
  else await settle(page, { until });
  return page.locator(`section.sc-section[id="${list[0]}"]`);
}

/**
 * Runs `fn(cp)` on a page of its own browser context whose clock is faked
 * (`cp.clock`, installed before the showcase loads), started on the blank route
 * at `viewport`; closes the context after, pass or fail. The clock flows with real
 * time until the check moves it: `cp.clock.runFor(ms)` fires at once every timer
 * due in the next `ms` (an autoplay interval, a simulated upload, a hover delay),
 * while frames and native animations keep running. Never use it where frames are
 * sampled: the fake `requestAnimationFrame` follows the fake clock, CSS does not.
 * A context of its own because a clock, once installed, stays for the context's
 * life, and the session's page runs every later check. Its storage starts empty.
 */
async function withClock(page, fn, { viewport = SHOWCASE_VIEWPORT, hasTouch = false } = {}) {
  const base = page.url().split("#")[0];
  const context = await page.context().browser().newContext({ viewport, hasTouch });
  try {
    const cp = await context.newPage();
    await cp.clock.install();
    await cp.goto(`${base}${SHOWCASE_BLANK}`);
    await waitForShowcase(cp);
    return await fn(cp);
  } finally {
    await context.close();
  }
}

/**
 * Opens a whole showcase page (`overview`, `all`, `dashboard`, `marketing`, `stress`, with
 * an optional `/anchor`) on a fresh document under `view` (theme, density, input;
 * `dir` applied live after) at `width` × `height` (1280 × 900 unless given), then
 * settles. The View is stored first and the document left for `about:blank`, so the
 * page mounts once, already under it.
 */
async function openPage(page, name, { view = {}, width, height, settle: until = "quiet" } = {}) {
  const base = page.url().split("#")[0];
  if (!/^https?:/.test(base)) throw new Error(`harness: openPage(${name}) from ${page.url()}: start on the showcase's origin`);
  const { dir, ...stored } = view;
  await page.setViewportSize({ width: width ?? SHOWCASE_VIEWPORT.width, height: height ?? SHOWCASE_VIEWPORT.height });
  await page.evaluate(
    ({ key, stored }) => (Object.keys(stored).length ? localStorage.setItem(key, JSON.stringify(stored)) : localStorage.removeItem(key)),
    { key: SHOWCASE_VIEW_KEY, stored },
  );
  await page.goto("about:blank");
  await page.goto(`${base}#/${name}`);
  await waitForShowcase(page);
  if (dir !== undefined) await setView(page, { dir, settle: until });
  else await settle(page, { until });
}

/**
 * The order a sweep walks its View matrix in: every theme × density × input at each
 * width, grouped by width, each `{ theme, density, input, width, fresh }`. A fresh
 * combination is opened on a new document; the rest are reached live (`setView`),
 * which is how a user switches and costs a fraction of a load. Fresh: the first
 * combination at each width, plus one per theme (at least four), laid out as an
 * orthogonal array over density, input and width so that both values of each mount
 * fresh in every run, which catches a fault only a mount under some value shows. The
 * array's rows are rotated by `BROWSER_CHECK_SEED` (one a day unless the runner is
 * given `--seed`), so successive runs mount different combinations fresh.
 */
function viewMatrix({ themes, widths, densities = ["comfortable", "compact"], inputs = ["fine", "coarse"], seed = BROWSER_CHECK_SEED }) {
  if (!themes?.length || !widths?.length) throw new Error("harness: viewMatrix needs themes and widths");
  // L4: three two-valued axes over four rows, every pair of values once.
  const L4 = [
    [0, 0, 0],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];
  const turn = Math.floor(seed / themes.length);
  const flips = [turn & 1, (turn >> 1) & 1, (turn >> 2) & 1];
  const key = (c) => `${c.theme}/${c.density}/${c.input}@${c.width}`;
  const fresh = new Set();
  for (let k = 0; k < Math.max(themes.length, L4.length); k++) {
    const [d, i, w] = L4[(k + turn) % L4.length].map((bit, axis) => bit ^ flips[axis]);
    fresh.add(
      key({
        theme: themes[(k + seed) % themes.length],
        density: densities[d % densities.length],
        input: inputs[i % inputs.length],
        width: widths[w % widths.length],
      }),
    );
  }
  const combos = [];
  for (const width of widths) {
    let first = true;
    for (const theme of themes) {
      for (const density of densities) {
        for (const input of inputs) {
          const combo = { theme, density, input, width };
          combos.push({ ...combo, fresh: first || fresh.has(key(combo)) });
          first = false;
        }
      }
    }
  }
  return combos;
}

/**
 * Walks `viewMatrix(matrix)`: a fresh combination through `load(view)` (which must
 * open a new document under that View and width), any other through `setView`
 * live; then `check(view, label)`. A label is `theme/density/input@width`, with
 * " (fresh)" after a load. Returns `{ combos, fresh }` (the count, and the fresh
 * labels, for the summary). Under `--profile` the three phases are timed apart.
 */
async function sweepViews(page, matrix, { load, check }) {
  const fresh = [];
  let combos = 0;
  for (const { fresh: isFresh, ...view } of viewMatrix(matrix)) {
    const label = `${view.theme}/${view.density}/${view.input}@${view.width}${isFresh ? " (fresh)" : ""}`;
    if (isFresh) {
      mark("sweep: fresh load");
      await load(view);
      fresh.push(label);
    } else {
      mark("sweep: live switch");
      await setView(page, view);
    }
    mark("sweep: check");
    await check(view, label);
    combos++;
  }
  mark("after the sweep");
  return { combos, fresh };
}

/**
 * Profiling, on under `browser:check --profile` (the runner sets
 * `BROWSER_CHECK_PROFILE`; off, every call here returns at once). It records each
 * load a check makes, from its `goto` / `reload` to the ready signal
 * `waitForShowcase` sees (wall time, requests the page made, the document's age),
 * and the time spent in each block a `mark(label)` opens (the runner also marks a
 * script's numbered block comments, `// 3. …` / `// ── 3. …`). A label marked
 * twice (a block inside a loop) adds up.
 */
const profile = { loads: [], blocks: new Map(), open: null, nav: null, requests: 0, undo: [] };

function mark(label) {
  if (!BROWSER_CHECK_PROFILE) return;
  const now = Date.now();
  if (profile.open) profile.blocks.set(profile.open.label, (profile.blocks.get(profile.open.label) ?? 0) + now - profile.open.at);
  profile.open = label === null ? null : { label, at: now };
}

/** `mark` under the name the runner's inserted block marks call (a script may have a `mark` of its own). */
const markBlock = mark;

/** Called by the runner before the check: counts requests and notes when each navigation starts. */
function startProfile(page) {
  if (!BROWSER_CHECK_PROFILE) return;
  const onRequest = () => profile.requests++;
  page.on("request", onRequest);
  profile.undo.push(() => page.off("request", onRequest));
  for (const method of ["goto", "reload"]) {
    const own = Object.prototype.hasOwnProperty.call(page, method);
    const original = page[method];
    page[method] = function (...args) {
      profile.nav = { kind: method, at: Date.now(), requests: profile.requests };
      return original.apply(this, args);
    };
    // The page outlives the check (one session runs every script): put it back exactly.
    profile.undo.push(() => (own ? (page[method] = original) : delete page[method]));
  }
  mark("(before the first block)");
}

/** Called by `waitForShowcase` once the page is ready: closes the navigation in flight, if any. */
async function profileLoad(page) {
  if (!BROWSER_CHECK_PROFILE || !profile.nav) return;
  const { kind, at, requests } = profile.nav;
  profile.nav = null;
  const ms = Date.now() - at;
  const doc = await page.evaluate(() => ({ route: location.hash, age: Math.round(performance.now()) }));
  profile.loads.push({ kind, route: doc.route, ms, requests: profile.requests - requests, docAge: doc.age });
}

/** Called by the runner after the check, pass or fail: undoes the page patches and returns the report. */
function endProfile() {
  if (!BROWSER_CHECK_PROFILE) return null;
  mark(null);
  for (const undo of profile.undo.splice(0)) undo();
  return { loads: profile.loads, blocks: Object.fromEntries(profile.blocks) };
}
