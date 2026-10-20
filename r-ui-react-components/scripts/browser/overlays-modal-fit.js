// @covers   overlays/Dialog, overlays/Drawer
// @sections overlays-dialog overlays-drawer
// @tier     component
// @cost     12
//
// Browser check: a dialog or drawer never scrolls sideways, and its close
// button's hit area stays inside it.
//
// The close button is a ghost IconButton: a small visual box whose `hit-area`
// grows to --HIT-MIN (44px at coarse input). The modal is a scroll container, so a
// hit area that overhangs its padding box scrolls it sideways (compact + coarse put
// a 26px close 8px from the edge: a 9px overhang, a 1px scrollbar).
//
// At 375 wide, under comfortable + fine, comfortable + coarse and compact + coarse,
// it opens every dialog and drawer demo (LTR and RTL, the compact-subtree dialog,
// the end drawer and the bottom sheet) and asserts:
//   1. harness: each opened as a modal with a close button;
//   2. the modal's scrollWidth is at most its clientWidth (no sideways scroll);
//   3. the close's hit area (its box grown to --HIT-MIN, centred) lies inside the
//      modal's padding box on the block start and inline end (left in RTL);
//   4. the close stays in the corner: its offset from that edge is at most the
//      larger of --R-SIZE-3 and its hit area's overhang, plus 1px.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const TRIGGERS = [
    { section: "overlays-dialog", name: "Rename dashboard" },
    { section: "overlays-dialog", name: "Compact dialog" },
    { section: "overlays-dialog", name: "إعادة التسمية" },
    { section: "overlays-drawer", name: "Incident details" },
    { section: "overlays-drawer", name: "Bottom sheet" },
  ];
  const VIEWS = [
    { density: "comfortable", input: "fine" },
    { density: "comfortable", input: "coarse" },
    { density: "compact", input: "coarse" },
  ];
  let measured = 0;

  try {
    for (const v of VIEWS) {
      await openSection(page, ["overlays-dialog", "overlays-drawer"], { view: { theme: "default", ...v }, width: 375 });
      for (const t of TRIGGERS) {
        const label = `${v.density}/${v.input} "${t.name}"`;
        const trigger = page.locator(`#${t.section}`).getByRole("button", { name: t.name, exact: true });
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        await page.waitForFunction(() => document.querySelector("dialog.r-overlays-modal:modal") !== null);
        await settle(page);
        const m = await page.evaluate(() => {
          const modal = document.querySelector("dialog.r-overlays-modal:modal");
          const close = [...modal.children].find((c) => c.matches("button.r-overlays-close"));
          if (!close) return null;
          const cs = getComputedStyle(modal);
          const box = modal.getBoundingClientRect();
          const pad = {
            top: box.top + parseFloat(cs.borderTopWidth),
            left: box.left + parseFloat(cs.borderLeftWidth),
            right: box.right - parseFloat(cs.borderRightWidth),
          };
          const probe = document.createElement("div");
          probe.style.inlineSize = "var(--HIT-MIN)";
          probe.style.blockSize = "var(--R-SIZE-3)";
          modal.append(probe);
          const hit = probe.getBoundingClientRect().width;
          const r3 = probe.getBoundingClientRect().height;
          probe.remove();
          const c = close.getBoundingClientRect();
          const overX = Math.max(0, (hit - c.width) / 2);
          const overY = Math.max(0, (hit - c.height) / 2);
          const rtl = cs.direction === "rtl";
          return {
            scrollW: modal.scrollWidth,
            clientW: modal.clientWidth,
            r3,
            overX,
            overY,
            rtl,
            // How far the grown hit area sits inside the padding box (negative: it overhangs).
            inlineRoom: rtl ? c.left - overX - pad.left : pad.right - (c.right + overX),
            blockRoom: c.top - overY - pad.top,
            inlineOffset: rtl ? c.left - pad.left : pad.right - c.right,
            blockOffset: c.top - pad.top,
          };
        });
        if (!m) fail.push(`${label}: harness: no close button on the modal`);
        else {
          measured += 1;
          if (m.scrollW > m.clientW) fail.push(`${label}: scrolls sideways (${m.scrollW} > ${m.clientW})`);
          if (m.inlineRoom < -0.5 || m.blockRoom < -0.5)
            fail.push(`${label}: the close's hit area overhangs the modal by ${(-Math.min(m.inlineRoom, m.blockRoom)).toFixed(1)}px`);
          const corner = Math.max(m.r3, m.overX, m.overY) + 1;
          if (m.inlineOffset > corner || m.blockOffset > corner)
            fail.push(`${label}: the close sits ${m.inlineOffset.toFixed(1)} / ${m.blockOffset.toFixed(1)}px from the corner, expected at most ${corner.toFixed(1)}`);
        }
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector("dialog.r-overlays-modal:modal") === null);
        await settle(page);
      }
    }
    if (measured !== TRIGGERS.length * VIEWS.length) fail.push(`harness: measured ${measured} of ${TRIGGERS.length * VIEWS.length} modals`);
    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`overlays-modal-fit:\n  ${fail.join("\n  ")}`);
  return `overlays-modal-fit OK ${measured} modals at 375 (fine and coarse, comfortable and compact): none scrolls sideways, every close's hit area inside its modal, in the corner`;
}
