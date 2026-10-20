// @covers   overlays/ToastProvider, navigation/AppShell
// @sections overlays-toast
// @tier     component
// @cost     15
//
// Browser check: on a phone, a toast stack sits above the AppShell's bottom nav,
// never over it; where no bottom nav is shown it keeps its old offset.
//
// The bottom nav publishes its block size on `:root` as
// `--r-navigation-shell-bottom-inset` (measured, so it follows density and input);
// the toast region adds it to its block-end offset (--R-SIZE-2).
//
// On the showcase's own shell (its bottom nav is shown below the md breakpoint),
// the Toast section alone, two toasts that stay (an error and one with an action:
// both lists of the stack) raised, it asserts:
//   1. at 375 × 740: harness: the nav is shown, docked on the viewport's bottom
//      edge, and the stack is in the top layer; the published inset equals the
//      nav's block size (±0.5px); the stack's bottom edge is --R-SIZE-2 above the
//      nav's top edge (±1px), so above it; the centre of every bottom-nav link hits
//      that link, not a toast;
//   2. at 375, compact: harness: the nav's height changed; 1 holds again (the
//      inset followed the resize);
//   3. at 1280 (no bottom nav): the inset is gone from `:root` and the stack's
//      bottom edge is --R-SIZE-2 above the viewport's (±1px), as before the inset;
//   4. back at 375: 1 holds again (the inset comes back with the nav).
//
// Breaks: drop the inset from the region's `inset-block-end` (1, 2, 4 go red: the
// stack overlaps the nav); stop BottomNav publishing (1 goes red on the inset);
// measure once instead of observing (2 or 3 goes red).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const NAV = "[data-showcase-bottomnav]";

  const measure = () =>
    page.evaluate((navSel) => {
      const nav = document.querySelector(navSel);
      const region = document.querySelector(".r-overlays-toast-region");
      const probe = document.createElement("div");
      probe.style.blockSize = "var(--R-SIZE-2)";
      region.parentElement.append(probe);
      const gap = probe.getBoundingClientRect().height;
      probe.remove();
      const n = nav.getBoundingClientRect();
      const r = region.getBoundingClientRect();
      const links = [...nav.querySelectorAll(".r-navigation-link")].map((link) => {
        const b = link.getBoundingClientRect();
        return { name: link.textContent.trim(), hits: link.contains(document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2)) };
      });
      return {
        navShown: getComputedStyle(nav).display !== "none" && n.height > 0,
        navTop: n.top,
        navBottom: n.bottom,
        navHeight: n.height,
        inset: document.documentElement.style.getPropertyValue("--r-navigation-shell-bottom-inset"),
        promoted: region.matches(":popover-open"),
        toasts: region.querySelectorAll("li[data-toast-id]:not([data-leaving])").length,
        stackBottom: r.bottom,
        gap,
        links,
        viewport: innerHeight,
      };
    }, NAV);

  const aboveNav = (m, where) => {
    if (!m.navShown) return fail.push(`${where}: harness: the showcase's bottom nav is not shown`);
    if (Math.abs(m.navBottom - m.viewport) > 1) fail.push(`${where}: harness: the nav ends at ${m.navBottom}px, not on the viewport's bottom edge (${m.viewport}px)`);
    if (!m.promoted) fail.push(`${where}: harness: the toast stack is not in the top layer`);
    if (m.toasts !== 2) fail.push(`${where}: harness: ${m.toasts} toasts on screen, expected 2`);
    if (!(m.gap > 0)) fail.push(`${where}: harness: --R-SIZE-2 measured ${m.gap}px`);
    const published = Number.parseFloat(m.inset);
    if (!(Math.abs(published - m.navHeight) <= 0.5)) fail.push(`${where}: --r-navigation-shell-bottom-inset is "${m.inset}", the nav is ${m.navHeight}px tall`);
    if (m.stackBottom > m.navTop) fail.push(`${where}: the stack's bottom edge (${m.stackBottom}px) is below the nav's top edge (${m.navTop}px): it covers the nav`);
    const off = m.navTop - m.gap - m.stackBottom;
    if (Math.abs(off) > 1) fail.push(`${where}: the stack ends ${(m.navTop - m.stackBottom).toFixed(1)}px above the nav, expected --R-SIZE-2 (${m.gap}px)`);
    if (m.links.length === 0) fail.push(`${where}: harness: the nav has no links`);
    for (const link of m.links) if (!link.hits) fail.push(`${where}: a press on "${link.name}" in the bottom nav does not reach it`);
  };

  try {
    const section = await openSection(page, "overlays-toast", {
      view: { theme: "default", density: "comfortable", input: "fine" },
      width: 375,
      height: 740,
    });
    await section.getByRole("button", { name: "Error (stays)" }).click();
    await section.getByRole("button", { name: "With action" }).click();
    await settle(page);

    // 1. Phone: above the nav.
    const phone = await measure();
    aboveNav(phone, "375");

    // 2. Compact: the nav resizes, the inset follows.
    await setView(page, { density: "compact" });
    const compact = await measure();
    if (Math.abs(compact.navHeight - phone.navHeight) < 0.5) fail.push(`375 compact: harness: the nav is ${compact.navHeight}px at both densities, nothing resized`);
    aboveNav(compact, "375 compact");
    await setView(page, { density: "comfortable" });

    // 3. Wide: no bottom nav, the old offset.
    await setView(page, { width: 1280 });
    const wide = await measure();
    if (wide.navShown) fail.push("1280: harness: the bottom nav is still shown");
    if (wide.toasts !== 2) fail.push(`1280: harness: ${wide.toasts} toasts on screen, expected 2`);
    if (wide.inset !== "") fail.push(`1280: --r-navigation-shell-bottom-inset is still "${wide.inset}" with no bottom nav shown`);
    const wideOff = wide.viewport - wide.gap - wide.stackBottom;
    if (Math.abs(wideOff) > 1) fail.push(`1280: the stack ends ${(wide.viewport - wide.stackBottom).toFixed(1)}px above the viewport's bottom, expected --R-SIZE-2 (${wide.gap}px)`);

    // 4. Back to the phone: the inset returns with the nav.
    await setView(page, { width: 375 });
    aboveNav(await measure(), "375 again");

    await section.getByRole("button", { name: "Dismiss all" }).click();
    await settle(page);
    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`overlays-toast-bottomnav:\n  ${fail.join("\n  ")}`);
  return "overlays-toast-bottomnav OK: at 375 the stack ends --R-SIZE-2 above the bottom nav (comfortable and compact, and again after a resize), the nav's links stay pressable; at 1280 the inset is gone and the stack keeps its old offset";
}
