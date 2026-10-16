// Browser check: the Toolbar and ToggleGroup keyboard models with real focus.
//
// jsdom moves focus by script and fakes Tab; here every key is a real press, so
// the one-tab-stop claim, the RTL mirroring (which reads the computed
// direction a `dir` attribute sets) and a text input's own caret are settled.
//
// On the Overview's Toolbar and ToggleGroup sections, at 1280 and fine input:
//   1. harness: the editor toolbar has every unit in the bar (nothing moved into
//      More) and its controls in DOM order are the list the walk must produce;
//   2. one tab stop: exactly one control in the editor has tabindex 0; Tab from
//      the control before the toolbar lands on it, and the next Tab leaves the
//      toolbar;
//   3. ArrowRight walks every control once, in DOM order, and wraps to the first;
//      End / Home land on the last / first; Shift+Tab back in returns to the
//      control that last had focus;
//   4. the alignment radios inside the toolbar: an arrow only moves focus (the
//      checked radio stays), Space checks the focused one;
//   5. in the States toolbar the aria-disabled Redo is a stop and the disabled
//      Undo is passed over (the walk wraps past it to the last control);
//   6. RTL (the Arabic editor): harness, the second control sits to the LEFT of
//      the first; ArrowLeft moves to it and ArrowRight back;
//   7. the Find bar's text input keeps ArrowLeft and Home while its caret can
//      move (focus stays, caret moves), and ArrowLeft at the caret's start / ArrowRight at
//      its end hand focus to the neighbouring buttons;
//   8. ToggleGroup standalone: multiple, Space presses a second toggle and the
//      first stays pressed (two pressed); single, Tab lands on the checked radio,
//      ArrowRight checks the next and exactly one radio is checked; in RTL the
//      single group's ArrowLeft checks the next one.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const load = async (anchor) => {
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme: "default",
      density: "comfortable",
      input: "fine",
    });
    await page.reload();
    await waitForShowcase(page);
    await page.waitForTimeout(200);
  };
  /** The focused element's accessible name as the scripts below write it, and whether it sits inside `sel`. */
  const focused = (sel) =>
    page.evaluate((s) => {
      const el = document.activeElement;
      const name = el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? null;
      return { name, inside: Boolean(s && el && document.querySelector(s)?.contains(el)), tag: el?.tagName ?? null };
    }, sel);
  /** The toolbar's controls in DOM order (not moved into More), by name. */
  const controls = (sel) =>
    page.evaluate((s) => {
      const bar = document.querySelector(s);
      return [...bar.querySelectorAll("button, select, input:not([type=hidden])")]
        .filter((el) => !el.closest("[inert]") && !el.closest('[role="menu"]'))
        .map((el) => ({ name: el.getAttribute("aria-label") ?? el.textContent.trim(), disabled: el.disabled, stop: el.getAttribute("tabindex") === "0" }));
    }, sel);

  await page.setViewportSize({ width: 1280, height: 900 });
  await load("toolbar-toolbar");

  // ── 1–3: the editor ─────────────────────────────────────────────────────
  const EDITOR = '[data-sc="toolbar-editor"]';
  await page.locator(EDITOR).scrollIntoViewIfNeeded();
  const moved = await page.locator(`${EDITOR} > [data-toolbar-unit][data-overflowed]`).count();
  if (moved !== 0) fail.push(`harness: ${moved} editor units moved into More at 1280`);
  const list = await controls(EDITOR);
  // Undo, Redo, Font, four style toggles, four alignment radios, link, image.
  if (list.length !== 13) fail.push(`harness: the editor lists ${list.length} controls, expected the 13 the demo renders`);
  const stops = list.filter((c) => c.stop);
  if (stops.length !== 1 || stops[0].name !== list[0]?.name) fail.push(`one tab stop: ${JSON.stringify(stops.map((c) => c.name))}, expected only "${list[0]?.name}"`);

  // Tab in from the control before the toolbar.
  await page.evaluate((s) => {
    const bar = document.querySelector(s);
    const before = [...document.querySelectorAll("a[href], button:not(:disabled), input, select, [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !bar.contains(el) && el.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING && el.checkVisibility(),
    );
    before.at(-1)?.focus();
  }, EDITOR);
  await page.keyboard.press("Tab");
  const entered = await focused(EDITOR);
  if (!entered.inside || entered.name !== list[0]?.name) fail.push(`Tab into the toolbar landed on ${JSON.stringify(entered)}, expected "${list[0]?.name}"`);
  await page.keyboard.press("Tab");
  const left = await focused(EDITOR);
  if (left.inside) fail.push(`a second Tab stayed in the toolbar (on "${left.name}"): more than one tab stop`);

  await page.locator(EDITOR).locator("button, select").first().focus();
  const walk = [];
  for (let i = 0; i < list.length; i += 1) {
    await page.keyboard.press("ArrowRight");
    walk.push((await focused(EDITOR)).name);
  }
  const expected = [...list.slice(1).map((c) => c.name), list[0]?.name];
  if (JSON.stringify(walk) !== JSON.stringify(expected)) fail.push(`ArrowRight walk ${JSON.stringify(walk)}, expected ${JSON.stringify(expected)}`);
  await page.keyboard.press("End");
  const end = await focused(EDITOR);
  if (end.name !== list.at(-1)?.name) fail.push(`End landed on "${end.name}", expected "${list.at(-1)?.name}"`);
  await page.keyboard.press("Home");
  const home = await focused(EDITOR);
  if (home.name !== list[0]?.name) fail.push(`Home landed on "${home.name}", expected "${list[0]?.name}"`);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const remembered = (await focused(EDITOR)).name;
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const back = await focused(EDITOR);
  if (!back.inside || back.name !== remembered) fail.push(`Shift+Tab back in landed on ${JSON.stringify(back)}, expected "${remembered}"`);

  // ── 4: radios inside the toolbar ────────────────────────────────────────
  const radios = page.locator(EDITOR).getByRole("radio");
  const checkedNames = () => radios.evaluateAll((all) => all.filter((r) => r.getAttribute("aria-checked") === "true").map((r) => r.getAttribute("aria-label")));
  const beforeChecked = await checkedNames();
  if (beforeChecked.length !== 1) fail.push(`harness: the editor's alignment has ${beforeChecked.length} checked radios`);
  await radios.first().focus();
  await page.keyboard.press("ArrowRight");
  const onSecond = await focused(EDITOR);
  const afterArrow = await checkedNames();
  if (onSecond.name !== (await radios.nth(1).getAttribute("aria-label"))) fail.push(`ArrowRight from the first radio landed on "${onSecond.name}"`);
  if (JSON.stringify(afterArrow) !== JSON.stringify(beforeChecked)) fail.push(`an arrow inside the toolbar changed the checked radio: ${JSON.stringify(beforeChecked)} → ${JSON.stringify(afterArrow)}`);
  await page.keyboard.press("Space");
  const afterSpace = await checkedNames();
  if (JSON.stringify(afterSpace) !== JSON.stringify([onSecond.name])) fail.push(`Space checked ${JSON.stringify(afterSpace)}, expected ["${onSecond.name}"]`);

  // ── 5: disabled vs aria-disabled ────────────────────────────────────────
  // Undo (disabled), Redo (aria-disabled), | Ruler, Grid (disabled), | Save (busy), Delete.
  // From Ruler, ArrowLeft reaches Redo; the next ArrowLeft passes over Undo and wraps
  // to the last control. Were Undo in the walk, focus() on it would fail and focus
  // would stay on Redo.
  const STATES = '[data-sc="toolbar-states"]';
  const states = await controls(STATES);
  if (states[0]?.name !== "Undo" || !states[0].disabled) fail.push(`harness: the States toolbar does not start with a disabled Undo (${JSON.stringify(states[0])})`);
  await page.locator(STATES).getByRole("button", { name: "Ruler" }).focus();
  await page.keyboard.press("ArrowLeft");
  const ariaDisabledStop = await focused(STATES);
  if (ariaDisabledStop.name !== "Redo") fail.push(`ArrowLeft from Ruler landed on "${ariaDisabledStop.name}", expected the aria-disabled Redo`);
  await page.keyboard.press("ArrowLeft");
  const wrapped = await focused(STATES);
  if (wrapped.name !== states.at(-1)?.name) fail.push(`ArrowLeft from Redo landed on "${wrapped.name}", expected to pass over the disabled Undo and wrap to "${states.at(-1)?.name}"`);

  // ── 6: right to left ────────────────────────────────────────────────────
  const RTL = '[data-sc="toolbar-rtl"]';
  await page.locator(RTL).scrollIntoViewIfNeeded();
  const rtl = await page.evaluate((s) => {
    const items = [...document.querySelector(s).querySelectorAll("button, select")].filter((el) => !el.closest("[inert]"));
    const [a, b] = items.map((el) => el.getBoundingClientRect());
    return { names: items.slice(0, 2).map((el) => el.getAttribute("aria-label")), secondIsLeft: Boolean(a && b && b.right <= a.left + 1) };
  }, RTL);
  if (!rtl.secondIsLeft) fail.push("harness: in the RTL editor the second control is not to the left of the first");
  await page.locator(RTL).getByRole("button", { name: rtl.names[0] }).focus();
  await page.keyboard.press("ArrowLeft");
  const rtlNext = await focused(RTL);
  if (rtlNext.name !== rtl.names[1]) fail.push(`RTL: ArrowLeft landed on "${rtlNext.name}", expected "${rtl.names[1]}"`);
  await page.keyboard.press("ArrowRight");
  const rtlBack = await focused(RTL);
  if (rtlBack.name !== rtl.names[0]) fail.push(`RTL: ArrowRight landed on "${rtlBack.name}", expected "${rtl.names[0]}"`);

  // ── 7: a text input keeps its caret ─────────────────────────────────────
  const FIND = '[data-sc="toolbar-find"]';
  const input = page.locator(FIND).getByRole("textbox", { name: "Find" });
  await input.scrollIntoViewIfNeeded();
  await input.focus();
  await input.evaluate((el) => el.setSelectionRange(3, 3));
  await page.keyboard.press("ArrowLeft");
  const caretAfterLeft = await input.evaluate((el) => (document.activeElement === el ? el.selectionStart : null));
  if (caretAfterLeft !== 2) fail.push(`ArrowLeft mid-text: caret ${caretAfterLeft} (null = focus left the input), expected 2`);
  await page.keyboard.press("Home");
  const caretAfterHome = await input.evaluate((el) => (document.activeElement === el ? el.selectionStart : null));
  if (caretAfterHome !== 0) fail.push(`Home in the input: caret ${caretAfterHome} (null = focus left the input), expected 0`);
  await page.keyboard.press("ArrowLeft");
  const fromStart = await focused(FIND);
  if (fromStart.name !== "Previous match") fail.push(`ArrowLeft at the caret's start landed on "${fromStart.name}", expected "Previous match"`);
  await input.focus();
  await input.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
  await page.keyboard.press("ArrowRight");
  const fromEnd = await focused(FIND);
  if (fromEnd.name !== "Next match") fail.push(`ArrowRight at the caret's end landed on "${fromEnd.name}", expected "Next match"`);

  // ── 8: ToggleGroup standalone ───────────────────────────────────────────
  await load("toolbar-togglegroup");
  const MULTI = '[data-sc="toggle-multiple"] [role="group"][aria-label="Text style"]';
  await page.locator(MULTI).scrollIntoViewIfNeeded();
  const pressed = () => page.locator(MULTI).evaluate((g) => [...g.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label")));
  const startPressed = await pressed();
  if (JSON.stringify(startPressed) !== JSON.stringify(["Bold"])) fail.push(`harness: Text style starts pressed ${JSON.stringify(startPressed)}, expected ["Bold"]`);
  await page.locator(MULTI).getByRole("button", { name: "Bold" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  const twoPressed = await pressed();
  if (JSON.stringify(twoPressed) !== JSON.stringify(["Bold", "Italic"])) fail.push(`multiple: after Space on Italic, pressed ${JSON.stringify(twoPressed)}, expected Bold and Italic`);

  const SINGLE = '[data-sc="toggle-single"] [role="radiogroup"]';
  const checked = (sel) => page.locator(sel).evaluate((g) => [...g.querySelectorAll('[aria-checked="true"]')].map((b) => b.getAttribute("aria-label")));
  const startChecked = await checked(SINGLE);
  if (startChecked.length !== 1) fail.push(`harness: the single group starts with ${startChecked.length} checked`);
  await page.evaluate((s) => {
    const group = document.querySelector(s);
    const before = [...document.querySelectorAll("button:not(:disabled), input, select, [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !group.contains(el) && el.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING && el.checkVisibility(),
    );
    before.at(-1)?.focus();
  }, SINGLE);
  await page.keyboard.press("Tab");
  const tabbedRadio = await focused(SINGLE);
  if (!tabbedRadio.inside || tabbedRadio.name !== startChecked[0]) fail.push(`single: Tab landed on ${JSON.stringify(tabbedRadio)}, expected the checked "${startChecked[0]}"`);
  await page.keyboard.press("ArrowRight");
  const movedTo = await focused(SINGLE);
  const nowChecked = await checked(SINGLE);
  if (JSON.stringify(nowChecked) !== JSON.stringify([movedTo.name]) || movedTo.name === startChecked[0]) {
    fail.push(`single: ArrowRight focused "${movedTo.name}" and checked ${JSON.stringify(nowChecked)}; expected it alone checked`);
  }

  const RTL_SINGLE = '[data-sc="toggle-rtl"] [role="radiogroup"]';
  const rtlRadios = await page.locator(RTL_SINGLE).evaluate((g) => [...g.querySelectorAll('[role="radio"]')].map((r) => r.getAttribute("aria-label")));
  await page.locator(RTL_SINGLE).getByRole("radio", { name: rtlRadios[0] }).focus();
  await page.keyboard.press("ArrowLeft");
  const rtlChecked = await checked(RTL_SINGLE);
  if (JSON.stringify(rtlChecked) !== JSON.stringify([rtlRadios[1]])) fail.push(`RTL single: ArrowLeft checked ${JSON.stringify(rtlChecked)}, expected ["${rtlRadios[1]}"]`);

  const result = { walk, entered: entered.name, back: back.name, rtl: rtl.names, fromStart: fromStart.name, fromEnd: fromEnd.name, twoPressed, nowChecked, rtlChecked };
  if (fail.length) throw new Error(`toolbar-keyboard FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `toolbar-keyboard OK ${JSON.stringify(result)}`;
}
