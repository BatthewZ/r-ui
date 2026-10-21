// @covers density, overlays, corpus
// @cost   15
//
// Browser check: the host's compact density reaches the panels a view floats
// on the top layer, not only what sits in the view's flow.
//
// The host density marks the view root (ViewRenderer's `density`), never
// `<html>`, so a panel portalled out of the view would miss it. On the overlays
// coverage document (which declares no density), with `input=fine` so the hit
// floor does not mask control heights, opened at `density=compact` and with no
// host density (comfortable):
//   1. the popover ("Add a note"), the menu ("Actions"), the alert dialog
//      ("Cancel shipment") and the tooltip ("Copy link") each resolve the
//      density-selected spacing token to the view root's value: the compact one
//      under the compact host, the comfortable one without it, and the two differ;
//   2. the popover's "Save note" button is shorter under the compact host.
async (page) => {
  const TOKEN = "--R-SIZE-3";
  const problems = [];
  const token = (locator) => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), TOKEN);

  /** Opens each panel in turn on a fresh view; the token on the view root and on each panel, and the popover button's height. */
  const measure = async (params) => {
    await openView(page, "overlays", { input: "fine", ...params });
    const seen = { view: await token(page.locator(VIEW_SELECTOR)), panels: {} };

    await page.getByRole("button", { name: "Add a note" }).click();
    const note = page.getByRole("textbox", { name: "Note" });
    await note.waitFor({ state: "visible", timeout: 5_000 });
    seen.panels.popover = await token(note);
    const save = await page.getByRole("button", { name: "Save note" }).boundingBox();
    seen.button = save ? Math.round(save.height * 100) / 100 : 0;
    await page.keyboard.press("Escape");
    await note.waitFor({ state: "hidden", timeout: 5_000 });

    await page.getByRole("button", { name: "Actions" }).click();
    const menu = page.getByRole("menu");
    await menu.waitFor({ state: "visible", timeout: 5_000 });
    seen.panels.menu = await token(menu);
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden", timeout: 5_000 });

    await page.getByRole("button", { name: "Cancel shipment" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Cancel this shipment?" });
    await dialog.waitFor({ state: "visible", timeout: 5_000 });
    seen.panels.dialog = await token(dialog);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 5_000 });

    await page.getByRole("button", { name: "Copy link" }).hover();
    const tooltip = page.getByRole("tooltip");
    await tooltip.waitFor({ state: "visible", timeout: 5_000 });
    seen.panels.tooltip = await token(tooltip);

    problems.push(...(await diagnosticProblems(page, `overlays ${JSON.stringify(params)}`)));
    return seen;
  };

  const compact = await measure({ density: "compact" });
  const comfortable = await measure({});
  if (compact.view === "" || compact.view === comfortable.view) {
    throw new Error(`harness: ${TOKEN} is ${JSON.stringify(compact.view)} on the compact view and ${JSON.stringify(comfortable.view)} on the comfortable one; the token does not tell them apart`);
  }

  // 1. every panel reads the view's density
  for (const [label, seen] of [["compact host", compact], ["no host density", comfortable]]) {
    for (const [panel, value] of Object.entries(seen.panels)) {
      if (value !== seen.view) problems.push(`${label}: the ${panel} resolves ${TOKEN} to ${JSON.stringify(value)}, the view to ${JSON.stringify(seen.view)}`);
    }
  }
  // 2. a control inside a panel is compact
  if (!(compact.button > 0 && compact.button < comfortable.button)) {
    problems.push(`the popover's button is ${compact.button}px under the compact host, ${comfortable.button}px without; not shorter`);
  }

  return report(problems, `${TOKEN}: ${compact.view} compact, ${comfortable.view} comfortable, on the view and its 4 panels; the popover's button ${compact.button}px vs ${comfortable.button}px`);
};
