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
//      a press on another rail entry glides there (sampled each frame: positions in
//      between, the rail holding the pressed entry throughout) and lands the same way;
//      under reduced motion a press jumps (in place within two frames);
//   6. reading by scrolling (no link), 600px tall so the rail scrolls too: with a
//      mid-page section brought under the header,
//      its rail entry and only it is `aria-current`, and lies inside the rail's scrolled
//      view; at the page's end the current entry is the last section on screen; back at
//      the top, the first section's;
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
    // A press glides: sampled each frame, the page passes through between, the rail
    // holds the pressed entry the whole way, and it lands where a jump would.
    const other = rail.find((href) => href !== "#/overview/form-checkbox" && href !== rail.at(-1))?.replace("#/overview/", "");
    await page.locator(`nav[aria-label="On this page"] a[href="#/overview/${other}"]`).click();
    const glide = await page.evaluate(async (id) => {
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const ys = [];
      const marks = new Set();
      let still = 0;
      while (still < 8 && ys.length < 240) {
        await frame();
        ys.push(window.scrollY);
        marks.add(document.querySelector('nav[aria-label="On this page"] a[aria-current="location"]')?.getAttribute("href"));
        still = ys.length > 1 && ys.at(-1) === ys.at(-2) ? still + 1 : 0;
      }
      return { steps: new Set(ys).size, marks: [...marks], wanted: `#/overview/${id}` };
    }, other);
    if (!(glide.steps > 3)) fail.push(`rail press: the page jumped (${glide.steps} scroll positions), expected a glide`);
    if (JSON.stringify(glide.marks) !== JSON.stringify([glide.wanted])) fail.push(`rail press: on the way the rail marked ${JSON.stringify(glide.marks)}, expected only ${glide.wanted}`);
    await settle(page);
    const pressed = await landed(other);
    if (pressed.top === null || Math.abs(pressed.top - form.clearance) > 2) fail.push(`rail press: ${other}'s top is ${pressed.top}, expected ${form.clearance}`);
    if (pressed.current !== "location") fail.push(`rail press: its entry is aria-current "${pressed.current}"`);

    // Reduced motion: a press jumps.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const jumpTo = rail[2].replace("#/overview/", "");
    await page.locator(`nav[aria-label="On this page"] a[href="#/overview/${jumpTo}"]`).click();
    const jumped = await page.evaluate(async (id) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return document.getElementById(id).getBoundingClientRect().top;
    }, jumpTo);
    if (Math.abs(jumped - form.clearance) > 2) fail.push(`reduced motion: two frames after the press ${jumpTo} is at ${jumped}, expected ${form.clearance} (a jump)`);
    await page.emulateMedia({ reducedMotion: null });

    // 6. The rail follows the reading, by plain scrolling. 600px tall, so Form's rail
    // scrolls too and keeping the current entry in its view is something it must do.
    await page.setViewportSize({ width: 1280, height: 600 });
    await settle(page);
    const railScrolls = await page.evaluate(() => {
      const rail = document.querySelector('nav[aria-label="On this page"]');
      return rail.scrollHeight > rail.clientHeight;
    });
    if (!railScrolls) fail.push("spy: harness: at 600px tall the rail does not scroll");
    const currentEntry = () =>
      page.evaluate(() => {
        const rail = document.querySelector('nav[aria-label="On this page"]');
        const current = [...rail.querySelectorAll('a[aria-current="location"]')];
        const r = rail.getBoundingClientRect();
        const c = current[0]?.getBoundingClientRect();
        return { ids: current.map((a) => a.getAttribute("href").replace("#/overview/", "")), inRail: !!c && c.top >= r.top - 1 && c.bottom <= r.bottom + 1 };
      });
    const waitCurrent = (id) =>
      page
        .waitForFunction((id) => document.querySelector(`nav[aria-label="On this page"] a[aria-current="location"]`)?.getAttribute("href") === `#/overview/${id}`, id, { timeout: 3000 })
        .catch(() => {});
    // Deep in the list, so its entry starts below the rail's fold (harness-checked).
    const mid = form.sections.at(-3);
    const fold = await page.evaluate((id) => {
      const rail = document.querySelector('nav[aria-label="On this page"]');
      const entry = rail.querySelector(`a[href="#/overview/${id}"]`).getBoundingClientRect();
      return entry.bottom > rail.getBoundingClientRect().bottom;
    }, mid);
    if (!fold) fail.push(`spy: harness: ${mid}'s entry is already in the rail's view, so following it proves nothing`);
    await page.evaluate(({ id, clearance }) => window.scrollBy(0, document.getElementById(id).getBoundingClientRect().top - clearance - 4), { id: mid, clearance: form.clearance });
    const midTop = await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, mid);
    if (Math.abs(midTop - form.clearance - 4) > 2) fail.push(`spy: harness: ${mid} could not be scrolled under the header (top ${midTop})`);
    await waitCurrent(mid);
    const reading = await currentEntry();
    if (JSON.stringify(reading.ids) !== JSON.stringify([mid])) fail.push(`spy: scrolled to ${mid}, the rail marks ${JSON.stringify(reading.ids)}`);
    if (!reading.inRail) fail.push(`spy: ${mid}'s entry is outside the rail's view`);
    // The page's end in a tall window: the last section sits below the reading band,
    // so only the end-of-page rule can mark it (harness-checked).
    await page.setViewportSize({ width: 1280, height: 1800 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const { id: end, top: endTop } = await page.evaluate(() => {
      const onScreen = [...document.querySelectorAll("section.sc-section")].filter((s) => {
        const r = s.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      });
      const last = onScreen.at(-1);
      return { id: last?.id ?? null, top: (last?.getBoundingClientRect().top ?? 0) / innerHeight };
    });
    if (!(endTop > 0.4)) fail.push(`spy: harness: at the end the last section starts ${Math.round(endTop * 100)}% down, inside the band anyway`);
    await waitCurrent(end);
    const atEnd = await currentEntry();
    if (JSON.stringify(atEnd.ids) !== JSON.stringify([end])) fail.push(`spy: at the page's end the rail marks ${JSON.stringify(atEnd.ids)}, expected the last section on screen (${end})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitCurrent(form.sections[0]);
    const top = await currentEntry();
    if (JSON.stringify(top.ids) !== JSON.stringify([form.sections[0]])) fail.push(`spy: at the top the rail marks ${JSON.stringify(top.ids)}, expected ${form.sections[0]}`);

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
  return "index links every group (no section loaded); a group's page holds its own sections under a rail that sticks wide and sits above narrow; section links and rail presses land under the header; the rail follows the reading; the pager walks the groups";
}
