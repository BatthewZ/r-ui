// @covers   navigation/AppShell
// @tier     page
// @cost     15
//
// Browser check: the Overview is paged, a component group to a page.
//
// Run it through `bun run browser:check showcase-overview`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print showcase-overview)"
//
// At 1280 (comfortable, fine), then 375, it asserts:
//   1. the index (`#/overview`) renders no section and links every group the
//      sidebar's "Components" section lists, in the same order, each card's count
//      matching that group's page; an unknown anchor says so;
//   2. a group's page (`#/overview/form`) renders that group's sections and no
//      other's, no boundary tripped, titled "Form" (h1 and document title), its
//      sidebar entry current; its "On this page" rail lists those sections in order;
//      it loads under half the scripts the all-sections page (`#/all`) does;
//   3. wide: the rail sits beside the sections and, scrolled to the page's end, is
//      still in view under the shell's header; narrow (375): it sits above them
//      and scrolls away;
//   4. a section link (`#/overview/form-checkbox`) opens the group's page with that
//      section under the header (within 2px) and its rail entry `aria-current`;
//      a press on another rail entry lands on that section the same way;
//   5. the pager's next link opens the next group's page at its top, the group
//      visited before so it swaps in place (a first visit's "Loading…" would reset
//      the scroll by itself).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const view = { theme: "default", density: "comfortable", input: "fine" };

  // The scripts a fresh load fetched, and where the page settled.
  const read = () =>
    page.evaluate(() => {
      const probe = document.createElement("div");
      const host = document.querySelector(".sc-page") ?? document.body;
      probe.style.blockSize = "var(--sc-header-clearance)";
      host.append(probe);
      const clearance = probe.getBoundingClientRect().height;
      probe.remove();
      return {
        clearance,
        scripts: performance.getEntriesByType("resource").filter((e) => /\.m?js(\?|$)/.test(e.name)).length,
        sections: [...document.querySelectorAll("section.sc-section")].map((s) => s.id),
        tripped: document.querySelectorAll("[data-section-error]").length,
        h1: document.querySelector("h1")?.textContent.trim() ?? null,
        title: document.title,
        scrollY: window.scrollY,
      };
    });
  const sidebarGroups = () =>
    page.evaluate(() => {
      const group = [...document.querySelectorAll('[role="group"]')].find((g) => g.textContent.trim().startsWith("Components"));
      return [...(group?.querySelectorAll("a[href]") ?? [])].map((a) => ({
        href: a.getAttribute("href"),
        current: a.getAttribute("aria-current"),
      }));
    });

  try {
    // 1. The index.
    await openPage(page, "overview", { view, width: 1280 });
    const index = await read();
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll(".sc-group-card")].map((a) => ({
        href: a.getAttribute("href"),
        count: Number.parseInt(a.querySelector(".sc-group-card-count")?.textContent ?? "", 10),
      })),
    );
    const sidebar = await sidebarGroups();
    if (index.sections.length !== 0) fail.push(`index: renders ${index.sections.length} sections, expected none`);
    if (cards.length < 10) fail.push(`index: harness: ${cards.length} group cards`);
    if (JSON.stringify(cards.map((c) => c.href)) !== JSON.stringify(sidebar.map((s) => s.href)))
      fail.push(`index: the cards ${JSON.stringify(cards.map((c) => c.href))} are not the sidebar's groups ${JSON.stringify(sidebar.map((s) => s.href))}`);
    const formCard = cards.find((c) => c.href === "#/overview/form");
    await openPage(page, "overview/nothing-here", { view, width: 1280 });
    const unknown = await page.evaluate(() => document.querySelector('.sc-invalid[role="alert"]')?.textContent ?? "");
    if (!unknown.includes("nothing-here")) fail.push(`index: an unknown anchor shows "${unknown}", expected it named`);

    // 2. A group's page, against the all-sections page's load.
    await openPage(page, "all", { view, width: 1280 });
    const all = await read();
    await openPage(page, "overview/form", { view, width: 1280 });
    const form = await read();
    const rail = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.getAttribute("href")));
    const current = (await sidebarGroups()).filter((s) => s.current === "page").map((s) => s.href);
    if (form.sections.length === 0 || form.sections.some((id) => !id.startsWith("form-"))) fail.push(`form: renders ${JSON.stringify(form.sections)}, expected Form's sections only`);
    if (formCard && formCard.count !== form.sections.length) fail.push(`form: the index card says ${formCard.count}, the page has ${form.sections.length}`);
    if (form.tripped) fail.push(`form: ${form.tripped} section boundaries tripped`);
    if (form.h1 !== "Form" || !form.title.startsWith("Form")) fail.push(`form: titled h1 "${form.h1}", document "${form.title}"`);
    if (JSON.stringify(current) !== '["#/overview/form"]') fail.push(`form: the sidebar's current entries are ${JSON.stringify(current)}`);
    if (JSON.stringify(rail) !== JSON.stringify(form.sections.map((id) => `#/overview/${id}`))) fail.push(`form: the rail lists ${JSON.stringify(rail)}, not the sections in order`);
    if (!(all.sections.length > form.sections.length)) fail.push(`all: harness: ${all.sections.length} sections`);
    if (!(form.scripts < all.scripts / 2)) fail.push(`form: loaded ${form.scripts} scripts, the all-sections page ${all.scripts}: expected under half`);

    // 3. The rail, wide then narrow.
    const railAt = () =>
      page.evaluate(() => {
        const rail = document.querySelector("nav.sc-rail").getBoundingClientRect();
        const sections = document.querySelector(".sc-group").getBoundingClientRect();
        return { rail: { top: rail.top, bottom: rail.bottom, left: rail.left }, sections: { top: sections.top, right: sections.right }, viewport: innerHeight };
      });
    const wideTop = await railAt();
    if (!(wideTop.rail.left >= wideTop.sections.right)) fail.push(`wide: the rail (left ${wideTop.rail.left}) is not beside the sections (right ${wideTop.sections.right})`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const wideEnd = await railAt();
    if (Math.abs(wideEnd.rail.top - form.clearance) > 2 || wideEnd.rail.bottom > wideEnd.viewport)
      fail.push(`wide: scrolled to the end, the rail is at ${wideEnd.rail.top.toFixed(1)}–${wideEnd.rail.bottom.toFixed(1)}, expected in view from ${form.clearance}`);

    await openPage(page, "overview/form", { view, width: 375 });
    const narrowTop = await railAt();
    if (!(narrowTop.rail.bottom <= narrowTop.sections.top)) fail.push(`narrow: the rail (bottom ${narrowTop.rail.bottom}) is not above the sections (top ${narrowTop.sections.top})`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const narrowEnd = await railAt();
    if (!(narrowEnd.rail.bottom < 0)) fail.push(`narrow: scrolled to the end, the rail is still in view (bottom ${narrowEnd.rail.bottom})`);

    // 4. A section link, then a press in the rail.
    const landed = (id) =>
      page.evaluate((id) => {
        const top = document.getElementById(id)?.getBoundingClientRect().top ?? null;
        const entry = document.querySelector(`nav[aria-label="On this page"] a[href="#/overview/${id}"]`);
        return { top, current: entry?.getAttribute("aria-current") ?? null };
      }, id);
    await openPage(page, "overview/form-checkbox", { view, width: 1280 });
    const deep = await landed("form-checkbox");
    if (deep.top === null || Math.abs(deep.top - form.clearance) > 2) fail.push(`deep link: Checkbox's top is ${deep.top}, expected ${form.clearance} (under the header)`);
    if (deep.current !== "location") fail.push(`deep link: its rail entry is aria-current "${deep.current}"`);
    const other = rail.find((href) => href !== "#/overview/form-checkbox" && href !== rail.at(-1))?.replace("#/overview/", "");
    await page.locator(`nav[aria-label="On this page"] a[href="#/overview/${other}"]`).click();
    await settle(page);
    const pressed = await landed(other);
    if (pressed.top === null || Math.abs(pressed.top - form.clearance) > 2) fail.push(`rail press: ${other}'s top is ${pressed.top}, expected ${form.clearance}`);
    if (pressed.current !== "location") fail.push(`rail press: its entry is aria-current "${pressed.current}"`);

    // 5. The pager.
    const nextHref = await page.evaluate(() => document.querySelector('nav[aria-label="Component groups"] a[rel="next"]')?.getAttribute("href") ?? null);
    const nextCard = cards[cards.findIndex((c) => c.href === "#/overview/form") + 1]?.href;
    if (nextHref !== nextCard) fail.push(`pager: next is ${nextHref}, expected the index's next group ${nextCard}`);
    else {
      // Same page ("overview"), so the ready flag cannot tell: wait for a group's sections.
      const shown = (g) => page.waitForFunction((g) => document.querySelector(`section.sc-section[id^="${g}-"]`) !== null, g, { timeout: 30_000 });
      const group = nextHref.replace("#/overview/", "");
      // Visit the next group first: a first visit suspends, and its "Loading…" shortens the
      // page to the top by itself; a group already loaded swaps in place and must scroll there.
      await page.evaluate((h) => (location.hash = h), nextHref);
      await shown(group);
      await page.evaluate((h) => (location.hash = h), `#/overview/${other}`);
      await shown("form");
      await settle(page);
      const before = await page.evaluate(() => window.scrollY);
      if (!(before > 0)) fail.push(`pager: harness: back on ${other}, scrollY is ${before}`);
      await page.locator('nav[aria-label="Component groups"] a[rel="next"]').click();
      await shown(group);
      await settle(page);
      const after = await read();
      if (after.scrollY !== 0 || after.sections.some((id) => id.startsWith("form-")) || after.sections.length === 0)
        fail.push(`pager: after next, scrollY ${after.scrollY} and sections ${JSON.stringify(after.sections.slice(0, 3))}`);
    }

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`showcase-overview:\n  ${fail.join("\n  ")}`);
  return "index links every group (no section loaded); a group's page holds its own sections under a rail that sticks wide and sits above narrow; section links and rail presses land under the header; the pager walks the groups";
}
