// @covers theme, overlays, charts, corpus
// @cost   20
//
// Browser check: a document's `theme` recolours its own view, everything that
// floats out of it, and nothing else; its scheme reaches the library's own
// colours; and a host that turns themes off keeps its own.
//
// On the product document `status-page` (a whole dark palette, `scheme: "dark"`):
//   1. the view root carries the document's roles, is marked themed, and paints
//      its own canvas: its background is the colour `var(--C-CANVAS)` resolves
//      to inside the view, which is not the page's;
//   2. the popover ("Get updates"), the dialog ("Read the October report") and
//      the tooltip ("About Public API") resolve --C-SURFACE-0 to the document's
//      value and paint a background the host's surface would not give them;
//   3. nothing outside the view changes: <html> and <body> keep the canvas,
//      ink, --C-CANVAS, --SCHEME-DARK and color-scheme they have under an
//      unthemed document;
//   4. the view's --SCHEME-DARK is 1, and the chart's first series is painted
//      another colour than with the theme turned off;
//   5. with `theme-overrides=off` (the host's `themeOverrides: false`) the view
//      is not themed, its canvas role is the page's, and the issue log holds
//      exactly one `theme-disabled`;
//   6. print and forced colours set the document's roles aside: under each, the
//      view resolves --C-CANVAS, --C-TEXT-PRIMARY and --SCHEME-DARK as <html>
//      does; under more contrast its hairline takes its own strong border.
// No other diagnostic anywhere.
async (page) => {
  const NAME = "status-page";
  const problems = [];

  /** The page's colours and the roles <html> and <body> resolve. */
  const outside = () =>
    page.evaluate(() =>
      [document.documentElement, document.body].map((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          ink: style.color,
          canvas: style.getPropertyValue("--C-CANVAS").trim(),
          dark: style.getPropertyValue("--SCHEME-DARK").trim(),
          scheme: style.colorScheme,
        };
      }),
    );

  /** What the view root carries and paints, and what `var(--C-CANVAS)` resolves to inside it. */
  const view = () =>
    page.evaluate(({ selector, themed }) => {
      const root = document.querySelector(selector);
      if (root === null) return null;
      const probe = document.createElement("span");
      probe.style.color = "var(--C-CANVAS)";
      root.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(root);
      const series = root.querySelector("svg g[data-series]");
      return {
        themed: root.classList.contains(themed),
        canvasRole: style.getPropertyValue("--C-CANVAS").trim(),
        dark: style.getPropertyValue("--SCHEME-DARK").trim(),
        background: style.backgroundColor,
        resolvedCanvas: resolved,
        series: series === null ? null : getComputedStyle(series).color,
      };
    }, { selector: VIEW_SELECTOR, themed: THEMED_CLASS });

  /** A floating panel's surface role and painted background. */
  const panel = (locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return { surface: style.getPropertyValue("--C-SURFACE-0").trim(), background: style.backgroundColor };
    });

  // The page as an unthemed document leaves it.
  await openView(page, "release-notes");
  const before = await outside();

  await openView(page, NAME);
  const themed = await view();
  if (themed === null) throw new Error("harness: no view root on the page");
  const expected = { canvas: "oklch(0.21 0.025 275)", surface: "oklch(0.27 0.03 275)" };

  // 1. the view's own floor
  if (!themed.themed) problems.push("the view root is not marked themed");
  if (themed.canvasRole !== expected.canvas) problems.push(`the view resolves --C-CANVAS to ${JSON.stringify(themed.canvasRole)}, not the document's ${expected.canvas}`);
  if (themed.background !== themed.resolvedCanvas) problems.push(`the view paints ${themed.background}, not its canvas ${themed.resolvedCanvas}`);
  if (themed.background === before[1].background || themed.background === before[0].background) problems.push(`the view paints the page's own background (${themed.background})`);

  // 2. every floating panel takes the view's roles
  const hostSurface = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--C-SURFACE-0)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  const panels = {};
  await page.getByRole("button", { name: "Get updates" }).click();
  const popover = page.getByText("Follow this page", { exact: true });
  await popover.waitFor({ state: "visible", timeout: 5_000 });
  panels.popover = await panel(popover.locator("xpath=ancestor::*[@popover][1]"));
  await page.keyboard.press("Escape");
  await popover.waitFor({ state: "hidden", timeout: 5_000 });

  await page.getByRole("button", { name: "Read the October report" }).click();
  const dialog = page.getByRole("dialog", { name: "Invoices failed to generate" });
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  panels.dialog = await panel(dialog);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5_000 });

  await page.getByRole("button", { name: "About Public API" }).hover();
  const tooltip = page.getByRole("tooltip");
  await tooltip.waitFor({ state: "visible", timeout: 5_000 });
  panels.tooltip = await panel(tooltip);
  await page.mouse.move(0, 0);

  for (const [name, seen] of Object.entries(panels)) {
    if (seen.surface !== expected.surface) problems.push(`the ${name} resolves --C-SURFACE-0 to ${JSON.stringify(seen.surface)}, not the document's ${expected.surface}`);
    if (seen.background === hostSurface) problems.push(`the ${name} paints the host's surface (${seen.background})`);
  }

  // 3. nothing outside the view
  const after = await outside();
  for (const [index, element] of ["<html>", "<body>"].entries()) {
    for (const key of Object.keys(before[index])) {
      if (after[index][key] !== before[index][key]) problems.push(`${element} ${key} is ${JSON.stringify(after[index][key])} beside the themed view, ${JSON.stringify(before[index][key])} without`);
    }
  }
  problems.push(...(await diagnosticProblems(page, NAME)));

  // 6. the page's preferences win over the document's roles
  const roles = () =>
    page.evaluate((selector) => {
      const read = (element) => {
        const style = getComputedStyle(element);
        return ["--C-CANVAS", "--C-TEXT-PRIMARY", "--SCHEME-DARK", "--C-BORDER", "--C-BORDER-STRONG"].map((name) => style.getPropertyValue(name).trim());
      };
      return { page: read(document.documentElement), view: read(document.querySelector(selector)) };
    }, VIEW_SELECTOR);
  for (const media of [{ media: "print" }, { forcedColors: "active" }]) {
    await page.emulateMedia(media);
    const seen = await roles();
    if (JSON.stringify(seen.view.slice(0, 3)) !== JSON.stringify(seen.page.slice(0, 3))) {
      problems.push(`${JSON.stringify(media)}: the view resolves ${JSON.stringify(seen.view.slice(0, 3))}, the page ${JSON.stringify(seen.page.slice(0, 3))}`);
    }
    await page.emulateMedia({ media: null, forcedColors: null });
  }
  await page.emulateMedia({ contrast: "more" });
  const more = await roles();
  if (more.page[3] !== more.page[4]) throw new Error(`harness: more contrast is not emulated (the page's hairline ${more.page[3]}, its strong border ${more.page[4]})`);
  if (more.view[3] !== more.view[4] || more.view[4] === more.page[4]) problems.push(`more contrast: the view's hairline is ${more.view[3]}, its own strong border ${more.view[4]}`);
  await page.emulateMedia({ contrast: null });

  // 5. the host turns themes off
  await openView(page, NAME, { "theme-overrides": "off" });
  const plain = await view();
  if (plain === null) throw new Error("harness: no view root with theme-overrides=off");
  if (plain.themed) problems.push("theme-overrides=off: the view root is still themed");
  if (plain.canvasRole !== before[0].canvas) problems.push(`theme-overrides=off: the view resolves --C-CANVAS to ${JSON.stringify(plain.canvasRole)}, the page's is ${JSON.stringify(before[0].canvas)}`);
  const disabled = (await diagnostics(page)).map((d) => `${d.code} ${d.path}`);
  if (JSON.stringify(disabled) !== JSON.stringify(["theme-disabled /theme"])) problems.push(`theme-overrides=off: diagnostics ${JSON.stringify(disabled)}, not one theme-disabled at /theme`);

  // 4. the scheme reaches the library's own colours
  if (themed.dark !== "1") problems.push(`the themed view resolves --SCHEME-DARK to ${JSON.stringify(themed.dark)}, not 1`);
  if (plain.dark !== "0") problems.push(`theme-overrides=off: the view resolves --SCHEME-DARK to ${JSON.stringify(plain.dark)}, not the page's 0`);
  if (themed.series === null || plain.series === null) throw new Error("harness: the chart drew no series");
  if (themed.series === plain.series) problems.push(`the first series is ${themed.series} under the dark scheme and with themes off: the scheme did not reach it`);

  return report(problems, `the view paints ${themed.background}; popover, dialog and tooltip on ${expected.surface}; the page unchanged; series ${themed.series} dark vs ${plain.series} light; off: theme-disabled`);
};
