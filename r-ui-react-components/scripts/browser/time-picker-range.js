// Browser check: TimePicker's list and DateRangePicker with times, with real
// keys, the top layer and real layout.
//
// jsdom runs the list's key model but has no top layer, no scrolling and no
// layout, so "scrolled to the current time", "escapes the clipping card",
// option heights and the range popup at 375 are settled here.
//
// On the Overview's TimePicker and DateRangePicker sections (default theme) it asserts:
//   1. harness: in the alert-rule card (compact, overflow hidden) the "Active
//      from" picker's list opens with focus on the listbox, as a DOM descendant of
//      the card, in the top layer (:popover-open), reaching past the card's clip,
//      its options the card's --ROW-H (compact, not the page's);
//   2. scrolled to the current time: the active option is 09:00 (the value) and
//      sits centred in the list's visible box (within one option) although the
//      list starts at 00:00;
//   3. list keys (real presses): ArrowDown ×2 → 09:30; End → 23:45 and still in
//      view; Home → 00:00; typing "1","7" → 17:00; Enter closes the list, focus is
//      back on its button, the hours segment reads 17 and the form saves
//      active = 17:00–17:30; Escape on the "Until" list keeps 17:30;
//   4. a 12-hour list (en-US): 48 options in "h:mm AM/PM", 2:30 PM selected;
//   5. DateRangePicker withTime (compact card): typed days and keyed times
//      (10/14/2026 8:15 AM → 10/15/2026 5:30 PM), Apply: the hidden input reads
//      2026-10-14T08:15±hh:mm/2026-10-15T17:30±hh:mm with the browser's own
//      offset for each instant, and the card reports the same; the "Last 24
//      hours" preset submits two instants exactly 24 hours apart;
//   6. at 375 with the time range popup open: no sideways scroll, the panel
//      inside the viewport, and every TimeField and date input inside the panel;
//   7. coarse input: the list's options and the picker's button are at least 44px.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const open = async (section, { width = 1280, input = "fine" } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${section}`);
    await page.evaluate(
      ({ KEY, input }) => localStorage.setItem(KEY, JSON.stringify({ theme: "default", density: "comfortable", input })),
      { KEY: SHOWCASE_VIEW_KEY, input },
    );
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${section}"]`).waitFor();
  };
  const card = page.locator('[data-sc="alert-hours"]');
  const pickerButton = (label) => card.getByRole("group", { name: label }).getByRole("button", { name: "Choose time" });
  const listState = () =>
    page.evaluate(() => {
      const list = document.activeElement?.closest('[role="listbox"]');
      if (!list) return { focused: false, at: document.activeElement?.tagName };
      const active = document.getElementById(list.getAttribute("aria-activedescendant"));
      const l = list.getBoundingClientRect();
      const a = active?.getBoundingClientRect();
      return {
        focused: true,
        active: active?.textContent.trim(),
        inView: Boolean(a && a.top >= l.top - 0.5 && a.bottom <= l.bottom + 0.5),
        // How far the active option's centre sits from the list's, in option heights.
        offCentre: a ? Math.abs((a.top + a.bottom) / 2 - (l.top + l.bottom) / 2) / a.height : null,
        scrolled: list.scrollTop,
      };
    });

  // ── 1. harness: the list from a compact clipping card ─────────────────────
  await open("dates-timepicker");
  await card.scrollIntoViewIfNeeded();
  await pickerButton("Active from").click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox");
  await page.waitForTimeout(300);
  const popup = await page.evaluate(() => {
    const card = document.querySelector('[data-sc="alert-hours"]');
    const list = document.activeElement;
    const panel = list.closest('[role="dialog"]');
    const clip = card.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const options = [...list.querySelectorAll('[role="option"]')].map((o) => o.getBoundingClientRect().height);
    return {
      inCard: card.contains(panel),
      topLayer: panel.matches(":popover-open"),
      overflow: getComputedStyle(card).overflow,
      reachesPast: p.bottom > clip.bottom + 20 || p.top < clip.top - 20,
      options: options.length,
      rowH: Number.parseFloat(getComputedStyle(card).getPropertyValue("--ROW-H")),
      pageRowH: Number.parseFloat(getComputedStyle(document.querySelector("main") ?? document.body).getPropertyValue("--ROW-H")),
      optionH: Math.min(...options),
      optionMax: Math.max(...options),
    };
  });
  if (popup.overflow !== "hidden") fail.push(`harness: the alert card is overflow ${popup.overflow}, expected hidden`);
  if (!popup.inCard || !popup.topLayer || !popup.reachesPast) fail.push(`list popup: in card ${popup.inCard}, top layer ${popup.topLayer}, past the clip ${popup.reachesPast}`);
  if (!(popup.options === 96 && popup.rowH < popup.pageRowH && popup.optionH === popup.rowH && popup.optionMax === popup.rowH)) {
    fail.push(`list options: ${JSON.stringify(popup)} (expected 96 options at the card's compact --ROW-H)`);
  }

  // ── 2. scrolled to the current time ───────────────────────────────────────
  const first = await listState();
  if (!(first.focused && first.active === "09:00" && first.inView && first.scrolled > 0 && first.offCentre <= 1)) fail.push(`scroll to current: ${JSON.stringify(first)} (expected centred within one option)`);

  // ── 3. list keys ───────────────────────────────────────────────────────────
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const down = await listState();
  await page.keyboard.press("End");
  const end = await listState();
  await page.keyboard.press("Home");
  const home = await listState();
  await page.keyboard.press("1");
  await page.keyboard.press("7");
  const typed = await listState();
  if (down.active !== "09:30") fail.push(`list keys: ArrowDown ×2 → ${down.active}`);
  if (end.active !== "23:45" || !end.inView) fail.push(`list keys: End → ${JSON.stringify(end)}`);
  if (home.active !== "00:00" || !home.inView || home.scrolled !== 0) fail.push(`list keys: Home → ${JSON.stringify(home)}`);
  if (typed.active !== "17:00" || !typed.inView) fail.push(`list keys: "1","7" → ${JSON.stringify(typed)}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const chosen = await page.evaluate(() => {
    const field = [...document.querySelectorAll('[data-sc="alert-hours"] [role="group"]')][0];
    return {
      lists: document.querySelectorAll('[data-sc="alert-hours"] [role="listbox"]').length,
      focusOnButton: document.activeElement?.getAttribute("aria-label") === "Choose time" && field.contains(document.activeElement),
      hours: field.querySelector('[data-type="hour"]').getAttribute("aria-valuetext"),
    };
  });
  if (!(chosen.lists === 0 && chosen.focusOnButton && chosen.hours === "17")) fail.push(`Enter: ${JSON.stringify(chosen)}`);
  await pickerButton("Until").click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox");
  const until = await listState();
  if (until.active !== "17:30") fail.push(`Until list opened on ${until.active}, expected 17:30`);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await card.getByRole("button", { name: "Save rule" }).click();
  const saved = (await card.locator('[data-sc="submitted"]').textContent()).trim();
  if (saved !== "active = 17:00–17:30") fail.push(`alert rule saved "${saved}"`);

  // ── 4. a 12-hour list ──────────────────────────────────────────────────────
  await page.locator('[data-sc="picker-12h"]').getByRole("button", { name: "Choose time" }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox");
  const twelve = await page.evaluate(() => {
    const options = [...document.activeElement.querySelectorAll('[role="option"]')];
    return {
      count: options.length,
      shaped: options.every((o) => /^\d{1,2}:\d\d\s[AP]M$/.test(o.textContent.trim())),
      selected: options.filter((o) => o.getAttribute("aria-selected") === "true").map((o) => o.textContent.replace(/\s/g, " ").trim()),
    };
  });
  if (!(twelve.count === 48 && twelve.shaped && twelve.selected.join() === "2:30 PM")) fail.push(`12-hour list: ${JSON.stringify(twelve)}`);
  await page.keyboard.press("Escape");

  // ── 5. DateRangePicker with times ──────────────────────────────────────────
  await open("dates-daterangepicker");
  const rangeCard = page.locator('[data-sc="range-time-card"]');
  await rangeCard.scrollIntoViewIfNeeded();
  await rangeCard.getByRole("button", { name: /Time range/ }).click();
  const dialog = rangeCard.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(300);
  const typeDay = async (name, text) => {
    const input = dialog.getByRole("textbox", { name, exact: true });
    await input.fill(text);
    await input.press("Enter");
  };
  const keyTime = async (label, keys) => {
    await dialog.getByRole("spinbutton", { name: `${label} Hours` }).click();
    for (const key of keys) await page.keyboard.press(key);
  };
  await typeDay("Start", "10/14/2026");
  await typeDay("End", "10/15/2026");
  await keyTime("Start time", ["8", "1", "5", "a"]);
  await keyTime("End time", ["5", "3", "0", "p"]);
  await dialog.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(300);
  const wire = await page.evaluate(() => {
    const card = document.querySelector('[data-sc="range-time-card"]');
    const offset = (d) => {
      const m = -d.getTimezoneOffset();
      const abs = Math.abs(m);
      return `${m < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
    };
    return {
      hidden: card.querySelector('input[type="hidden"][name="window"]')?.value,
      expected: `2026-10-14T08:15${offset(new Date(2026, 9, 14, 8, 15))}/2026-10-15T17:30${offset(new Date(2026, 9, 15, 17, 30))}`,
      shown: card.querySelector('[data-sc="range-time-value"]').textContent.trim(),
    };
  });
  if (wire.hidden !== wire.expected || wire.shown !== wire.expected.replace("/", " → ")) fail.push(`withTime wire: ${JSON.stringify(wire)}`);
  await rangeCard.getByRole("button", { name: /Time range/ }).click();
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Last 24 hours" }).click();
  await page.waitForTimeout(300);
  const day = await page.evaluate(() => {
    const value = document.querySelector('[data-sc="range-time-card"] input[type="hidden"][name="window"]')?.value ?? "";
    const [start, end] = value.split("/").map((t) => new Date(t).getTime());
    return { value, span: end - start };
  });
  if (day.span !== 86_400_000) fail.push(`Last 24 hours submitted ${JSON.stringify(day)}, expected two instants 24 h apart`);

  // ── 6. 375 ─────────────────────────────────────────────────────────────────
  await open("dates-daterangepicker", { width: 375 });
  await rangeCard.scrollIntoViewIfNeeded();
  await rangeCard.getByRole("button", { name: /Time range/ }).click();
  await dialog.waitFor();
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const panel = document.querySelector('[data-sc="range-time-card"] [role="dialog"]');
    const p = panel.getBoundingClientRect();
    const parts = [...panel.querySelectorAll('[role="group"]:has([role="spinbutton"]), input:not([type="hidden"])')];
    const outside = parts.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < p.left - 0.5 || r.right > p.right + 0.5;
    });
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      left: p.left,
      right: window.innerWidth - p.right,
      parts: parts.length,
      outside: outside.length,
    };
  });
  if (!(narrow.scroll === 0 && narrow.left >= 0 && narrow.right >= 0 && narrow.parts === 4 && narrow.outside === 0)) fail.push(`375 range with times: ${JSON.stringify(narrow)}`);
  await page.keyboard.press("Escape");

  // ── 7. coarse ──────────────────────────────────────────────────────────────
  await open("dates-timepicker", { input: "coarse" });
  await card.scrollIntoViewIfNeeded();
  const button = await pickerButton("Active from").boundingBox();
  // The icon button meets the floor through its hit area: probe a point 20px below its
  // centre, before the list opens over that point.
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), {
    x: button.x + button.width / 2,
    y: button.y + button.height / 2 + 20,
  });
  await pickerButton("Active from").click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox");
  const coarse = await page.evaluate(() => {
    const options = [...document.activeElement.querySelectorAll('[role="option"]')].map((o) => o.getBoundingClientRect().height);
    return { count: options.length, min: Math.min(...options) };
  });
  if (!(coarse.count === 96 && coarse.min >= 44)) fail.push(`coarse list: ${JSON.stringify(coarse)}`);
  if (hit !== "Choose time") fail.push(`coarse: a press 20px below the list button's centre lands on ${hit}`);

  if (fail.length) throw new Error(fail.join("\n"));
  return `time picker ok: list in the card's top layer, ${popup.options} options at ${popup.optionH}px; keys → ${typed.active}; saved ${saved}; range wire ${wire.hidden}; 375 no spill; coarse options ${coarse.min}px`;
}
