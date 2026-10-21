// @covers playground, theme, density
// @cost   10
//
// Browser check: what someone saved in the playground never reaches a check's
// route. The playground restores its saved View before the first paint; the
// full-page route takes its axes from the URL alone.
//
// On `/`, the View panel's switchers save a theme (the last one the list
// offers), compact density and touch input; then:
//   1. reloaded, `/` restores all three on <html> (the save took: without it
//      the rest proves nothing);
//   2. `?view=analytics-overview` sets none of them: no data-theme,
//      data-density or data-input on <html>, and no host density on the view root;
//   3. `?view=analytics-overview&theme=aurora&density=comfortable` puts the
//      URL's theme on <html> and the URL's density on the view root.
// The saved View is cleared at the end, pass or fail: the session outlives the check.
async (page) => {
  const problems = [];
  const axes = () =>
    page.evaluate((view) => {
      const root = document.documentElement;
      return {
        theme: root.getAttribute("data-theme"),
        density: root.getAttribute("data-density"),
        input: root.getAttribute("data-input"),
        viewDensity: document.querySelector(view)?.getAttribute("data-density") ?? null,
      };
    }, VIEW_SELECTOR);

  try {
    await page.goto("about:blank");
    await page.goto(BROWSER_CHECK_HOME);
    await waitForReady(page);
    await page.getByRole("banner").getByRole("button", { name: "View", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "View settings" });
    await panel.waitFor({ state: "visible", timeout: 5_000 });
    const themes = await panel.getByLabel("Theme").evaluate((element) => [...element.querySelectorAll("option")].map((option) => option.value));
    const theme = themes.filter((value) => value !== "default").at(-1);
    if (theme === undefined) throw new Error(`harness: the theme list offers nothing but the default (${JSON.stringify(themes)})`);
    await panel.getByLabel("Theme").selectOption(theme);
    await panel.getByRole("radiogroup", { name: "Density" }).getByText("Compact", { exact: true }).click();
    await panel.getByRole("radiogroup", { name: "Input" }).getByText("Touch", { exact: true }).click();

    // 1. the save took
    await page.reload();
    await waitForReady(page);
    const restored = await axes();
    if (restored.theme !== theme || restored.density !== "compact" || restored.input !== "coarse") {
      throw new Error(`harness: \`/\` restored ${JSON.stringify(restored)} after saving ${theme}, compact, coarse; the save did not take`);
    }

    // 2. the full-page route ignores it
    await openView(page, "analytics-overview");
    const bare = await axes();
    for (const axis of ["theme", "density", "input", "viewDensity"]) {
      if (bare[axis] !== null) problems.push(`?view= with no axes: ${axis} is ${JSON.stringify(bare[axis])}, from the saved View`);
    }

    // 3. the URL's axes, never the saved ones
    await openView(page, "analytics-overview", { theme: "aurora", density: "comfortable" });
    const asked = await axes();
    if (asked.theme !== "aurora") problems.push(`?view=…&theme=aurora: <html data-theme> is ${JSON.stringify(asked.theme)}`);
    if (asked.viewDensity !== "comfortable") problems.push(`?view=…&density=comfortable: the view root's density is ${JSON.stringify(asked.viewDensity)}`);
    if (asked.density !== null || asked.input !== null) problems.push(`?view=…: <html> carries density ${JSON.stringify(asked.density)}, input ${JSON.stringify(asked.input)}`);
  } finally {
    await page.goto(BROWSER_CHECK_HOME);
    await page.evaluate(() => localStorage.clear());
  }

  return report(problems, "the saved theme, density and input reach `/` and never `?view=`");
};
