// Browser check: the contract's `hit-area` utility, as the components use it.
//
// jsdom computes no geometry and no hit testing; this measures both with
// `elementFromPoint` and real pointer presses on the Overview.
//
// At coarse input (comfortable density) it asserts:
//   1. harness: --HIT-MIN reads 44px, and an IconButton is ICON + 2 × R-SIZE-4
//      square (32px), so its hit box must grow 6px past each edge;
//   2. a lone IconButton answers presses 5px outside its visible box, on both axes;
//   3. in the dense toolbar (4 IconButtons, gap r6 = 4px) a press 1px inside the
//      first button's END edge reaches the first button, not its neighbour (the
//      later hit area does not grow back over it), a press in the gap reaches the
//      first button, and the last button still grows past its own end;
//   4. a Checkbox's box takes a press on the native input itself (the hit box sits
//      behind it), and a real click 5px outside the box toggles it exactly once;
//   5. labelled checkboxes stacked in a list (Email / Slack / SMS): each row is at
//      least --HIT-MIN tall, and a press 1px inside a box's top or bottom edge
//      reaches that box's own row, never the neighbour's.
// At fine input the 32px button already clears the 24px floor: a press 3px outside
// it reaches nothing of the button (the hit box only grows when it must).
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const setView = async (input) => {
    await page.goto(`${base}#/overview/primitives-iconbutton`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme: "default",
      density: "comfortable",
      input,
    });
    await page.reload();
    await page.locator("#primitives-iconbutton").waitFor();
    await page.waitForTimeout(200);
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await setView("coarse");

  const coarse = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const px = (n) => Number.parseFloat(css.getPropertyValue(n)) * Number.parseFloat(css.fontSize);
    const section = document.querySelector("#primitives-iconbutton");
    const lone = section.querySelector('button[aria-label="Settings"]');
    lone.scrollIntoView({ block: "center" });
    const hitAt = (x, y, el) => document.elementFromPoint(x, y)?.closest("button") === el;
    const r = lone.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const cx = r.left + r.width / 2;
    const loneStart = hitAt(r.left - 5, cy, lone);
    const loneEnd = hitAt(r.right + 5, cy, lone);
    const loneTop = hitAt(cx, r.top - 5, lone);

    // The toolbar: the one container whose children are exactly these four buttons.
    const labels = ["Bold", "Edit", "Delete", "Settings"];
    const bar = [...section.querySelectorAll("div")].find(
      (d) => d.children.length === 4 && [...d.children].every((c, i) => c.getAttribute("aria-label") === labels[i]),
    );
    const toolbar = bar ? [...bar.children] : [];
    toolbar[0]?.scrollIntoView({ block: "center" });
    const [a, b] = toolbar.map((t) => t.getBoundingClientRect());
    const last = toolbar[3]?.getBoundingClientRect();
    const ty = a ? a.top + a.height / 2 : 0;
    const whoAt = (x, y) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null;
    if (!a || !b || !last) return { hit: px("--HIT-MIN"), predicted: 0, size: [r.width, r.height], toolbarCount: toolbar.length };
    return {
      hit: px("--HIT-MIN"),
      predicted: px("--ICON") + 2 * px("--R-SIZE-4"),
      size: [r.width, r.height],
      loneStart,
      loneEnd,
      loneTop,
      toolbarCount: toolbar.length,
      gap: b.left - a.right,
      firstEdge: whoAt(a.right - 1, ty),
      inGap: whoAt(a.right + (b.left - a.right) / 2, ty),
      secondStart: whoAt(b.left + 1, ty),
      lastEnd: whoAt(last.right + 5, ty),
    };
  });
  if (coarse.hit !== 44) fail.push(`harness: --HIT-MIN at coarse is ${coarse.hit}px, source predicts 44px`);
  if (coarse.size[0] !== coarse.predicted || coarse.size[1] !== coarse.predicted) {
    fail.push(`harness: IconButton is ${coarse.size.join("×")}px, source predicts ${coarse.predicted}px square`);
  }
  if (!coarse.loneStart || !coarse.loneEnd || !coarse.loneTop) fail.push(`lone IconButton does not answer 5px outside: ${JSON.stringify(coarse)}`);
  if (coarse.toolbarCount !== 4) fail.push(`harness: found ${coarse.toolbarCount} toolbar buttons, expected 4`);
  if (!(coarse.gap > 0 && coarse.gap < 12)) fail.push(`harness: toolbar gap ${coarse.gap}px is not the tight case (0 < gap < 12)`);
  if (coarse.firstEdge !== "Bold") fail.push(`a press inside the first button's end edge reached ${coarse.firstEdge}`);
  if (coarse.inGap !== "Bold") fail.push(`a press in the toolbar gap reached ${coarse.inGap}, expected the earlier button`);
  if (coarse.secondStart !== "Edit") fail.push(`a press inside the second button's start edge reached ${coarse.secondStart}`);
  if (coarse.lastEnd !== "Settings") fail.push(`the last toolbar button does not grow past its end (${coarse.lastEnd})`);

  // Checkbox: the native input stays on top of its own hit box.
  await page.goto(`${base}#/overview/form-checkbox`);
  await page.locator("#form-checkbox").waitFor();
  await page.waitForTimeout(200);
  const box = page.locator('#form-checkbox input[aria-label="Select row 3"]');
  await box.scrollIntoViewIfNeeded();
  const before = await box.isChecked();
  const geo = await box.evaluate((input) => {
    const r = input.parentElement.getBoundingClientRect();
    const center = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { left: r.left, cy: r.top + r.height / 2, width: r.width, centerIsInput: center === input };
  });
  if (!geo.centerIsInput) fail.push("a press on the checkbox's box does not reach the native input");
  await page.mouse.click(geo.left - 5, geo.cy);
  const after = await box.isChecked();
  if (after === before) fail.push(`a click 5px outside the ${geo.width}px checkbox box did not toggle it`);
  await page.mouse.click(geo.left - 5, geo.cy);
  if ((await box.isChecked()) !== before) fail.push("a second click outside the box did not toggle it back (double toggle?)");

  const stacked = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("#form-checkbox label")].filter((l) =>
      ["Email", "Slack", "SMS"].includes(l.textContent.trim()),
    );
    labels[0]?.scrollIntoView({ block: "center" });
    return labels.map((l) => {
      const box = l.querySelector("input").parentElement.getBoundingClientRect();
      const who = (y) => document.elementFromPoint(box.left + box.width / 2, y)?.closest("label")?.textContent.trim();
      return { label: l.textContent.trim(), height: l.getBoundingClientRect().height, top: who(box.top + 1), bottom: who(box.bottom - 1) };
    });
  });
  if (stacked.length !== 3) fail.push(`harness: found ${stacked.length} stacked checkboxes, expected 3`);
  for (const row of stacked) {
    if (row.height < coarse.hit) fail.push(`stacked checkbox "${row.label}" is ${row.height}px tall, under the ${coarse.hit}px floor`);
    if (row.top !== row.label || row.bottom !== row.label) {
      fail.push(`a press on "${row.label}"'s box edges reached "${row.top}" / "${row.bottom}"`);
    }
  }

  // Fine input: the 32px button clears the 24px floor, so nothing grows.
  await setView("fine");
  const fine = await page.evaluate(() => {
    const lone = document.querySelector('#primitives-iconbutton button[aria-label="Settings"]');
    lone.scrollIntoView({ block: "center" });
    const r = lone.getBoundingClientRect();
    return { outside: document.elementFromPoint(r.left - 3, r.top + r.height / 2)?.closest("button") === lone };
  });
  if (fine.outside) fail.push("at fine input a press 3px outside a 32px IconButton still reached it");

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  const result = { coarse, checkbox: geo, stacked, fine };
  if (fail.length) throw new Error(`hit-areas FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `hit-areas OK ${JSON.stringify(result)}`;
}
