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
//   5. horizontal geometry, comfortable at 1280, on every state, compact density,
//      long labels and RTL: steps share the row equally; each label sits under its
//      marker (centres within 1px, label top below the marker); each line is level
//      with the markers' centres and runs from --r-steps-pad past one marker to
//      --r-steps-pad before the next (within 1px; mirrored in RTL); the ends are
//      inset (the first marker centred in its step); no step's text spills out of
//      its step (the unbroken word breaks);
//   7. a marker's number is trimmed to its cap height (its box shorter than its line
//      height) and centred in the circle (±0.5px), so the digit, not a line box with
//      room for descenders, is what sits in the middle;
//   6. focus on arrival draws no ring: Next pressed with the mouse (after typing in
//      the step's fields) and then with Enter both move focus to the new step's
//      heading ("Step 2 of 4: People"), whose outline style is none;
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

    // 5. Horizontal geometry: labels under markers, lines marker to marker.
    await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const rows = await page.evaluate(() =>
      ["stepper-states", "stepper-compact", "stepper-long", "stepper-rtl"].map((sc) => {
        const host = document.querySelector(`[data-sc="${sc}"]`);
        const root = host.matches(".r-steps-stepper") ? host : host.querySelector(".r-steps-stepper");
        const list = root.querySelector(".r-steps-list");
        const probe = document.createElement("div");
        probe.style.inlineSize = "var(--r-steps-pad)";
        list.append(probe);
        const pad = probe.getBoundingClientRect().width;
        probe.remove();
        const steps = [...list.children].map((li) => {
          const box = li.getBoundingClientRect();
          const m = li.querySelector(".r-steps-marker").getBoundingClientRect();
          const text = li.querySelector(".r-steps-text");
          const t = text.getBoundingClientRect();
          const label = text.firstElementChild.getBoundingClientRect();
          const c = li.querySelector(".r-steps-connector")?.getBoundingClientRect();
          return {
            box: { left: box.left, right: box.right, width: box.width },
            marker: { left: m.left, right: m.right, x: (m.left + m.right) / 2, y: (m.top + m.bottom) / 2, bottom: m.bottom },
            text: { left: t.left, right: t.right, scroll: text.scrollWidth - text.clientWidth },
            label: { x: (label.left + label.right) / 2, top: label.top },
            line: c && { left: c.left, right: c.right, y: (c.top + c.bottom) / 2 },
          };
        });
        return { sc, rtl: getComputedStyle(list).direction === "rtl", pad, steps };
      }),
    );
    for (const { sc, rtl, pad, steps } of rows) {
      if (steps.length < 3) fail.push(`horizontal ${sc}: harness: ${steps.length} steps`);
      if (!(pad > 0)) fail.push(`horizontal ${sc}: harness: --r-steps-pad reads ${pad}px`);
      const widths = steps.map((s) => s.box.width);
      if (Math.max(...widths) - Math.min(...widths) > 1) fail.push(`horizontal ${sc}: steps are not equal widths ${JSON.stringify(widths)}`);
      const first = steps[0];
      if (Math.abs(first.marker.x - (first.box.left + first.box.right) / 2) > 1) fail.push(`horizontal ${sc}: the first marker is not centred in its step (ends inset)`);
      steps.forEach((s, i) => {
        const at = `horizontal ${sc} step ${i + 1}`;
        if (Math.abs(s.label.x - s.marker.x) > 1) fail.push(`${at}: label centre ${s.label.x.toFixed(1)} is not under the marker's ${s.marker.x.toFixed(1)}`);
        if (s.label.top < s.marker.bottom) fail.push(`${at}: the label (top ${s.label.top}) is not below the marker (bottom ${s.marker.bottom})`);
        if (s.text.left < s.box.left - 1 || s.text.right > s.box.right + 1 || s.text.scroll > 0) fail.push(`${at}: its text spills out of its step ${JSON.stringify({ text: s.text, box: s.box })}`);
        const next = steps[i + 1];
        if (!next) {
          if (s.line) fail.push(`${at}: the last step draws a line`);
          return;
        }
        if (!s.line) return fail.push(`${at}: no line to the next step`);
        if (Math.abs(s.line.y - s.marker.y) > 1) fail.push(`${at}: the line (y ${s.line.y.toFixed(1)}) is not level with the marker (y ${s.marker.y.toFixed(1)})`);
        const [from, to] = rtl ? [s.marker.left - s.line.right, s.line.left - next.marker.right] : [s.line.left - s.marker.right, next.marker.left - s.line.right];
        if (Math.abs(from - pad) > 1 || Math.abs(to - pad) > 1)
          fail.push(`${at}: the line stops ${from.toFixed(1)}px from its marker and ${to.toFixed(1)}px from the next, expected ${pad}px both`);
      });
    }

    // 7. Marker numbers: trimmed to the cap height, centred.
    await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const numbers = await page.evaluate(() =>
      [...document.querySelectorAll('[data-sc="stepper-vertical"] .r-steps-marker-number')].map((n) => {
        const m = n.parentElement.getBoundingClientRect();
        const r = n.getBoundingClientRect();
        return {
          text: n.textContent,
          height: r.height,
          lineHeight: Number.parseFloat(getComputedStyle(n).lineHeight),
          dy: (r.top + r.bottom) / 2 - (m.top + m.bottom) / 2,
          dx: (r.left + r.right) / 2 - (m.left + m.right) / 2,
        };
      }),
    );
    if (numbers.length < 2) fail.push(`numbers: harness: ${numbers.length} numbered markers`);
    for (const n of numbers) {
      if (!(n.height < n.lineHeight * 0.85)) fail.push(`numbers: "${n.text}" is a ${n.height}px box in a ${n.lineHeight}px line, not trimmed to its cap height`);
      if (Math.abs(n.dy) > 0.5 || Math.abs(n.dx) > 0.5) fail.push(`numbers: "${n.text}" is ${n.dx.toFixed(2)} / ${n.dy.toFixed(2)}px off its circle's centre`);
    }

    // 6. Focus on arrival: the heading takes focus with no ring, by mouse and by key.
    {
      const invite = await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
      const arrived = () =>
        page.evaluate(() => {
          const a = document.activeElement;
          return { tag: a.tagName, text: a.textContent.replace(/\s+/g, " ").trim(), outline: getComputedStyle(a).outlineStyle };
        });
      await invite.getByLabel("Team name").click();
      await page.keyboard.type("Acme");
      await invite.getByLabel("Workspace URL").click();
      await page.keyboard.type("acme");
      await invite.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(150);
      const byMouse = await arrived();
      await invite.getByRole("button", { name: "Back" }).click();
      await page.waitForTimeout(150);
      await invite.getByRole("button", { name: "Next" }).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      const byKey = await arrived();
      for (const [how, at] of [["mouse", byMouse], ["Enter", byKey]]) {
        if (!/^H[1-6]$/.test(at.tag) || at.text !== "Step 2 of 4: People") fail.push(`arrival (${how}): focus is on ${at.tag} "${at.text}", expected the "Step 2 of 4: People" heading`);
        if (at.outline !== "none") fail.push(`arrival (${how}): the focused heading draws a ring (outline-style ${at.outline})`);
      }
    }

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
  return "marker = --ICON + 2 × --R-SIZE-5, Next = --CONTROL-H, horizontal labels under markers and lines marker to marker (states, compact, long, RTL), narrow collapses, the arrival heading takes focus with no ring, marker numbers trimmed and centred, compact markers, compact Wizard collapses at 375, forced-colour states distinct";
}
