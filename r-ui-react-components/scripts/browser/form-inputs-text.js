// Browser check: PasswordInput, MaskedInput and CurrencyInput with real keys, real focus and real layout.
//
// jsdom keeps a selection across an input's `type` swap and has no layout, so the caret,
// the hit areas and the sizes are settled here. On the Overview's three sections it asserts:
//   1. harness: the page resolves --CONTROL-H 36px at comfortable/fine (the source's 2.25rem),
//      the sign-in password is a password field holding "correct horse" (its source value),
//      and the phone field's placeholder is "(___) ___-____";
//   2. password show/hide: with "rr" selected (3..5) a mouse press on "Show password" makes
//      the field text, pressed, still focused, the value and the selection unchanged; a second
//      press hides it with the same selection; from the keyboard, Tab reaches the toggle and
//      Space swaps it back while the value stays;
//   3. strength: typing in the sign-up password shows a meter named "Password strength" whose
//      value text and filled segments follow the score ("abc" → Very weak, 1 of 5 filled;
//      "correct horse battery staple" → Very strong, 5 of 5); filled and empty segments differ
//      in fill, and both are drawn at a height > 0;
//   4. mask caret: typing "5551234567" into the checkout phone shows "(555) 123-4567"; with
//      the caret at 2 a typed "9" gives "(59|5) 512-3456" (refitted, overflow dropped); with the
//      caret after ") " Backspace deletes the digit before the literal ("(59|5) 123-456");
//      Delete at 1 deletes forward ("(|951) 234-56"); inserted text over a selection 1..9
//      ("212-867", as a paste or an IME commit delivers it) gives "(212) 867-|56"; a refused
//      letter leaves value and caret; the plate upper-cases ("abc1234" → "ABC-1234", raw ABC1234);
//      the RTL phone is laid out left to right;
//   5. currency: in the de-DE plan, typing "1.234,5" into the budget leaves it as typed until
//      Tab, which shows "1.234,50"; Save posts budget 1234.5; the euro sign sits after the
//      amount, the dollar sign before it in the en-US plan; JPY shows no fraction digits;
//   6. coarse + 375: every frame in the three sections (outside the compact demos) is exactly the
//      coarse --CONTROL-H (44px),
//      the show-password toggle answers a press 2px outside its visible box on both axes (its
//      hit area is at least 44 × 44), and no section (nor the page) scrolls sideways;
//   7. forced colours: the strength meter's filled segments keep a fill that differs from the
//      empty ones, and every segment has a visible edge.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (anchor, { input = "fine", width = 1280 } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate(
      ({ key, view }) => localStorage.setItem(key, JSON.stringify(view)),
      { key: SHOWCASE_VIEW_KEY, view: { theme: "default", density: "comfortable", input } },
    );
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${anchor}"]`).scrollIntoViewIfNeeded();
  };
  /** The field's text with `|` at the caret (or `[ ]` round a selection). */
  const caretText = (locator) =>
    locator.evaluate((el) => {
      const { value, selectionStart: s, selectionEnd: e } = el;
      return s === e ? `${value.slice(0, s)}|${value.slice(s)}` : `${value.slice(0, s)}[${value.slice(s, e)}]${value.slice(e)}`;
    });
  const select = (locator, start, end = start) => locator.evaluate((el, [s, e]) => el.setSelectionRange(s, e), [start, end]);
  const focused = (locator) => locator.evaluate((el) => el === document.activeElement);
  const noSpill = async (anchor) => {
    const spill = await page.evaluate((id) => {
      const section = document.getElementById(id);
      const scroller = document.scrollingElement;
      return { page: scroller.scrollWidth - scroller.clientWidth, section: section.scrollWidth - section.clientWidth };
    }, anchor);
    if (spill.page > 0 || spill.section > 0) fail.push(`375 ${anchor}: sideways scroll ${JSON.stringify(spill)}`);
  };

  try {
    // ── 1: harness ──────────────────────────────────────────────────────────
    await open("form-passwordinput");
    const controlH = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--CONTROL-H"));
    if (Math.round(Number.parseFloat(controlH)) !== 36) fail.push(`harness: page --CONTROL-H is ${controlH}, source predicts 36px`);
    const signin = page.locator('[data-sc="password-signin"]').locator("input");
    const toggle = page.locator('[data-sc="password-signin"]').getByRole("button", { name: "Show password", exact: true });
    if ((await signin.count()) !== 1 || (await toggle.count()) !== 1) fail.push(`harness: ${await signin.count()} sign-in inputs, ${await toggle.count()} toggles`);
    if ((await signin.getAttribute("type")) !== "password" || (await signin.inputValue()) !== "correct horse") {
      fail.push(`harness: sign-in field is ${await signin.getAttribute("type")} "${await signin.inputValue()}", source says password "correct horse"`);
    }

    // ── 2: show / hide keeps value, focus and caret ─────────────────────────
    await signin.click();
    await select(signin, 3, 5);
    await toggle.click();
    const shown = {
      type: await signin.getAttribute("type"),
      pressed: await toggle.getAttribute("aria-pressed"),
      focus: await focused(signin),
      text: await caretText(signin),
    };
    if (shown.type !== "text" || shown.pressed !== "true" || !shown.focus || shown.text !== "cor[re]ct horse") fail.push(`show: ${JSON.stringify(shown)}`);
    await toggle.click();
    const hidden = { type: await signin.getAttribute("type"), focus: await focused(signin), text: await caretText(signin) };
    if (hidden.type !== "password" || !hidden.focus || hidden.text !== "cor[re]ct horse") fail.push(`hide: ${JSON.stringify(hidden)}`);
    await page.keyboard.press("Tab");
    const toggleFocused = await focused(toggle);
    await page.keyboard.press("Space");
    if (!toggleFocused || (await signin.getAttribute("type")) !== "text" || (await signin.inputValue()) !== "correct horse") {
      fail.push(`toggle keys: focused ${toggleFocused}, then ${await signin.getAttribute("type")} "${await signin.inputValue()}"`);
    }

    // ── 3: strength meter ───────────────────────────────────────────────────
    const signup = page.locator('[data-sc="password-signup"]');
    const newPassword = signup.getByLabel(/^Password\*?$/);
    const meterState = () =>
      signup.getByRole("meter", { name: "Password strength" }).evaluate((meter) => {
        const segments = [...meter.children].map((s) => ({ filled: s.hasAttribute("data-filled"), bg: getComputedStyle(s).backgroundColor, h: s.getBoundingClientRect().height }));
        return { text: meter.getAttribute("aria-valuetext"), filled: segments.filter((s) => s.filled).length, count: segments.length, segments };
      });
    await newPassword.fill("");
    await newPassword.pressSequentially("abc");
    const weak = await meterState();
    if (weak.text !== "Very weak" || weak.filled !== 1 || weak.count !== 5) fail.push(`strength abc: ${JSON.stringify({ text: weak.text, filled: weak.filled, count: weak.count })}`);
    const fillOf = (state, filled) => state.segments.find((s) => s.filled === filled)?.bg;
    if (fillOf(weak, true) === fillOf(weak, false) || weak.segments.some((s) => !(s.h > 0))) fail.push(`strength: segments ${JSON.stringify(weak.segments)}`);
    await newPassword.fill("");
    await newPassword.pressSequentially("correct horse battery staple");
    const strong = await meterState();
    if (strong.text !== "Very strong" || strong.filled !== 5) fail.push(`strength phrase: ${JSON.stringify({ text: strong.text, filled: strong.filled })}`);

    // ── 4: mask caret ───────────────────────────────────────────────────────
    await open("form-maskedinput");
    const phone = page.locator('[data-sc="masked-checkout"]').getByRole("textbox", { name: "Phone", exact: true });
    if ((await phone.getAttribute("placeholder")) !== "(___) ___-____") fail.push(`mask harness: placeholder "${await phone.getAttribute("placeholder")}"`);
    await phone.click();
    await page.keyboard.type("5551234567");
    if ((await phone.inputValue()) !== "(555) 123-4567") fail.push(`mask type: "${await phone.inputValue()}"`);
    const steps = [
      ["insert 9 at 2", 2, 2, () => page.keyboard.type("9"), "(59|5) 512-3456"],
      ["Backspace after a literal", 6, 6, () => page.keyboard.press("Backspace"), "(59|5) 123-456"],
      ["Delete at 1", 1, 1, () => page.keyboard.press("Delete"), "(|951) 234-56"],
      ["text over a selection", 1, 9, () => page.keyboard.insertText("212-867"), "(212) 867-|56"],
      ["a refused letter", 3, 3, () => page.keyboard.type("x"), "(21|2) 867-56"],
    ];
    for (const [what, start, end, act, expected] of steps) {
      await select(phone, start, end);
      await act();
      const got = await caretText(phone);
      if (got !== expected) fail.push(`mask ${what}: "${got}", expected "${expected}"`);
    }
    const plate = page.locator('[data-sc="masked-plate"]');
    await plate.getByRole("textbox", { name: "Licence plate", exact: true }).click();
    await page.keyboard.type("abc1234");
    const plateState = { shown: await plate.getByRole("textbox", { name: "Licence plate", exact: true }).inputValue(), raw: await plate.locator('[data-sc="masked-raw"]').innerText() };
    if (plateState.shown !== "ABC-1234" || plateState.raw !== "ABC1234") fail.push(`mask plate: ${JSON.stringify(plateState)}`);
    const rtlPhone = page.locator('[id="form-maskedinput"] [dir="rtl"] input[inputmode="numeric"]');
    if ((await rtlPhone.count()) !== 1) fail.push(`mask rtl: ${await rtlPhone.count()} RTL phone inputs`);
    else {
      const direction = await rtlPhone.evaluate((el) => getComputedStyle(el).direction);
      if (direction !== "ltr") fail.push(`mask rtl: the number is laid out ${direction}`);
    }

    // ── 5: currency ─────────────────────────────────────────────────────────
    await open("form-currencyinput");
    const de = page.locator('[data-sc="currency-de"]');
    const budget = de.getByRole("textbox", { name: "Annual budget", exact: true });
    await budget.click();
    await budget.press("ControlOrMeta+a");
    await page.keyboard.type("1.234,5");
    const typed = await budget.inputValue();
    await page.keyboard.press("Tab");
    const left = await budget.inputValue();
    if (typed !== "1.234,5" || left !== "1.234,50") fail.push(`currency de: typed "${typed}", after Tab "${left}" (expected "1.234,5" then "1.234,50")`);
    await de.getByRole("button", { name: "Save plan" }).click();
    const saved = await de.locator('[data-sc="currency-saved"]').innerText();
    if (!saved.includes('"budget":1234.5')) fail.push(`currency de: saved ${saved}`);
    const signSide = (scope, label) =>
      scope.getByRole("textbox", { name: label, exact: true }).evaluate((input) => {
        const frame = input.closest(".r-form-frame");
        const at = [...frame.children].findIndex((child) => child.contains(input));
        return { before: frame.children[at - 1]?.textContent ?? null, after: frame.children[at + 1]?.textContent ?? null };
      });
    const euro = await signSide(de, "Annual budget");
    const dollar = await signSide(page.locator('[data-sc="currency-en"]'), "Annual budget");
    if (euro.after !== "€" || euro.before !== null) fail.push(`currency de: sign ${JSON.stringify(euro)}`);
    if (dollar.before !== "$" || dollar.after !== null) fail.push(`currency en: sign ${JSON.stringify(dollar)}`);
    const yen = await page.locator('[id="form-currencyinput"]').getByRole("textbox", { name: "Hotel, per night", exact: true }).inputValue();
    if (yen !== "18,400") fail.push(`currency JPY: "${yen}", expected "18,400"`);

    // ── 6: coarse + 375 ─────────────────────────────────────────────────────
    for (const anchor of ["form-passwordinput", "form-maskedinput", "form-currencyinput"]) {
      await open(anchor, { input: "coarse", width: 375 });
      const frames = await page.evaluate((id) => {
        const section = document.getElementById(id);
        const probe = document.createElement("div");
        probe.style.blockSize = "var(--CONTROL-H)";
        section.append(probe);
        const controlH = probe.getBoundingClientRect().height;
        probe.remove();
        return { controlH, heights: [...section.querySelectorAll(".r-form-text-frame")].filter((f) => !f.closest('[data-density="compact"]')).map((f) => f.getBoundingClientRect().height) };
      }, anchor);
      if (Math.round(frames.controlH) !== 44) fail.push(`coarse ${anchor}: --CONTROL-H resolves to ${frames.controlH}px, expected 44`);
      if (frames.heights.length === 0 || frames.heights.some((h) => Math.abs(h - frames.controlH) > 0.5)) fail.push(`coarse ${anchor}: frames ${JSON.stringify(frames.heights)}`);
      await noSpill(anchor);
    }
    await open("form-passwordinput", { input: "coarse", width: 375 });
    const coarseToggle = page.locator('[data-sc="password-signin"]').getByRole("button", { name: "Show password", exact: true });
    await coarseToggle.scrollIntoViewIfNeeded();
    const hit = await coarseToggle.evaluate((button) => {
      const r = button.getBoundingClientRect();
      const area = getComputedStyle(button, "::before");
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const answers = [
        [r.left - 2, cy],
        [r.right + 2, cy],
        [cx, r.top - 2],
        [cx, r.bottom + 2],
      ].map(([x, y]) => button.contains(document.elementFromPoint(x, y)));
      return { answers, w: Number.parseFloat(area.width), h: Number.parseFloat(area.height), box: [r.width, r.height] };
    });
    if (hit.answers.includes(false) || !(hit.w >= 44 && hit.h >= 44)) fail.push(`coarse toggle: ${JSON.stringify(hit)}`);

    // ── 7: forced colours ───────────────────────────────────────────────────
    await open("form-passwordinput");
    await page.emulateMedia({ forcedColors: "active" });
    const forcedPassword = page.locator('[data-sc="password-signup"]').getByLabel(/^Password\*?$/);
    await forcedPassword.fill("");
    await forcedPassword.pressSequentially("Tr0ub4dor&3");
    const forced = await page.locator('[data-sc="password-signup"]').getByRole("meter").evaluate((meter) =>
      [...meter.children].map((s) => {
        const css = getComputedStyle(s);
        return { filled: s.hasAttribute("data-filled"), bg: css.backgroundColor, edge: css.borderTopStyle !== "none" && Number.parseFloat(css.borderTopWidth) > 0 };
      }),
    );
    const forcedFilled = forced.filter((s) => s.filled);
    const forcedEmpty = forced.filter((s) => !s.filled);
    if (forcedFilled.length === 0 || forcedEmpty.length === 0) fail.push(`forced harness: ${forcedFilled.length} filled / ${forcedEmpty.length} empty segments`);
    else if (forcedFilled.some((f) => forcedEmpty.some((e) => e.bg === f.bg)) || forced.some((s) => !s.edge)) fail.push(`forced: segments ${JSON.stringify(forced)}`);
    await page.emulateMedia({ forcedColors: null });
  } finally {
    stopErrors();
  }
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`form-inputs-text:\n  ${fail.join("\n  ")}`);
  return "form-inputs-text: show/hide keeps caret and focus, strength meter, mask caret on insert/delete/paste/refusal, de-DE currency typing and blur formatting, coarse frames and toggle hit area, no spill at 375, forced-colour segments";
}
