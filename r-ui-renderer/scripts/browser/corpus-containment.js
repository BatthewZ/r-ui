// @covers overlays, corpus
// @cost   12
//
// Browser check: a document cannot cover the host page, and its overlays
// still reach past its view.
//
// The control document `contained-overlays` holds a card whose classes ask
// for the whole page (`fixed inset-0 z-sticky`: outside the vocabulary, so the
// validator warns, but the library's stylesheet compiles them). The view root
// contains layout and paint, so a fixed descendant is placed and clipped by
// the view's box, not the viewport. The tooltip, popover and dialog inside the
// card are promoted to the top layer, which no ancestor clips. On
// `?view=contained-overlays`:
//   1. harness: the card is `position: fixed` (its classes compiled) and the
//      view ends well above the viewport's bottom, so "the view" and "the page"
//      are different boxes;
//   2. the card's box lies inside the view's box, and the point between the
//      view's bottom and the viewport's bottom is not the card's;
//   3. the dialog ("Confirm delivery") is `:modal`, the popover ("Add a note")
//      and the tooltip (hovering "About notes") are `:popover-open`; the dialog
//      and the popover reach below the view, and the point there hits them
//      (paint containment would clip anything not on the top layer);
//   4. no diagnostic.
async (page) => {
  const problems = [];
  await openView(page, "contained-overlays");
  const view = await page.locator(VIEW_SELECTOR).boundingBox();
  const card = page.locator('[data-control="cover"]');
  if (!view) throw new Error("harness: the view has no box");
  const position = await card.evaluate((element) => getComputedStyle(element).position);
  if (position !== "fixed") throw new Error(`harness: the card is position ${position}; its classes did not compile, so containment is untested`);
  const viewBottom = view.y + view.height;
  if (viewBottom > VIEWPORT.height - 120) throw new Error(`harness: the view reaches ${Math.round(viewBottom)}px of ${VIEWPORT.height}; nothing below it to cover`);

  // 2. the card stays in the view's box
  const box = await card.boundingBox();
  const inside = box && box.x >= view.x - 1 && box.y >= view.y - 1 && box.x + box.width <= view.x + view.width + 1 && box.y + box.height <= viewBottom + 1;
  if (!inside) problems.push(`the card covers ${JSON.stringify(box)}, outside the view's ${JSON.stringify(view)}`);
  const below = { x: view.x + view.width / 2, y: (viewBottom + VIEWPORT.height) / 2 };
  if (await card.evaluate((element, { x, y }) => element.contains(document.elementFromPoint(x, y)), below)) {
    problems.push(`the card takes the point (${below.x}, ${Math.round(below.y)}) below the view`);
  }

  const onTopLayer = (locator) => locator.evaluate((element) => element.closest(":popover-open, :modal") !== null);
  /** Whether `locator` reaches below the view and takes a point there. */
  const reachesPast = async (label, locator) => {
    const panel = await locator.boundingBox();
    if (!panel || panel.y + panel.height < viewBottom + 12) {
      problems.push(`harness: the ${label} ends at ${panel ? Math.round(panel.y + panel.height) : "nothing"}, not below the view (${Math.round(viewBottom)})`);
      return;
    }
    const point = { x: panel.x + panel.width / 2, y: Math.max(viewBottom + 6, panel.y + panel.height / 2) };
    if (!(await locator.evaluate((element, { x, y }) => element.contains(document.elementFromPoint(x, y)), point))) {
      problems.push(`the ${label} is clipped: the point (${Math.round(point.x)}, ${Math.round(point.y)}) below the view does not hit it`);
    }
  };

  // 3. the popover
  await page.getByRole("button", { name: "Add a note" }).click();
  const popover = page.getByRole("dialog", { name: "New note" });
  await popover.waitFor({ state: "visible", timeout: 5_000 });
  if (!(await onTopLayer(popover))) problems.push("the popover is not in the top layer");
  await reachesPast("popover", popover);
  await page.keyboard.press("Escape");
  await popover.waitFor({ state: "hidden", timeout: 5_000 });

  // the dialog
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm delivery" });
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  if (!(await dialog.evaluate((element) => element.matches(":modal")))) problems.push("the dialog is not modal in the top layer");
  await reachesPast("dialog", dialog);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5_000 });

  // the tooltip: its panel takes no pointer, so the top layer is the claim
  await page.getByRole("button", { name: "About notes" }).hover();
  const tooltip = page.getByRole("tooltip");
  await tooltip.waitFor({ state: "visible", timeout: 5_000 });
  if (!(await onTopLayer(tooltip))) problems.push("the tooltip is not in the top layer");

  // 4.
  problems.push(...(await diagnosticProblems(page)));
  return report(problems, `the card stays in the view's ${Math.round(view.height)}px; the popover, dialog and tooltip open on the top layer past it`);
};
