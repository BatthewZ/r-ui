// Browser check: Stepper and Wizard in a real browser, on the "Invite your team"
// demo (showcase/sections/steps/Wizard.tsx) and the Stepper demos beside it.
//
// jsdom has no layout and no CSS: whether the narrow Stepper really collapses
// (a container query), where focus lands as steps change, the hit floor at
// coarse input and what survives forced colours are only measurable here.
//
// Asserts:
//   1. harness: a Stepper marker is exactly `--ICON + 2 × --R-SIZE-5` (the
//      formula in the steps stylesheet), and the Wizard's Next is `--CONTROL-H`;
//   2. Next on an empty step 1 stays there and focuses its first invalid field
//      (aria-invalid, described by its message);
//   3. a valid step advances and focus moves to the new step's heading, which
//      reads "Step 2 of 4: People"; step 2 with an invalid email is blocked the
//      same way, and its server check ("already in this workspace") is busy,
//      then blocks and focuses the field;
//   4. Back keeps values on both sides (step 1's text, then step 2's email);
//   5. in the Stepper's nav only completed steps are buttons (upcoming ones are
//      not), and pressing one goes back to it with focus on its heading;
//   6. a narrow container collapses the Stepper (list gone, "Step 1 of 4 · Team"
//      shown) while the wide one shows the list and hides the compact form;
//   7. compact density and coarse input: markers re-derive smaller than the
//      comfortable formula, selectable steps (1280, rows) and Next (375) meet
//      the 44px floor, the compact Wizard collapses and nothing scrolls sideways;
//   8. forced colours: the five marker states (complete, skipped, current,
//      error, upcoming) differ pairwise in what survives forcing (border
//      style, width and colour, kept fill, glyph), and the current step is
//      still `aria-current`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (view, width, anchor = "steps-wizard") => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), view);
    await page.reload();
    await waitForShowcase(page);
    const wizard = page.locator('[data-sc="wizard-invite"]');
    await wizard.waitFor();
    await wizard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    return wizard;
  };

  const until = async (locator, check, ms = 2500) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await locator.evaluate(check).catch(() => false)) return true;
      if (Date.now() > end) return false;
      await page.waitForTimeout(25);
    }
  };
  const isFocused = (el) => el === document.activeElement;
  const description = (locator) =>
    locator.evaluate((el) =>
      (el.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" | "),
    );
  const focusedText = () => page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent?.trim()}`);

  try {
    // 1. Harness.
    let wizard = await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
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

    const heading = wizard.locator("h4");
    const next = wizard.getByRole("button", { name: "Next" });
    const nav = wizard.getByRole("navigation", { name: "Invite progress" });

    // 2. An invalid step blocks Next and focuses its first invalid field.
    await next.click();
    const team = wizard.getByRole("textbox", { name: "Team name" });
    if (!(await until(team, isFocused))) fail.push(`block: Next on an empty step did not focus Team name (focus: ${await focusedText()})`);
    if ((await team.getAttribute("aria-invalid")) !== "true") fail.push("block: Team name is not aria-invalid");
    if (!(await description(team)).includes("Name the team")) fail.push(`block: Team name is described by "${await description(team)}"`);
    if (!(await heading.textContent()).includes("Team")) fail.push("block: the step changed although it was invalid");

    // 3. A valid step advances, focus on the heading; step 2 blocks, then its server check.
    await team.fill("Platform");
    await wizard.getByRole("textbox", { name: "Workspace URL" }).fill("platform");
    await next.click();
    if (!(await until(heading, (el) => el === document.activeElement && el.textContent.includes("Step 2 of 4: People"))))
      fail.push(`advance: focus is not on the "Step 2 of 4: People" heading (focus: ${await focusedText()})`);
    const email = wizard.getByRole("textbox", { name: "Email (person 1)" });
    await email.fill("not-an-email");
    await next.click();
    // A real click after typing: the press keeps focus in the field, so its
    // blur-time error cannot shift the row and swallow the click.
    if (!(await until(email, isFocused))) fail.push(`block 2: an invalid email did not keep focus on it (focus: ${await focusedText()})`);
    if (!(await description(email)).includes("like name@example.com")) fail.push(`block 2: email described by "${await description(email)}"`);
    if (!(await heading.textContent()).includes("People")) fail.push("block 2: the step changed with an invalid email");
    await email.fill("ada@example.com");
    await next.click();
    if (!(await until(next, (el) => el.getAttribute("aria-busy") === "true", 1000))) fail.push("server: Next is not busy while step 2 is checked");
    if (!(await until(email, (el) => el === document.activeElement && el.getAttribute("aria-invalid") === "true", 4000)))
      fail.push(`server: the member check did not focus the email (focus: ${await focusedText()})`);
    if (!(await description(email)).includes("already in this workspace")) fail.push(`server: email described by "${await description(email)}"`);

    // 4. Back keeps values, both ways.
    await email.fill("lin@example.com");
    await wizard.getByRole("button", { name: "Back" }).click();
    if (!(await until(heading, (el) => el === document.activeElement && el.textContent.includes("Team")))) fail.push("back: focus did not move to the Team heading");
    if ((await team.inputValue()) !== "Platform") fail.push(`back: Team name is "${await team.inputValue()}"`);
    await next.click();
    await until(heading, (el) => el.textContent.includes("People"));
    if ((await email.inputValue()) !== "lin@example.com") fail.push(`back: step 2's email is "${await email.inputValue()}" after Back and Next`);

    // 5. Only completed steps are buttons; one goes back to its step.
    const steps = await nav.evaluate((el) =>
      [...el.querySelectorAll("li")].map((li) => ({ position: li.dataset.position, button: !!li.querySelector("button, a") })),
    );
    const expected = [
      { position: "complete", button: true },
      { position: "current", button: false },
      { position: "upcoming", button: false },
      { position: "upcoming", button: false },
    ];
    if (JSON.stringify(steps) !== JSON.stringify(expected)) fail.push(`select: steps ${JSON.stringify(steps)}`);
    await nav.getByRole("button", { name: /^Team/ }).click();
    if (!(await until(heading, (el) => el === document.activeElement && el.textContent.includes("Step 1 of 4: Team"))))
      fail.push(`select: the completed Team step did not go back there with focus on its heading (focus: ${await focusedText()})`);

    // 6. The narrow container collapses; the wide one does not.
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

    // 7. Compact + coarse: at 1280 (where the Steppers are rows) the targets, then at 375.
    const otherTheme = (await showcaseThemes(page)).find((t) => t.name !== "default").name;
    await open({ theme: otherTheme, density: "compact", input: "coarse" }, 1280, "steps-stepper");
    const coarse = await page.evaluate(() => {
      const marker = (sc) => document.querySelector(`[data-sc="${sc}"] .r-steps-marker`).getBoundingClientRect().width;
      const targets = [...document.querySelectorAll('[data-sc="stepper-selectable"] li button, [data-sc="stepper-rtl"] li button')];
      return {
        compact: marker("stepper-compact"),
        targets: targets.map((t) => t.getBoundingClientRect().height),
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
    if (coarse.targets.length < 3) fail.push(`coarse: harness: found ${coarse.targets.length} selectable steps`);
    if (coarse.targets.some((h) => !(h >= 44))) fail.push(`coarse: selectable steps are ${JSON.stringify(coarse.targets)}px tall (floor 44)`);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${base}#/overview/steps-wizard`);
    await waitForShowcase(page);
    await page.locator('[data-sc="wizard-compact"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const phone = await page.evaluate(() => {
      const next = [...document.querySelectorAll('[data-sc="wizard-compact"] button')].find((b) => b.textContent.trim() === "Next");
      const compact = document.querySelector('[data-sc="wizard-compact"] [data-compact]');
      return {
        next: next.getBoundingClientRect().height,
        collapsed: getComputedStyle(compact).display !== "none",
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (!(phone.next >= 44)) fail.push(`coarse: Next is ${phone.next}px tall (floor 44)`);
    if (!phone.collapsed) fail.push("375: the compact Wizard's Stepper did not collapse");
    if (phone.scroll > 0) fail.push(`375: the page scrolls sideways by ${phone.scroll}px`);

    // 8. Forced colours: every marker state stays distinguishable.
    await open({ theme: "default", density: "comfortable", input: "fine" }, 1280, "steps-stepper");
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
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  }

  if (fail.length) throw new Error(`steps-wizard:\n  ${fail.join("\n  ")}`);
  return "invalid step blocks Next + focuses its field, server check busy then blocks, heading focus on change, Back keeps values, only completed steps selectable, narrow collapses, compact + coarse floors, forced-colour states distinct";
}
