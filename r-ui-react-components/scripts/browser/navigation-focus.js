// @covers   navigation/Pagination, navigation/Tabs
// @sections navigation-pagination navigation-tabs
// @tier     component
//
// Browser check: where focus goes in the navigation group when a press disables
// the control that made it, and which tab is the tab stop when the value names
// no enabled tab.
//
// jsdom focuses a `disabled` button and a hrefless `<a>` happily; a browser does
// not, so a handoff that runs before the commit enables its target passes in
// jsdom and drops focus here.
//
// On the Pagination and Tabs sections, each opened alone, asserts:
//   1. two pages: Next on page 1 lands on page 2 and focus moves to Previous
//      (Next is now disabled); Previous then returns to page 1 with focus on
//      Next. Harness: Previous starts disabled, so the handoff target was itself
//      disabled before the move;
//   2. link mode (getHref): from page 23, the Next link lands on page 24 (its
//      current link) and focus moves to the Previous link;
//   3. Tabs whose selected value is a disabled tab: exactly one tab is in the
//      Tab order, the first enabled one, and Tab from the control before the
//      list lands on it.
async (page) => {
  const fail = [];
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, label: el.getAttribute("aria-label"), disabled: el.matches(":disabled") || el.getAttribute("aria-disabled") === "true" } : null;
    });

  // ── 1. Two pages ─────────────────────────────────────────────────────────
  await openSection(page, "navigation-pagination");
  const two = page.locator('[data-sc="pagination-two"]');
  await two.scrollIntoViewIfNeeded();
  const prev = two.locator('[data-pagination="previous"]');
  const next = two.locator('[data-pagination="next"]');
  const isDisabled = (loc) => loc.evaluate((el) => el.matches(":disabled") || el.getAttribute("aria-disabled") === "true");
  if (!(await isDisabled(prev))) fail.push("two pages: harness: Previous is not disabled on page 1");
  await next.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const afterNext = await focused();
  const current = await two.locator('[aria-current="page"]').textContent();
  if (current?.trim() !== "2") fail.push(`two pages: Next landed on page ${current}`);
  if (afterNext?.label !== "Previous page" || afterNext.disabled) fail.push(`two pages: after Next focus is on ${JSON.stringify(afterNext)}, expected the enabled Previous`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const afterPrev = await focused();
  if (afterPrev?.label !== "Next page" || afterPrev.disabled) fail.push(`two pages: after Previous focus is on ${JSON.stringify(afterPrev)}, expected the enabled Next`);

  // ── 2. Link mode, to the last page ──────────────────────────────────────
  const links = page.getByRole("navigation", { name: "Invoice pages" });
  await links.scrollIntoViewIfNeeded();
  await links.getByRole("link", { name: "Page 24", exact: true }).click();
  await page.waitForTimeout(150);
  await links.getByRole("link", { name: "Page 23", exact: true }).click();
  await page.waitForTimeout(150);
  await links.locator('[data-pagination="next"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const linkCurrent = await links.locator('[aria-current="page"]').textContent();
  const linkFocus = await focused();
  if (linkCurrent?.trim() !== "24") fail.push(`link mode: Next from 23 landed on page ${linkCurrent}`);
  if (linkFocus?.label !== "Previous page" || linkFocus.tag !== "A" || linkFocus.disabled) fail.push(`link mode: after Next to the last page focus is on ${JSON.stringify(linkFocus)}, expected the Previous link`);

  // ── 3. Tabs: the selected tab is disabled ───────────────────────────────
  await openSection(page, "navigation-tabs");
  const box = page.locator('[data-sc="tabs-disabled-selected"]');
  await box.scrollIntoViewIfNeeded();
  const tabs = await box.getByRole("tab").evaluateAll((list) =>
    list.map((t) => ({ name: t.textContent.trim(), stop: t.tabIndex === 0, disabled: t.disabled, selected: t.getAttribute("aria-selected") === "true" })),
  );
  if (!tabs[0]?.disabled || !tabs[0]?.selected) fail.push(`tabs: harness: the first tab is not the disabled selected one (${JSON.stringify(tabs[0])})`);
  const stops = tabs.filter((t) => t.stop);
  const firstEnabled = tabs.find((t) => !t.disabled);
  if (stops.length !== 1 || stops[0].name !== firstEnabled?.name) fail.push(`tabs: tab stops ${JSON.stringify(stops.map((t) => t.name))}, expected only "${firstEnabled?.name}"`);
  await box.evaluate((root) => {
    const list = root.querySelector('[role="tablist"]');
    const all = [...document.querySelectorAll("a[href], button:not(:disabled), input, [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !list.contains(el) && el.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING && el.checkVisibility(),
    );
    all.at(-1)?.focus();
  });
  await page.keyboard.press("Tab");
  const tabbed = await page.evaluate(() => (document.activeElement?.getAttribute("role") === "tab" ? document.activeElement.textContent.trim() : document.activeElement?.tagName));
  if (tabbed !== firstEnabled?.name) fail.push(`tabs: Tab into the list landed on ${JSON.stringify(tabbed)}, expected "${firstEnabled?.name}"`);

  const result = { afterNext, afterPrev, linkFocus, stops: stops.map((t) => t.name), tabbed };
  if (fail.length) throw new Error(`navigation-focus FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `navigation-focus OK (two pages hand focus both ways; link mode hands it to Previous at the last page; a disabled selected tab leaves "${tabbed}" as the tab stop)`;
}
