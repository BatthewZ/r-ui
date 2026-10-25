// @covers   navigation/AppShell
// @sections navigation-appshell
// @tier     page
// @cost     12
//
// Browser check: an AppShell rail with more links than the screen is tall scrolls,
// so its last links and its expand toggle stay reachable, and its label bubbles
// still show beside their icons after it has scrolled.
//
// On the showcase's own shell (pages plus every component group: taller than a
// 700px screen), on the Overview's index, it asserts:
//   1. at 1280 × 700, collapsed from the full sidebar (its toggle reached by
//      scrolling): the rail overflows (harness), scrolls (scrollHeight reached) and
//      never sideways; scrolled to its end, the "Expand sidebar" toggle is inside
//      the viewport and is what a press there hits, and pressing it expands;
//   2. hovering the rail's last link (scrolled to): its label is a fixed bubble,
//      shown (opacity 1), centred on the link (±1px) and --R-SIZE-3 past its
//      inline end (±1px), inside the viewport; the same under dir="rtl" (past its
//      left edge);
//   3. at 900 × 700 (the rail, no toggle): the rail scrolls to its last link, which
//      ends inside the viewport;
//   4. a shell inside another's main (the AppShell demo inside the showcase's shell),
//      at 1280: its own toggle collapses its sidebar to a rail and expands it back,
//      while the showcase's sidebar stays full. The wide rules once keyed on any
//      uncollapsed ancestor shell, so the outer one held the demo open.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const view = { theme: "default", density: "comfortable", input: "fine" };
  const RAIL = ".r-navigation-shell > .r-navigation-shell-sidebar .r-navigation-shell-sidebar-inner";

  const rail = () =>
    page.evaluate((sel) => {
      const nav = document.querySelector(sel);
      const links = [...nav.querySelectorAll(".r-navigation-link")];
      const last = links.at(-1).getBoundingClientRect();
      return {
        collapsed: nav.closest(".r-navigation-shell").hasAttribute("data-collapsed"),
        scrollH: nav.scrollHeight,
        clientH: nav.clientHeight,
        scrollW: nav.scrollWidth,
        clientW: nav.clientWidth,
        scrollTop: nav.scrollTop,
        lastBottom: last.bottom,
        viewport: innerHeight,
      };
    }, RAIL);
  const toEnd = async () => {
    await page.evaluate((sel) => {
      const nav = document.querySelector(sel);
      nav.scrollTop = nav.scrollHeight;
    }, RAIL);
    await settle(page);
  };
  const bubble = async (rtl) => {
    const last = page.locator(`${RAIL} .r-navigation-link`).last();
    await last.hover();
    await settle(page);
    return page.evaluate(
      ({ sel, rtl }) => {
        const nav = document.querySelector(sel);
        const link = [...nav.querySelectorAll(".r-navigation-link")].at(-1);
        const label = link.querySelector(".r-navigation-link-label");
        const probe = document.createElement("div");
        probe.style.inlineSize = "var(--R-SIZE-3)";
        nav.append(probe);
        const gap = probe.getBoundingClientRect().width;
        probe.remove();
        const l = label.getBoundingClientRect();
        const a = link.getBoundingClientRect();
        const cs = getComputedStyle(label);
        return {
          position: cs.position,
          opacity: cs.opacity,
          dy: (l.top + l.bottom) / 2 - (a.top + a.bottom) / 2,
          dx: rtl ? a.left - l.right - gap : l.left - a.right - gap,
          inside: l.left >= 0 && l.right <= innerWidth && l.top >= 0 && l.bottom <= innerHeight,
          text: label.textContent.trim(),
        };
      },
      { sel: RAIL, rtl },
    );
  };
  const checkBubble = (b, where) => {
    if (b.position !== "fixed") fail.push(`${where}: the label is position ${b.position}, expected a fixed bubble`);
    if (b.opacity !== "1") fail.push(`${where}: the hovered label's opacity is ${b.opacity}`);
    if (Math.abs(b.dy) > 1 || Math.abs(b.dx) > 1) fail.push(`${where}: "${b.text}" bubble is ${b.dx.toFixed(1)}px / ${b.dy.toFixed(1)}px off its place beside the link`);
    if (!b.inside) fail.push(`${where}: "${b.text}" bubble leaves the viewport`);
  };

  try {
    // 1. Collapse from the full sidebar, then reach the expand toggle in the rail.
    await openPage(page, "overview", { view, width: 1280, height: 700 });
    await page.locator(`${RAIL} button[aria-label="Collapse sidebar"]`).click();
    await settle(page);
    const top = await rail();
    if (!top.collapsed) fail.push("rail: harness: the sidebar did not collapse");
    if (!(top.scrollH > top.clientH)) fail.push(`rail: harness: ${top.scrollH}px of links fit ${top.clientH}px, nothing to scroll`);
    if (top.scrollW > top.clientW) fail.push(`rail: scrolls sideways (${top.scrollW} > ${top.clientW})`);
    await toEnd();
    const end = await rail();
    if (!(end.scrollTop > 0) || Math.abs(end.scrollTop - (end.scrollH - end.clientH)) > 1) fail.push(`rail: scrolled to ${end.scrollTop}, its end is ${end.scrollH - end.clientH}`);
    const toggle = await page.evaluate((sel) => {
      const b = document.querySelector(`${sel} button[aria-label="Expand sidebar"]`);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return { inView: r.top >= 0 && r.bottom <= innerHeight, hits: b.contains(hit) };
    }, RAIL);
    if (!toggle?.inView || !toggle.hits) fail.push(`rail: scrolled to its end, the expand toggle is ${JSON.stringify(toggle)}`);

    // 2. The last link's bubble, after the scroll, then in RTL.
    checkBubble(await bubble(false), "rail");
    await setView(page, { dir: "rtl" });
    checkBubble(await bubble(true), "rail rtl");
    await setView(page, { dir: "ltr" });

    if (toggle?.hits) {
      await page.locator(`${RAIL} button[aria-label="Expand sidebar"]`).click();
      await settle(page);
      if ((await rail()).collapsed) fail.push("rail: pressing the expand toggle left it collapsed");
    }

    // 3. Medium width: the rail without a toggle still reaches its last link.
    await openPage(page, "overview", { view, width: 900, height: 700 });
    const mid = await rail();
    if (!(mid.scrollH > mid.clientH)) fail.push(`900: harness: ${mid.scrollH}px of links fit ${mid.clientH}px`);
    await toEnd();
    const midEnd = await rail();
    if (midEnd.lastBottom > midEnd.viewport) fail.push(`900: scrolled to its end, the last link ends at ${midEnd.lastBottom}px, past ${midEnd.viewport}`);
    checkBubble(await bubble(false), "900");

    // 4. A nested shell follows its own state, not the outer shell's.
    await openSection(page, "navigation-appshell", { view, width: 1280, height: 900 });
    const nested = () =>
      page.evaluate(() => {
        const width = (shell) =>
          shell?.querySelector(":scope > .r-navigation-shell-sidebar .r-navigation-shell-sidebar-inner")?.getBoundingClientRect().width ?? null;
        const demo = document.querySelector("#navigation-appshell .r-navigation-shell");
        const outer = demo?.parentElement?.closest(".r-navigation-shell");
        const probe = document.createElement("div");
        probe.style.inlineSize = "var(--COLUMN-MD)";
        document.body.append(probe);
        const column = probe.getBoundingClientRect().width;
        probe.remove();
        return { nested: outer !== null && outer !== undefined, collapsed: demo?.hasAttribute("data-collapsed") ?? null, demo: width(demo), outer: width(outer), column };
      });
    const demoToggle = (name) => page.locator("#navigation-appshell .r-navigation-shell").first().locator(`:scope > .r-navigation-shell-sidebar button[aria-label="${name}"]`);
    const open = await nested();
    if (!open.nested) fail.push("nested: harness: the AppShell demo is not inside the showcase's shell");
    if (Math.abs(open.demo - open.column) > 0.5) fail.push(`nested: the demo's full sidebar is ${open.demo}px, --COLUMN-MD is ${open.column}px`);
    await demoToggle("Collapse sidebar").click();
    await settle(page);
    const shut = await nested();
    if (!shut.collapsed) fail.push("nested: harness: the demo's toggle did not collapse its shell");
    if (!(shut.demo < open.demo / 2)) fail.push(`nested: collapsed, the demo's sidebar is still ${shut.demo}px (was ${open.demo}px): the outer shell holds it open`);
    if (Math.abs(shut.outer - shut.column) > 0.5) fail.push(`nested: collapsing the demo moved the showcase's sidebar to ${shut.outer}px`);
    await demoToggle("Expand sidebar").click();
    await settle(page);
    const reopened = await nested();
    if (Math.abs(reopened.demo - open.demo) > 0.5) fail.push(`nested: expanded again, the demo's sidebar is ${reopened.demo}px, was ${open.demo}px`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`navigation-shell-rail:\n  ${fail.join("\n  ")}`);
  return "navigation-shell-rail OK: a rail taller than the screen scrolls (never sideways) to its last link and its expand toggle; the bubbles sit beside their links after the scroll, in LTR and RTL; a shell inside another's main collapses by its own toggle";
}
