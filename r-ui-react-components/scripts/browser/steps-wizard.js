// @covers   steps/Stepper, steps/Wizard
// @sections steps-stepper steps-wizard
// @tier     component
//
// Browser check: Stepper and Wizard in a real browser, on the "Invite your team"
// demo (showcase/sections/steps/Wizard.tsx) and the Stepper demos beside it.
//
// jsdom has no layout and no CSS: whether the narrow Stepper really collapses
// (a container query), the marker's size by density and what survives forced
// colours are only measurable here. The flow (an invalid step blocks Next and
// focuses its first invalid field, a press keeps focus in the field, focus on
// the new step's heading, the server check busy then blocking, Back keeping
// values, only completed steps selectable) is Wizard.test.tsx's and Stepper.test.tsx's.
//
// Asserts:
//   1. harness: a Stepper marker is exactly `--ICON + 2 × --R-SIZE-5` (the
//      formula in the steps stylesheet), and the Wizard's Next is `--CONTROL-H`;
//   2. a narrow container collapses the Stepper (list gone, "Step 1 of 4 · Team"
//      shown, its text "Step 1 of 4 · : Team" with the colon visually hidden) while the
//      wide one shows the list and hides the compact form;
//   3. compact density and coarse input: markers re-derive smaller than the
//      comfortable formula, and at 375 the compact Wizard collapses (the steps' and
//      Next's 44px floor and the page not scrolling sideways are sweep-overview's
//      geometry sweep);
//   4. forced colours: the five marker states (complete, skipped, current,
//      error, upcoming) differ pairwise in what survives forcing (border
//      style, width and colour, kept fill, glyph), and the current step is
//      still `aria-current`.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (view, width) => {
    await openSection(page, ["steps-stepper", "steps-wizard"], { view, width });
    const wizard = page.locator('[data-sc="wizard-invite"]');
    await wizard.waitFor();
    await wizard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    return wizard;
  };

  try {
    // 1. Harness.
    const wizard = await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const fit = await wizard.evaluate((el) => {
      const marker = el.querySelector(".r-steps-marker");
      const cs = getComputedStyle(marker);
      const probe = document.createElement("div");
      marker.parentElement.append(probe);
      probe.style.inlineSize = "calc(var(--ICON) + 2 * var(--R-SIZE-5))";
      const expected = probe.getBoundingClientRect().width;
      probe.remove();
      const next = [...el.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next");
      return {
        marker: marker.getBoundingClientRect().width,
        expected,
        ring: cs.borderTopWidth,
        next: next.getBoundingClientRect().height,
        control: Number.parseFloat(getComputedStyle(next).getPropertyValue("--CONTROL-H")),
      };
    });
    if (!(fit.expected > 0) || Math.abs(fit.marker - fit.expected) > 0.5)
      fail.push(`harness: marker ${fit.marker}px, expected --ICON + 2×--R-SIZE-5 = ${fit.expected}px`);
    if (!(fit.control > 0) || Math.abs(fit.next - fit.control) > 0.5) fail.push(`harness: Next is ${fit.next}px, --CONTROL-H ${fit.control}px`);

    // 2. The narrow container collapses; the wide one does not.
    const collapse = await page.evaluate(() => {
      const read = (sc) => {
        const root = document.querySelector(`[data-sc="${sc}"] .r-steps-stepper`);
        const list = root.querySelector(".r-steps-list");
        const compact = root.querySelector("[data-compact]");
        return {
          width: root.getBoundingClientRect().width,
          list: getComputedStyle(list).display,
          compact: getComputedStyle(compact).display,
          text: compact.querySelector("p").textContent.replace(/\s+/g, " ").trim(),
        };
      };
      return { wide: read("wizard-invite"), narrow: read("wizard-narrow") };
    });
    if (collapse.wide.list === "none" || collapse.wide.compact !== "none") fail.push(`collapse: the wide Stepper ${JSON.stringify(collapse.wide)}`);
    if (collapse.narrow.list !== "none" || collapse.narrow.compact === "none" || !collapse.narrow.text.startsWith("Step 1 of 4 · : Team"))
      fail.push(`collapse: the narrow Stepper ${JSON.stringify(collapse.narrow)}`);

    // 3. Compact + coarse: the markers at 1280, then the collapse at 375.
    const otherTheme = (await showcaseThemes(page)).find((t) => t.name !== "default").name;
    await open({ theme: otherTheme, density: "compact", input: "coarse" }, 1280);
    const coarse = await page.evaluate(() => {
      const marker = (sc) => document.querySelector(`[data-sc="${sc}"] .r-steps-marker`).getBoundingClientRect().width;
      return {
        compact: marker("stepper-compact"),
      };
    });
    // The whole page is compact here: compare with the marker formula read in a comfortable subtree.
    const formula = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.setAttribute("data-density", "comfortable");
      const inner = document.createElement("div");
      inner.style.inlineSize = "calc(var(--ICON) + 2 * var(--R-SIZE-5))";
      probe.append(inner);
      document.body.append(probe);
      const width = inner.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
    if (!(coarse.compact < formula)) fail.push(`compact: a compact marker (${coarse.compact}px) is not smaller than a comfortable one (${formula}px)`);
    await setView(page, { width: 375 });
    await page.locator('[data-sc="wizard-compact"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const phone = await page.evaluate(() => {
      const compact = document.querySelector('[data-sc="wizard-compact"] [data-compact]');
      return { collapsed: getComputedStyle(compact).display !== "none" };
    });
    if (!phone.collapsed) fail.push("375: the compact Wizard's Stepper did not collapse");

    // 4. Forced colours: every marker state stays distinguishable.
    await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(100);
    const forced = await page.locator('[data-sc="stepper-states"]').evaluate((root) => {
      const canvas = (() => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "Canvas";
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      })();
      return [...root.querySelectorAll(".r-steps-list > li")].map((li) => {
        const marker = li.querySelector(".r-steps-marker");
        const cs = getComputedStyle(marker);
        const bg = cs.backgroundColor === canvas || cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : cs.backgroundColor;
        const glyph = marker.querySelector("svg")?.getAttribute("class")?.match(/lucide-([a-z-]+)/)?.[1] ?? `n${marker.textContent.trim() ? "" : "-"}`;
        return {
          state: li.dataset.status ?? li.dataset.position,
          current: li.getAttribute("aria-current"),
          look: `${cs.borderTopStyle} ${cs.borderTopWidth} ${cs.borderTopColor} ${bg} ${glyph}`,
          edge: `${cs.borderTopStyle} ${cs.borderTopWidth} ${cs.borderTopColor} ${bg}`,
        };
      });
    });
    const states = forced.map((f) => f.state).join(",");
    if (states !== "complete,skipped,current,error,upcoming") fail.push(`forced: harness: states ${states}`);
    const looks = new Set(forced.map((f) => f.look));
    if (looks.size !== forced.length) fail.push(`forced: marker states look alike ${JSON.stringify(forced)}`);
    // The current step must not rely on its glyph (a number, like upcoming): its edge differs.
    const edge = (s) => forced.find((f) => f.state === s)?.edge;
    if (edge("current") === edge("upcoming")) fail.push(`forced: current and upcoming have the same edge "${edge("current")}"`);
    if (edge("error") === edge("upcoming")) fail.push(`forced: error and upcoming have the same edge "${edge("error")}"`);
    if (forced.find((f) => f.state === "current")?.current !== "step") fail.push("forced: the current step lost aria-current");
    await page.emulateMedia({ forcedColors: "none" });

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (fail.length) throw new Error(`steps-wizard:\n  ${fail.join("\n  ")}`);
  return "marker = --ICON + 2 × --R-SIZE-5, Next = --CONTROL-H, narrow collapses, compact markers, compact Wizard collapses at 375, forced-colour states distinct";
}
