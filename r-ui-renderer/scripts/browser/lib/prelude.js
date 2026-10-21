// Prepended to every browser check by `scripts/browser-check.mjs`, inside the
// check's own `async (page) => …` scope, so each script can call these by name.
// The runner defines before it (`lib/wrap.mjs`): BROWSER_CHECK_HOME (the
// playground's URL), DIAGNOSTIC_SELECTOR and VIEW_SELECTOR (from
// src/diagnostics.ts; no check spells a renderer class), and CORPUS
// ({ product, coverage }: document names; controls: name -> the diagnostic
// codes that control document renders).
//
// These live in the check's scope, not the page's: a callback handed to
// `page.evaluate` gets them as its argument.

/** The viewport every session opens at, and every check is reset to. */
const VIEWPORT = { width: 1280, height: 900 };
/** Every corpus document, product first. */
const CORPUS_NAMES = [...CORPUS.product, ...CORPUS.coverage];
/** The control documents: not corpus, each rendering the diagnostics CORPUS.controls declares for it. */
const CONTROL_NAMES = Object.keys(CORPUS.controls);

/**
 * The full-page route for document `name` (corpus or control), with `params`
 * (theme, density, input, stream). Built as text: run-code's scope has the
 * language's globals only, no `URL` or `URLSearchParams`.
 */
function viewUrl(name, params = {}) {
  const pairs = [["view", name], ...Object.entries(params).filter(([, value]) => value !== undefined)];
  return `${BROWSER_CHECK_HOME}?${pairs.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join("&")}`;
}

/**
 * Waits for `<html data-renderer-ready>`, the playground's one settled signal
 * (the document complete, its data bindings resolved), never for a timeout.
 * A route the playground refused (`data-renderer-error`) fails the check.
 */
async function waitForReady(page, { timeout = 30_000 } = {}) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-renderer-ready"), null, { timeout });
  const error = await page.evaluate(() => document.documentElement.getAttribute("data-renderer-error"));
  if (error !== null) throw new Error(`harness: the playground refused the route: ${error}`);
}

/** Loads `name` fresh (a new document, so nothing survives from the last view) and waits until it is ready. */
async function openView(page, name, params = {}, options = {}) {
  await page.goto("about:blank");
  await page.goto(viewUrl(name, params));
  await waitForReady(page, options);
}

/** Every renderer diagnostic in the page (`document.body`: overlays render outside the view), hidden ones included. */
function diagnostics(page) {
  return page.evaluate(
    (selector) =>
      [...document.body.querySelectorAll(selector)].map((element) => ({
        code: element.getAttribute("data-code"),
        path: element.getAttribute("data-path"),
        text: (element.textContent ?? "").trim().slice(0, 120),
      })),
    DIAGNOSTIC_SELECTOR,
  );
}

/** `diagnostics(page)` as problem lines, each led by `label` (a document's name) when there is one. */
async function diagnosticProblems(page, label) {
  const lead = label === undefined ? "" : `${label}: `;
  return (await diagnostics(page)).map((d) => `${lead}diagnostic ${d.code} at ${d.path}: ${d.text}`);
}

/** Collects the URL of every request whose URL contains `fragment`, until `stop()`. */
function collectRequests(page, fragment) {
  const urls = [];
  const onRequest = (request) => {
    if (request.url().includes(fragment)) urls.push(request.url());
  };
  page.on("request", onRequest);
  return { urls, stop: () => page.off("request", onRequest) };
}

const errorCollectors = [];

/**
 * Collects console errors and uncaught page errors until `stop()` (or the end
 * of the check). `ignore(text, url)` drops the ones a check expects.
 */
function collectErrors(page, { ignore = () => false } = {}) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error" && !ignore(msg.text(), msg.location()?.url ?? "")) errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => {
    if (!ignore(err.message, "")) errors.push(`pageerror: ${err.message}`);
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

/** Two animation frames, bounded: a page that renders no frame fails instead of hanging the run. */
async function frames(page, { timeout = 5_000 } = {}) {
  const late = await page.evaluate(
    (ms) =>
      Promise.race([
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(false)))),
        new Promise((done) => setTimeout(() => done(true), ms)),
      ]),
    timeout,
  );
  if (late) throw new Error(`harness: no animation frame came within ${timeout}ms`);
}

/** Throws one error listing every problem, so a check reports all it found at once. */
function report(problems, summary) {
  if (problems.length > 0) throw new Error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  return summary;
}

/**
 * Puts the session back the way the runner opened it, pass or fail: no error
 * listeners, no emulated media, the default viewport, and a blank document
 * (which drops everything a view left open). The runner calls it after every check.
 */
async function resetPage(page) {
  for (const stop of errorCollectors.splice(0)) stop();
  await page.emulateMedia({ media: null, colorScheme: null, reducedMotion: null, forcedColors: null });
  await page.setViewportSize(VIEWPORT);
  await page.goto("about:blank");
}
