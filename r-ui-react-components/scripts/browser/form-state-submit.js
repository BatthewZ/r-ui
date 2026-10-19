// @covers   form/useForm, form/ErrorSummary, form/FormActions, layout/ScrollPanel
// @sections form-useform form-formactions
// @tier     component
//
// Browser check: useForm's submit path in a real browser, on the "Create alert
// rule" demo (showcase/sections/form/UseForm.tsx).
//
// jsdom has no layout, no scrolling and no sticky positioning, so where focus
// lands on screen, whether the sticky action row covers it, and how the row
// stacks are only measurable here.
//
// Asserts:
//   1. harness: the rule-name control is exactly the `--CONTROL-H` it reads, and
//      no error summary shows before a submit;
//   2. submitting the empty form focuses the FIRST invalid field in DOM order
//      (Rule name), which is `aria-invalid` and described by its message, and
//      an error summary (role alert) lists every error in page order;
//   3. a summary link (real click) focuses its field and leaves it on screen,
//      not under the sticky action row;
//   4. fixing a field clears its error and the summary lists one error fewer;
//   5. the async name check shows its pending state (spinner status + hint),
//      then its answer ("cpu-high" is taken);
//   6. a server rejection by path lands on that field (a condition's threshold)
//      with focus;
//   7. the long form's action row is sticky at the bottom, at the sticky layer;
//      the FormActions demo's bounded box is a ScrollPanel: only its body
//      scrolls, the footer (the actions) sits outside it on the panel's bottom
//      edge at both ends of the scroll, the body ends where the footer begins;
//      a narrow container stacks the actions;
//   8. at 375 wide, compact density and coarse input (a dark theme): nothing
//      scrolls sideways (the controls at their 44px `--CONTROL-H` are
//      sweep-overview's geometry sweep), the actions stack full-width with the primary on top, and the
//      submit / focus / summary path still works;
//   9. forced colors: the summary keeps an edge (a border) and its glyph, so
//      it does not rely on its tinted background.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (view, width) => {
    await openSection(page, "form-useform", { width, view });
    const form = page.locator('[data-sc="form-state-form"]');
    await form.waitFor();
    await form.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    return form;
  };

  // Polls until `check(el)` holds for the locator's element, or times out.
  const until = async (locator, check, ms = 2000) => {
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
  // The field is on screen and the topmost thing at its centre (not under the sticky row).
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return r.top >= 0 && r.bottom <= innerHeight && !!top && (top === el || el.contains(top) || el.closest(".r-form-frame")?.contains(top));
  };

  try {
    // 1. Harness.
    const fineView = { theme: "default", density: "comfortable", input: "fine" };
    let form = await open(fineView, 1280);
    const name = form.getByRole("textbox", { name: "Rule name" });
    const fit = await name.evaluate((el) => {
      const frame = el.closest(".r-form-frame");
      return { h: frame.getBoundingClientRect().height, token: Number.parseFloat(getComputedStyle(frame).getPropertyValue("--CONTROL-H")) };
    });
    if (!(fit.token > 0) || Math.abs(fit.h - fit.token) > 0.5) fail.push(`harness: name control is ${fit.h}px, its --CONTROL-H is ${fit.token}px`);
    if ((await form.getByRole("alert").count()) !== 0) fail.push("harness: an error summary shows before any submit");

    // 2. Empty submit.
    await form.getByRole("button", { name: "Create rule" }).click();
    if (!(await until(name, isFocused))) fail.push("submit: focus did not land on Rule name, the first invalid field");
    if ((await name.getAttribute("aria-invalid")) !== "true") fail.push("submit: Rule name is not aria-invalid");
    const described = await description(name);
    if (!described.includes("Enter a rule name")) fail.push(`submit: Rule name is described by "${described}"`);
    const summary = form.getByRole("alert");
    const links = summary.getByRole("link");
    const texts = await links.allTextContents();
    const expected = [
      "Rule name: Enter a rule name",
      "Service: Choose the service this rule watches",
      "Runbook note: Paging rules need a runbook note",
    ];
    if (JSON.stringify(texts) !== JSON.stringify(expected)) fail.push(`summary: links ${JSON.stringify(texts)}`);

    // 3. A summary link focuses its field, on screen and clear of the sticky row.
    await page.evaluate(() => window.scrollTo(0, 0));
    await links.nth(2).click();
    const runbook = form.getByRole("textbox", { name: "Runbook note" });
    if (!(await until(runbook, isFocused))) fail.push("summary: the Runbook link did not focus the field");
    else if (!(await until(runbook, onScreen, 1000))) fail.push("summary: the focused Runbook field is off screen or under the sticky row");

    // 4. Fixing a field clears its error and its summary entry.
    const service = form.getByRole("combobox", { name: "Service" });
    await service.selectOption("payments-worker");
    if ((await service.getAttribute("aria-invalid")) !== null) fail.push("fix: Service still aria-invalid after choosing one");
    if ((await links.count()) !== 2) fail.push(`fix: the summary has ${await links.count()} links, expected 2`);

    // 5. The async name check: pending, then the answer.
    await name.click();
    await page.keyboard.type("cpu-high");
    const field = name.locator("xpath=ancestor::*[contains(@class,'@container')][1]");
    const pending = await until(field, (el) => el.hasAttribute("data-validating") && el.textContent.includes("Checking availability"), 500);
    if (!pending) fail.push("async: no pending state while the name check runs");
    if ((await form.getByRole("status").filter({ hasText: "Checking whether the name is free" }).count()) !== 1)
      fail.push("async: the pending spinner is not a named status");
    const answered = await until(name, (el) =>
      (el.getAttribute("aria-describedby") ?? "").split(" ").some((id) => document.getElementById(id)?.textContent?.includes("already used")),
    );
    if (!answered) fail.push("async: the taken name never got its error");
    if (await field.evaluate((el) => el.hasAttribute("data-validating"))) fail.push("async: still pending after the answer");

    // 6. A server rejection by path.
    await name.fill("disk-pressure-eu");
    await runbook.fill("Drain the node, then page storage.");
    await page.locator('[data-sc="form-state-server"]').getByText("Rejects a threshold").click();
    await form.getByRole("button", { name: "Create rule" }).click();
    const threshold = form.getByRole("spinbutton", { name: "Threshold (condition 1)" });
    if (!(await until(threshold, isFocused, 4000))) fail.push("server: focus did not move to the rejected threshold");
    const thresholdText = await description(threshold);
    if (!thresholdText.includes("ceiling")) fail.push(`server: the threshold is described by "${thresholdText}"`);

    // 7. A sticky row (the long form's own) is sticky at the sticky layer; in a
    //    bounded box the actions sit in a ScrollPanel's footer instead: only the
    //    body scrolls, and its bottom edge (with its scrollbar) is the footer's top.
    const stickyRow = await form.locator("[data-sticky]").evaluate((row) => {
      const cs = getComputedStyle(row);
      return {
        position: cs.position,
        bottom: cs.bottom,
        z: cs.zIndex,
        layer: getComputedStyle(document.documentElement).getPropertyValue("--LAYER-STICKY").trim(),
      };
    });
    if (stickyRow.position !== "sticky" || stickyRow.bottom !== "0px" || stickyRow.z !== stickyRow.layer)
      fail.push(`sticky: the long form's row is not sticky at the bottom, at the sticky layer ${JSON.stringify(stickyRow)}`);
    await openSection(page, "form-formactions", { view: fineView });
    const panelBox = page.locator('[data-sc="form-actions-panel"]');
    await panelBox.waitFor();
    await panelBox.scrollIntoViewIfNeeded();
    const panel = await panelBox.evaluate((el) => {
      const [body, footer] = el.children;
      const at = () => {
        const inner = el.getBoundingClientRect().top + el.clientTop + el.clientHeight;
        const b = body.getBoundingClientRect();
        const f = footer.getBoundingClientRect();
        return { footerToPanel: inner - f.bottom, bodyToFooter: f.top - b.bottom };
      };
      body.scrollTop = 0;
      const top = at();
      body.scrollTop = body.scrollHeight;
      const end = at();
      return {
        parts: el.children.length,
        scrolls: body.scrollHeight > body.clientHeight && getComputedStyle(body).overflowY === "auto",
        panelScrolls: el.scrollHeight > el.clientHeight,
        footerInside: body.contains(footer),
        footerPosition: getComputedStyle(footer).position,
        hasActions: footer.querySelectorAll("button").length,
        top,
        end,
      };
    });
    if (panel.parts !== 2 || panel.hasActions !== 2) fail.push(`panel: harness: expected body + footer with two actions ${JSON.stringify(panel)}`);
    if (!panel.scrolls) fail.push("panel: harness: the demo body does not scroll");
    if (panel.panelScrolls || panel.footerInside || panel.footerPosition !== "static")
      fail.push(`panel: the footer is inside the scroll, or the panel itself scrolls ${JSON.stringify(panel)}`);
    for (const [when, gaps] of [["top", panel.top], ["end", panel.end]])
      if (Math.abs(gaps.footerToPanel) > 1 || Math.abs(gaps.bodyToFooter) > 1)
        fail.push(`panel: at the ${when} of the scroll the footer is not on the panel's bottom edge or the body does not end at it ${JSON.stringify(gaps)}`);
    const narrow = await page.locator('[data-sc="form-actions-narrow"]').evaluate((el) => {
      const [cancel, save] = [...el.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
      return { stacked: save.bottom <= cancel.top + 0.5, full: Math.abs(save.width - cancel.width) < 1 };
    });
    if (!narrow.stacked || !narrow.full) fail.push(`stack: a narrow container's actions ${JSON.stringify(narrow)}`);

    // 8. 375 · compact · coarse · dark.
    form = await open({ theme: await darkTheme(page), density: "compact", input: "coarse" }, 375);
    const phone = await form.evaluate((el) => {
      const row = el.querySelector("[data-sticky] > div");
      const [reset, submit] = [...row.children].map((b) => b.getBoundingClientRect());
      return {
        pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cardScroll: el.scrollWidth - el.clientWidth,
        rowWidth: row.getBoundingClientRect().width,
        reset: { top: reset.top, width: reset.width },
        submit: { top: submit.top, width: submit.width },
      };
    });
    if (phone.pageScroll > 0 || phone.cardScroll > 0) fail.push(`375: sideways scroll (page ${phone.pageScroll}px, card ${phone.cardScroll}px)`);
    if (!(phone.submit.top < phone.reset.top)) fail.push("375: the stacked primary is not on top");
    if (Math.abs(phone.submit.width - phone.rowWidth) > 1 || Math.abs(phone.reset.width - phone.rowWidth) > 1)
      fail.push(`375: stacked actions are not full width ${JSON.stringify(phone)}`);
    await form.getByRole("button", { name: "Create rule" }).click();
    const phoneName = form.getByRole("textbox", { name: "Rule name" });
    if (!(await until(phoneName, isFocused))) fail.push("375: submit did not focus Rule name");
    await form.getByRole("alert").getByRole("link", { name: /^Service:/ }).click();
    if (!(await until(form.getByRole("combobox", { name: "Service" }), isFocused))) fail.push("375: the Service summary link did not focus the select");

    // 9. Forced colors: the summary keeps a border and its glyph.
    await setView(page, { forced: true });
    await page.waitForTimeout(100);
    const forced = await form.getByRole("alert").evaluate((el) => {
      const cs = getComputedStyle(el);
      const glyph = el.querySelector("svg")?.getBoundingClientRect();
      return { style: cs.borderTopStyle, width: Number.parseFloat(cs.borderTopWidth), color: cs.borderTopColor, glyph: glyph ? glyph.width * glyph.height : 0 };
    });
    if (forced.style === "none" || !(forced.width > 0) || forced.color === "rgba(0, 0, 0, 0)" || !(forced.glyph > 0))
      fail.push(`forced colors: the summary lost its edge or glyph ${JSON.stringify(forced)}`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`form-state-submit:\n  ${fail.join("\n  ")}`);
  return "first invalid focused + described, summary links focus on screen, fix clears, async pending then taken, server error by path, sticky row at the layer, panel footer outside the scroller, 375 compact coarse stacked, forced-colors edge";
}
