// Browser check: overlays animate OUT, in CSS, and reduced motion makes the
// close instant.
//
// jsdom runs no CSS and no Web Animations, so the exit is only provable here.
// The panel leaves its open state at once (`hidePopover()` / `dialog.close()`);
// `transition-behavior: allow-discrete` on `display` and `overlay` keeps it
// painted while it transitions, and the component unmounts it when
// `getAnimations()` reports the exit finished.
//
// Asserts, on the Overview's Popover ("With arrow") and Dialog ("Rename
// dashboard") demos:
//   1. harness: once open and settled, the panel's opacity is 1 (the dialog's
//      scrim too), so a mid-transition sample has something to fall from; and
//      the popover ARRIVES animated too (some frame of its open is between 0
//      and 1: a starting style never applies to a panel promoted after layout);
//   2. two frames after it leaves its open state (React commits the close a
//      frame or more after the click, so the clock starts there): the panel is
//      still in the DOM and painted (display not none), it is inert, and focus
//      is already back on the trigger; and on some frame of the exit its opacity
//      is strictly between 0 and 1 (the dialog's ::backdrop too);
//   3. within 1s it is gone (popover unmounted; dialog display none, then empty);
//   4. with `prefers-reduced-motion: reduce` emulated, the same close shows no
//      fade (no frame between 0 and 1 opacity) and is gone (popover unmounted,
//      dialog display none) within 100ms of the first sample. "Within 100ms"
//      rather than "on frame N": a 0.01ms transition still needs a frame or two
//      to start and finish, and a loaded machine stretches frames.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  await page.setViewportSize({ width: 1280, height: 900 });

  const openPopover = async () => {
    await page.goto(`${base}#/overview/overlays-popover`);
    await page.reload();
    await waitForShowcase(page);
    const trigger = page.locator("#overlays-popover").getByRole("button", { name: "With arrow" });
    await trigger.waitFor();
    await trigger.scrollIntoViewIfNeeded();
    const arriving = await page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      [...document.querySelectorAll("#overlays-popover button")].find((b) => b.textContent.trim() === "With arrow").click();
      const seen = [];
      for (let i = 0; i < 20; i++) {
        await frame();
        const p = document.querySelector('[role="dialog"][aria-label="About"]');
        if (p) seen.push(Number(getComputedStyle(p).opacity));
      }
      return seen.filter((o) => o > 0.01 && o < 0.99);
    });
    await page.getByRole("dialog", { name: "About" }).waitFor();
    await page.waitForTimeout(400);
    return arriving;
  };

  // Closes with the trigger (a toggle) and samples in-page, so no protocol
  // round trip sits between the close and the first sample.
  const closePopover = () =>
    page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const panel = () => document.querySelector('[role="dialog"][aria-label="About"]');
      const trigger = [...document.querySelectorAll("#overlays-popover button")].find(
        (b) => b.textContent.trim() === "With arrow"
      );
      const before = Number(getComputedStyle(panel()).opacity);
      trigger.click();
      const closing = performance.now();
      while (panel()?.matches(":popover-open") && performance.now() - closing < 1000) await frame();
      await frame();
      await frame();
      const p = panel();
      const mid = p && {
        opacity: Number(getComputedStyle(p).opacity),
        display: getComputedStyle(p).display,
        open: p.matches(":popover-open"),
        inert: p.inert,
      };
      const focusBack = document.activeElement === trigger;
      const started = performance.now();
      const fading = [];
      while (panel() && performance.now() - started < 1000) {
        const o = Number(getComputedStyle(panel()).opacity);
        if (o > 0.01 && o < 0.99) fading.push(o);
        await frame();
      }
      return { before, mid, focusBack, fading, goneAfter: panel() ? null : Math.round(performance.now() - started) };
    });

  const openDialog = async () => {
    await page.goto(`${base}#/overview/overlays-dialog`);
    await page.reload();
    await waitForShowcase(page);
    const trigger = page.locator("#overlays-dialog").getByRole("button", { name: "Rename dashboard" });
    await trigger.waitFor();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.getByRole("dialog", { name: "Rename dashboard" }).waitFor();
    await page.waitForTimeout(400);
  };

  const closeDialog = () =>
    page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const dialog = [...document.querySelectorAll("#overlays-dialog dialog")].find((d) =>
        d.textContent.includes("Everyone with access")
      );
      const trigger = [...document.querySelectorAll("#overlays-dialog button")].find(
        (b) => b.textContent.trim() === "Rename dashboard"
      );
      const read = () => ({
        opacity: Number(getComputedStyle(dialog).opacity),
        scrim: Number(getComputedStyle(dialog, "::backdrop").opacity),
        display: getComputedStyle(dialog).display,
        open: dialog.open,
        content: dialog.textContent.includes("Everyone with access"),
      });
      const before = read();
      [...dialog.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel").click();
      const closing = performance.now();
      while (dialog.open && performance.now() - closing < 1000) await frame();
      await frame();
      await frame();
      const mid = read();
      const focusBack = document.activeElement === trigger;
      const started = performance.now();
      const fading = [];
      while (getComputedStyle(dialog).display !== "none" && performance.now() - started < 1000) {
        const { opacity, scrim } = read();
        if (opacity > 0.01 && opacity < 0.99 && scrim > 0.01 && scrim < 0.99) fading.push(opacity);
        await frame();
      }
      const goneAfter = getComputedStyle(dialog).display === "none" ? Math.round(performance.now() - started) : null;
      // The content unmounts in the render after the exit's `finished` settles.
      for (let i = 0; i < 6 && dialog.textContent.includes("Everyone with access"); i++) await frame();
      return { before, mid, focusBack, fading, after: read(), goneAfter };
    });

  // Normal motion.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const arriving = await openPopover();
  if (arriving.length === 0) fail.push("popover: no frame of its open had an opacity between 0 and 1 (no entrance)");
  const pop = await closePopover();
  if (pop.before !== 1) fail.push(`harness: open popover opacity is ${pop.before}, expected 1`);
  if (!pop.mid) fail.push("popover: unmounted the moment it closed (no exit)");
  else {
    if (pop.mid.display === "none") fail.push("popover: display none mid-exit (allow-discrete not holding it)");
    if (pop.mid.open) fail.push("popover: still :popover-open after close");
    if (pop.fading.length === 0) fail.push("popover: no frame of the exit had an opacity between 0 and 1");
    if (!pop.mid.inert) fail.push("popover: the leaving panel is still interactive (not inert)");
  }
  if (!pop.focusBack) fail.push("popover: focus is not back on the trigger during the exit");
  if (pop.goneAfter === null) fail.push("popover: still mounted 1s after close");

  await openDialog();
  const dlg = await closeDialog();
  if (dlg.before.opacity !== 1 || dlg.before.scrim !== 1) fail.push(`harness: open dialog ${JSON.stringify(dlg.before)}, expected opacity and scrim 1`);
  if (dlg.mid.display === "none") fail.push("dialog: display none the moment it closed (no exit)");
  if (dlg.mid.open) fail.push("dialog: still open after Cancel");
  if (!dlg.mid.content) fail.push("dialog: content unmounted before the exit ran (it would animate out empty)");
  if (dlg.fading.length === 0) fail.push("dialog: no frame of the exit had the panel and scrim between 0 and 1 opacity");
  if (!dlg.focusBack) fail.push("dialog: focus is not back on the trigger during the exit");
  if (dlg.goneAfter === null) fail.push("dialog: still displayed 1s after close");
  if (dlg.after.content) fail.push("dialog: content still mounted after the exit");

  // Reduced motion: no fade, and gone at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPopover();
  const popReduced = await closePopover();
  if (popReduced.fading.length) fail.push(`reduced motion: popover faded (${popReduced.fading.join(", ")})`);
  if (popReduced.goneAfter === null || popReduced.goneAfter > 100) fail.push(`reduced motion: popover unmounted after ${popReduced.goneAfter}ms, expected within 100ms`);
  if (!popReduced.focusBack) fail.push("reduced motion: popover focus not returned");
  await openDialog();
  const dlgReduced = await closeDialog();
  if (dlgReduced.fading.length) fail.push(`reduced motion: dialog faded (${dlgReduced.fading.join(", ")})`);
  if (dlgReduced.goneAfter === null || dlgReduced.goneAfter > 100) fail.push(`reduced motion: dialog displayed for ${dlgReduced.goneAfter}ms more, expected within 100ms`);
  if (!dlgReduced.focusBack) fail.push("reduced motion: dialog focus not returned");
  await page.emulateMedia({ reducedMotion: null });

  const result = { pop, dlg, popReduced, dlgReduced };
  if (fail.length) throw new Error(`motion-overlay-exit FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  const fmt = (list) => list.map((o) => o.toFixed(2)).join(" ");
  return `motion-overlay-exit OK popover fades ${fmt(pop.fading)}, gone in ${pop.goneAfter}ms; dialog + scrim fade ${fmt(dlg.fading)}, gone in ${dlg.goneAfter}ms; reduced motion: no fade, gone in ${popReduced.goneAfter}/${dlgReduced.goneAfter}ms`;
}
