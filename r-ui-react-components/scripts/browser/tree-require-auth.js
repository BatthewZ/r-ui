// Browser check: RequireAuth never paints protected content while the status is not "authenticated".
//
// A unit test sees one render at a time; a flash is a commit, so here a
// MutationObserver on the demo's gate records every DOM state it passes through
// while the demo really waits (Simulate sign-in holds "loading" for 1.2s).
//
// On the Overview's RequireAuth section, at 1280, comfortable, fine:
//   1. harness: the gate starts signed out with the default fallback, its sign-in
//      link to /sign-in, and no payroll card; in the accessibility tree each default
//      fallback is its words (the wait a status, signed out a named "Sign in" link)
//      and never an icon;
//   2. Simulate sign-in: the observer sees the loading state (its status text) and
//      then the payroll card once authenticated (positive control), and never the
//      card while the gate's status is anything but "authenticated";
//   3. pressing "loading" while signed in removes the card in the same commit;
//   4. authorize refuses a non-admin: the "no access" message, no card;
//   5. signed out again: onUnauthenticated ran once more (the demo counts), and the
//      sign-in link navigates through the RouterProvider (the demo router's location
//      changes, the page does not).
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const anchor = "guards-requireauth";
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/${anchor}`);
  await page.evaluate(
    ({ key, view }) => localStorage.setItem(key, JSON.stringify(view)),
    { key: SHOWCASE_VIEW_KEY, view: { theme: "default", density: "comfortable", input: "fine" } },
  );
  await page.reload();
  await waitForShowcase(page);
  const section = page.locator(`[id="${anchor}"]`);
  await section.scrollIntoViewIfNeeded();
  const GATE = '[data-sc="auth-gate"]';
  const gate = page.locator(GATE);
  const output = section.locator("output").first();
  const redirects = async () => Number(/redirects asked for: (\d+)/.exec((await output.textContent()) ?? "")?.[1] ?? NaN);

  // ── 1: harness ───────────────────────────────────────────────────────────
  const start = await gate.evaluate((g) => ({
    status: g.dataset.status,
    secret: Boolean(g.querySelector('[data-sc="auth-secret"]')),
    state: g.querySelector("[data-auth-state]")?.getAttribute("data-auth-state") ?? null,
    href: g.querySelector("a")?.getAttribute("href") ?? null,
  }));
  if (start.status !== "unauthenticated" || start.secret || start.state !== "unauthenticated" || start.href !== "/sign-in") {
    fail.push(`harness: the gate starts ${JSON.stringify(start)}, expected signed out with a link to /sign-in and no card`);
  }
  // The fallbacks as the accessibility tree has them: words and a named link, glyphs hidden.
  const a11y = async (what, must) => {
    const snap = await gate.ariaSnapshot();
    const missing = must.filter((re) => !re.test(snap));
    if (missing.length || /- img\b/.test(snap)) fail.push(`a11y ${what}: ${JSON.stringify(snap)} lacks ${missing.join(", ")} or exposes an icon`);
  };
  await a11y("signed out", [/- paragraph: Sign in to continue/, /- link "Sign in"/]);
  const redirectsAtStart = await redirects();
  if (!(redirectsAtStart >= 1)) fail.push(`harness: onUnauthenticated ran ${redirectsAtStart} times on a signed-out start`);

  // ── 2: the observer ─────────────────────────────────────────────────────
  await page.evaluate((s) => {
    const g = document.querySelector(s);
    const log = { states: [], flashes: [] };
    const record = () => {
      const status = g.dataset.status;
      const secret = Boolean(g.querySelector('[data-sc="auth-secret"]'));
      const wait = g.querySelector('[data-auth-state="loading"] [role="status"]')?.textContent.trim() ?? null;
      const last = log.states.at(-1);
      const entry = `${status}:${secret ? "card" : wait ? "wait" : "other"}`;
      if (last !== entry) log.states.push(entry);
      if (secret && status !== "authenticated") log.flashes.push(entry);
    };
    const observer = new window.MutationObserver(record);
    observer.observe(g, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__authGateLog = log;
    window.__authGateObserver = observer;
  }, GATE);

  await section.locator('[data-sc="auth-sign-in"]').click();
  await page.waitForFunction((s) => document.querySelector(s)?.dataset.status === "loading", GATE);
  const waiting = await gate.evaluate((g) => g.querySelector('[role="status"]')?.textContent.trim() ?? null);
  if (!waiting) fail.push("loading: the gate shows no status while it waits");
  await a11y("loading", [/- status: Checking your session…/]);
  await page.waitForFunction((s) => document.querySelector(s)?.querySelector('[data-sc="auth-secret"]'), GATE, { timeout: 5000 });

  // ── 3: back to loading while signed in ──────────────────────────────────
  await section.locator('[data-sc-status-button="loading"]').click();
  await page.waitForFunction((s) => document.querySelector(s)?.dataset.status === "loading", GATE);
  const loadingAgain = await gate.evaluate((g) => Boolean(g.querySelector('[data-sc="auth-secret"]')));
  if (loadingAgain) fail.push("pressing loading while signed in left the payroll card on screen");

  const log = await page.evaluate(() => {
    window.__authGateObserver.disconnect();
    return window.__authGateLog;
  });
  if (!log.states.includes("loading:wait") || !log.states.includes("authenticated:card")) fail.push(`positive control: the observer saw ${JSON.stringify(log.states)}, expected a wait and then the card`);
  if (log.flashes.length > 0) fail.push(`protected content painted while not authenticated: ${JSON.stringify(log.flashes)} (states ${JSON.stringify(log.states)})`);

  // ── 4: authorize ─────────────────────────────────────────────────────────
  await section.locator('[data-sc-status-button="authenticated"]').click();
  await gate.locator('[data-sc="auth-secret"]').waitFor();
  await section.getByRole("switch", { name: /admin/ }).click();
  const refused = await gate.evaluate((g) => ({
    secret: Boolean(g.querySelector('[data-sc="auth-secret"]')),
    state: g.querySelector("[data-auth-state]")?.getAttribute("data-auth-state") ?? null,
  }));
  if (refused.secret || refused.state !== "forbidden") fail.push(`authorize refusing: ${JSON.stringify(refused)}, expected the forbidden fallback and no card`);
  await a11y("forbidden", [/- paragraph: You don’t have access/]);

  // ── 5: signed out again, the link ───────────────────────────────────────
  const beforeOut = await redirects();
  await section.locator('[data-sc-status-button="unauthenticated"]').click();
  await page.waitForFunction((s) => document.querySelector(s)?.dataset.status === "unauthenticated", GATE);
  await page.waitForTimeout(100);
  const afterOut = await redirects();
  if (afterOut !== beforeOut + 1) fail.push(`onUnauthenticated: ${beforeOut} → ${afterOut}, expected exactly one more call`);
  const urlBefore = page.url();
  await gate.getByRole("link", { name: "Sign in" }).click();
  const location = (await output.textContent()) ?? "";
  if (!location.includes("/sign-in")) fail.push(`the sign-in link did not go through the demo router: "${location}"`);
  if (page.url() !== urlBefore) fail.push(`the sign-in link left the page: ${page.url()}`);

  const result = { start, waiting, states: log.states, refused, redirects: [redirectsAtStart, beforeOut, afterOut] };
  if (fail.length) throw new Error(`tree-require-auth FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `tree-require-auth OK ${JSON.stringify(result)}`;
}
