// Browser check: Banner persistence and ErrorBoundary containment, in a real page.
//
// Run it through `bun run browser:check feedback-banner`.
//
// jsdom proves the storage calls and the boundary's state; only a browser shows a
// reload that remembers, a sticky band over a real scroller, and a throw that leaves
// the rest of a live page (and the page itself) standing.
//
// Asserts:
//   Banner (`#feedback-banner`)
//   1. harness: the maintenance banner (`[data-sc="banner-persist"]`) is a region named
//      by its title inside the page frame, and its key is not stored;
//   2. Dismiss removes it and stores "dismissed" under its key; after a reload the frame
//      renders (positive control) and the banner does not; Restore brings it back and
//      clears the key;
//   3. the sticky banner, its scroller scrolled, stays on the scroller's top edge (±1px)
//      on the sticky layer (z-index = --LAYER-STICKY, read from the token);
//   ErrorBoundary (`#feedback-errorboundary`)
//   4. harness: the three widgets show their values;
//   5. Throw: Revenue becomes an alert "Something went wrong" whose details hold the
//      thrown message, Orders and Refunds still show their values, no section boundary
//      tripped, no uncaught page error, and React reported the caught error (console);
//   6. Try again recovers Revenue; Throw twice, then Try again by keyboard, brings the
//      fallback back with focus on its Try again, and Enter recovers.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const KEY = "r-ui-showcase:feedback-banner-maintenance";
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (anchor, ready) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}#/overview/${anchor}`);
    await page.reload();
    await waitForShowcase(page);
    await page.locator(ready).waitFor();
    await page.locator(ready).scrollIntoViewIfNeeded();
  };

  // ---- Banner ----
  await page.goto(`${base}#/overview/feedback-banner`);
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await load("feedback-banner", '[data-sc="banner-page"]');
  const banner = page.locator('[data-sc="banner-persist"]');
  const first = await banner.evaluate((el) => ({
    role: el.getAttribute("role"),
    name: document.getElementById(el.getAttribute("aria-labelledby") ?? "")?.textContent ?? null,
    inFrame: Boolean(el.closest('[data-sc="banner-page"]')),
  }));
  if (first.role !== "region" || first.name !== "Scheduled maintenance on Sunday" || !first.inFrame)
    fail.push(`harness: maintenance banner ${JSON.stringify(first)}`);
  if ((await page.evaluate((key) => localStorage.getItem(key), KEY)) !== null) fail.push("harness: the key is stored before any dismissal");

  await banner.getByRole("button", { name: "Dismiss" }).click();
  if ((await banner.count()) !== 0) fail.push("dismiss: the banner is still there");
  const stored = await page.evaluate((key) => localStorage.getItem(key), KEY);
  if (stored !== "dismissed") fail.push(`dismiss: stored ${JSON.stringify(stored)}, expected "dismissed"`);

  await load("feedback-banner", '[data-sc="banner-page"]');
  if ((await page.locator('[data-sc="banner-page"]').count()) !== 1) fail.push("reload: the page frame did not render (harness)");
  if ((await page.locator('[data-sc="banner-persist"]').count()) !== 0) fail.push("reload: the dismissed banner came back");

  await page.locator('[data-sc="banner-restore"]').click();
  await page.locator('[data-sc="banner-persist"]').waitFor({ timeout: 2000 }).catch(() => {});
  if ((await page.locator('[data-sc="banner-persist"]').count()) !== 1) fail.push("restore: the banner did not return");
  if ((await page.evaluate((key) => localStorage.getItem(key), KEY)) !== null) fail.push("restore: the key is still stored");

  const sticky = await page.evaluate(() => {
    const scroller = document.querySelector('[data-sc="banner-sticky"]');
    scroller.scrollIntoView({ block: "center" });
    scroller.scrollTop = scroller.scrollHeight;
    const band = scroller.querySelector('[role="region"]');
    const probe = document.createElement("div");
    probe.style.zIndex = "var(--LAYER-STICKY)";
    probe.style.position = "relative";
    scroller.appendChild(probe);
    const layer = getComputedStyle(probe).zIndex;
    probe.remove();
    return {
      scrolled: scroller.scrollTop,
      gap: band.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop,
      z: getComputedStyle(band).zIndex,
      layer,
    };
  });
  if (!(sticky.scrolled > 0)) fail.push(`sticky harness: the scroller did not scroll (${sticky.scrolled})`);
  if (Math.abs(sticky.gap) > 1) fail.push(`sticky: the band is ${sticky.gap}px from its scroller's top edge`);
  if (sticky.layer === "auto" || sticky.z !== sticky.layer) fail.push(`sticky: z-index ${sticky.z}, the sticky layer is ${sticky.layer}`);

  // ---- ErrorBoundary ----
  await load("feedback-errorboundary", '[data-sc="eb-dashboard"]');
  const widget = (name) => page.locator(`[data-sc="eb-widget-${name}"]`);
  const texts = () =>
    page.evaluate(() =>
      Object.fromEntries(
        ["revenue", "orders", "refunds"].map((n) => [n, document.querySelector(`[data-sc="eb-widget-${n}"]`)?.textContent ?? ""]),
      ),
    );
  const before = await texts();
  if (!before.revenue.includes("€48,210") || !before.orders.includes("1,284") || !before.refunds.includes("37"))
    fail.push(`harness: widgets ${JSON.stringify(before)}`);
  const tripped = () => page.locator("[data-section-error]").count();

  await page.locator('[data-sc="eb-throw"]').click();
  const fallback = widget("revenue").getByRole("alert", { name: "Something went wrong" });
  if ((await fallback.count()) !== 1) fail.push("throw: no fallback alert in the Revenue card");
  const after = await texts();
  if (after.revenue.includes("€48,210")) fail.push("throw: Revenue still shows its value");
  if (!after.orders.includes("1,284") || !after.refunds.includes("37")) fail.push(`throw: a sibling widget is gone ${JSON.stringify(after)}`);
  if ((await tripped()) !== 0) fail.push("throw: the showcase's section boundary tripped (the throw escaped)");
  await widget("revenue").getByText("Error details").click();
  const detail = await widget("revenue").getByLabel("Error details").textContent();
  if (!detail?.includes("cannot read properties of undefined")) fail.push(`details: ${JSON.stringify(detail?.slice(0, 80))}`);

  await widget("revenue").getByRole("button", { name: "Try again" }).click();
  if (!(await texts()).revenue.includes("€48,210")) fail.push("retry: Revenue did not recover");

  await page.locator('[data-sc="eb-throw-twice"]').click();
  await widget("revenue").getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  const refocused = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      inRevenue: Boolean(active?.closest('[data-sc="eb-widget-revenue"]')),
      text: active?.textContent?.trim() ?? null,
      fallback: Boolean(document.querySelector('[data-sc="eb-widget-revenue"] [role="alert"]')),
    };
  });
  if (!refocused.fallback) fail.push("throw twice: the first retry did not fail again (harness)");
  if (!refocused.inRevenue || refocused.text !== "Try again") fail.push(`throw twice: focus after the failed retry ${JSON.stringify(refocused)}`);
  await page.keyboard.press("Enter");
  if (!(await texts()).revenue.includes("€48,210")) fail.push("throw twice: the second retry did not recover");
  if ((await tripped()) !== 0) fail.push("the showcase's section boundary tripped");

  stopErrors();
  const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
  if (pageErrors.length) fail.push(`uncaught page errors: ${pageErrors.join(" | ")}`);
  if (!errors.some((e) => e.startsWith("console") && e.includes("Revenue: cannot read")))
    fail.push("harness: React reported no caught error, so nothing was thrown");

  if (fail.length) throw new Error(`feedback-banner-boundary FAILED:\n  ${fail.join("\n  ")}`);
  return `feedback-banner-boundary OK banner dismissal survives a reload and Restore clears it; sticky band on its scroller's edge at z ${sticky.z}; a thrown widget is contained (siblings kept, no page error), retries recover, a failed retry keeps focus`;
}
