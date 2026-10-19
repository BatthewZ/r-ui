// @covers   dates/TimeField, dates/TimePicker, dates/DateRangePicker
// @sections dates-timefield dates-timepicker dates-daterangepicker
// @tier     component
//
// Browser check: TimeField, TimePicker's list and DateRangePicker with times, with real keys,
// real focus, the top layer and real layout.
//
// jsdom runs the key models but has no layout, no CSS, no top layer, no scrolling and no hit
// testing, so the segment geometry, the ring and the band a focused segment paints, the visual
// order in a right-to-left page, "scrolled to the current time", option heights and the
// narrow layouts are settled here.
//
// On the three sections, opened alone together (default theme, comfortable + fine, 1280), it asserts:
//   1. harness: the de-DE demo's frame is exactly the page's --CONTROL-H (36px at
//      comfortable + fine, predicted from source) and has two segments;
//   2. segment keys in the 24-hour demo (real presses): "9" completes the hours
//      and focus moves to the minutes; "3" waits there ("09", "03"); "5" makes 35;
//      End then ArrowUp wraps 59 → 00 without touching the hours; the form submits
//      at = 09:00; Backspace empties the minutes and the form submits nothing;
//   3. the 12-hour demo: three segments ending in the day period; "1030" then "p"
//      submits at = 22:30 and the period reads "PM"; "a" submits 10:30;
//   4. focus paint: while a segment has focus the frame draws a solid outline and
//      the segment paints its band (a background image); under
//      emulated forced colours the band is still painted, not dropped;
//   5. a refused time (bounds 09:00–17:30, 18:00 shown): its hour segment is
//      aria-invalid and the reason is the visible text it is described by;
//   6. right-to-left page: in the ar-EG demo the hours sit left of the minutes;
//   7. compact card: its frames are the card's --CONTROL-H (28px), not the page's;
//   8. TimePicker harness: in the alert-rule card the "Active from" picker's list opens with
//      focus on the listbox and 96 options (a 15-minute step) (in place, top layer,
//      past a clipping compact card and options at its --ROW-H are sweep-floating's
//      sweep);
//   9. scrolled to the current time: the active option is 09:00 (the value) and
//      sits centred in the list's visible box (within one option) although the
//      list starts at 00:00;
//  10. list keys (real presses): ArrowDown ×2 → 09:30; End → 23:45 and still in
//      view; Home → 00:00; typing "1","7" → 17:00; Enter closes the list, focus is
//      back on its button, the hours segment reads 17 and the form saves
//      active = 17:00–17:30; Escape on the "Until" list keeps 17:30;
//  11. a 12-hour list (en-US): 48 options in "h:mm AM/PM", 2:30 PM selected;
//  12. DateRangePicker withTime (compact card): typed days and keyed times
//      (10/14/2026 8:15 AM → 10/15/2026 5:30 PM), Apply: the hidden input reads
//      2026-10-14T08:15±hh:mm/2026-10-15T17:30±hh:mm with the browser's own
//      offset for each instant, and the card reports the same; the "Last 24
//      hours" preset submits two instants exactly 24 hours apart;
//   then on TimeField and TimePicker at coarse input:
//  13. every segment in the TimeField section is at least 44px wide and tall,
//      neighbours never overlap, and a press at each segment's centre lands on it;
//  14. the list's options are at least 44px tall and a press 20px below the picker's
//      button's centre lands on it;
//   then at 375 wide:
//  15. TimeField (compact, coarse): no sideways scroll in the page and no frame wider than its row;
//  16. DateRangePicker with the time range popup open: no sideways scroll, the panel
//      inside the viewport, and every TimeField and date input inside the panel.
async (page) => {
  const fail = [];
  const open = (sections, { width, input = "fine", density = "comfortable" } = {}) =>
    openSection(page, sections, { width, view: { theme: "default", density, input } });
  const texts = (sc) =>
    page.evaluate((sc) => [...document.querySelectorAll(`[data-sc="${sc}"] [role="spinbutton"]`)].map((s) => s.getAttribute("aria-valuetext")), sc);
  const focusedType = () => page.evaluate(() => document.activeElement?.dataset?.type ?? document.activeElement?.tagName);
  const submit = async (sc) => {
    const form = page.locator(`[data-sc="${sc}"]`);
    await form.getByRole("button", { name: "Submit" }).click();
    return (await form.locator('[data-sc="submitted"]').textContent()).trim();
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

  // ── 1. harness ────────────────────────────────────────────────────────────
  await open(["dates-timefield", "dates-timepicker", "dates-daterangepicker"]);
  const harness = await page.evaluate(() => {
    const frame = document.querySelector('[data-sc="time-24h"] [role="group"]');
    return {
      h: frame?.getBoundingClientRect().height,
      token: frame ? Number.parseFloat(getComputedStyle(frame).getPropertyValue("--CONTROL-H")) : null,
      segments: frame?.querySelectorAll('[role="spinbutton"]').length,
    };
  });
  if (!(harness.token === 36 && harness.h === 36 && harness.segments === 2)) fail.push(`harness: 24-hour frame ${JSON.stringify(harness)} (expected 36px, --CONTROL-H 36, 2 segments)`);

  // ── 2. segment keys, 24-hour ──────────────────────────────────────────────
  const hours24 = page.locator('[data-sc="time-24h"] [data-type="hour"]');
  await hours24.click();
  await page.keyboard.press("9");
  const afterNine = { at: await focusedType(), shown: await texts("time-24h") };
  await page.keyboard.press("3");
  const afterThree = { at: await focusedType(), shown: await texts("time-24h") };
  await page.keyboard.press("5");
  const afterFive = await texts("time-24h");
  if (afterNine.at !== "minute") fail.push(`keys: "9" left focus on ${afterNine.at}, expected the minutes`);
  if (afterThree.at !== "minute" || afterThree.shown.join(":") !== "09:03") fail.push(`keys: "9","3" → ${JSON.stringify(afterThree)}, expected 09:03 waiting on the minutes`);
  if (afterFive.join(":") !== "09:35") fail.push(`keys: "9","3","5" → ${afterFive.join(":")}`);
  await page.locator('[data-sc="time-24h"] [data-type="minute"]').focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  const wrapped = await texts("time-24h");
  if (wrapped.join(":") !== "09:00") fail.push(`keys: End, ArrowUp → ${wrapped.join(":")}, expected 09:00 (59 wraps to 00, no carry)`);
  const sent24 = await submit("time-24h");
  if (sent24 !== "at = 09:00") fail.push(`submit 24-hour: "${sent24}"`);
  await page.locator('[data-sc="time-24h"] [data-type="minute"]').focus();
  await page.keyboard.press("Backspace");
  const cleared = await submit("time-24h");
  if (cleared !== "at = (empty)") fail.push(`Backspace: the form submitted "${cleared}" with the minutes empty`);

  // ── 3. 12-hour ─────────────────────────────────────────────────────────────
  const order12 = await page.evaluate(() => [...document.querySelectorAll('[data-sc="time-12h"] [role="spinbutton"]')].map((s) => s.dataset.type));
  if (order12.join() !== "hour,minute,dayPeriod") fail.push(`12-hour: segments ${order12.join()}`);
  await page.locator('[data-sc="time-12h"] [data-type="hour"]').click();
  for (const key of ["1", "0", "3", "0", "p"]) await page.keyboard.press(key);
  const pm = { sent: await submit("time-12h"), shown: await texts("time-12h") };
  if (pm.sent !== "at = 22:30" || pm.shown.join(" ") !== "10 30 PM") fail.push(`12-hour: "1030p" → ${JSON.stringify(pm)}`);
  await page.locator('[data-sc="time-12h"] [data-type="dayPeriod"]').focus();
  await page.keyboard.press("a");
  const am = await submit("time-12h");
  if (am !== "at = 10:30") fail.push(`12-hour: "a" → "${am}"`);

  // ── 4. focus paint ─────────────────────────────────────────────────────────
  const paint = () =>
    page.evaluate(() => {
      const segment = document.querySelector('[data-sc="time-12h"] [data-type="minute"]');
      segment.focus();
      const frame = segment.closest('[role="group"]');
      const f = getComputedStyle(frame);
      return {
        focused: document.activeElement === segment,
        outline: f.outlineStyle,
        width: Number.parseFloat(f.outlineWidth),
        band: getComputedStyle(segment).backgroundImage,
      };
    });
  const ring = await paint();
  if (!(ring.focused && ring.outline === "solid" && ring.width > 0 && ring.band.startsWith("linear-gradient"))) fail.push(`focus paint: ${JSON.stringify(ring)}`);
  await setView(page, { forced: true });
  const forced = await paint();
  await setView(page, { forced: false });
  if (!(forced.outline === "solid" && forced.band.startsWith("linear-gradient"))) fail.push(`forced colours: the focused segment lost its band or the frame its ring (${JSON.stringify(forced)})`);

  // ── 5. a refused time ──────────────────────────────────────────────────────
  const refused = await page.evaluate(() => {
    const segment = document.querySelector('[data-sc="time-bounded"] [data-type="hour"]');
    const said = (segment.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el) => el && el.checkVisibility())
      .map((el) => el.textContent.trim());
    return { invalid: segment.getAttribute("aria-invalid"), said };
  });
  if (refused.invalid !== "true" || !refused.said.some((t) => /^Choose a time from 9:00\sAM to 5:30\sPM\.$/.test(t))) fail.push(`refusal: ${JSON.stringify(refused)}`);

  // ── 6. right-to-left ───────────────────────────────────────────────────────
  const rtl = await page.evaluate(() => {
    const field = document.querySelector('[data-sc="time-rtl"]');
    const x = (type) => field.querySelector(`[data-type="${type}"]`).getBoundingClientRect().left;
    return { dir: getComputedStyle(field).direction, hour: x("hour"), minute: x("minute") };
  });
  if (!(rtl.dir === "rtl" && rtl.hour < rtl.minute)) fail.push(`RTL: ${JSON.stringify(rtl)} (expected an rtl page with the hours left of the minutes)`);

  // ── 7. compact card ────────────────────────────────────────────────────────
  const compact = await page.evaluate(() => {
    const card = document.querySelector('[data-sc="time-compact-card"]');
    const frames = [...card.querySelectorAll('[role="group"]')].map((f) => f.getBoundingClientRect().height);
    return { frames, token: Number.parseFloat(getComputedStyle(card).getPropertyValue("--CONTROL-H")) };
  });
  if (!(compact.token === 28 && compact.frames.length === 2 && compact.frames.every((h) => h === 28))) fail.push(`compact: frames ${JSON.stringify(compact)} (expected 2 × 28px)`);

  // ── 8. TimePicker harness: the list opens with focus on it ──────────────────
  await card.scrollIntoViewIfNeeded();
  await pickerButton("Active from").click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox");
  await page.waitForTimeout(300);
  const popup = await page.evaluate(() => {
    const list = document.activeElement;
    return { options: list.querySelectorAll('[role="option"]').length };
  });
  if (popup.options !== 96) fail.push(`list options: ${popup.options}, expected 96 (a 15-minute step)`);

  // ── 9. scrolled to the current time ─────────────────────────────────────────
  const first = await listState();
  if (!(first.focused && first.active === "09:00" && first.inView && first.scrolled > 0 && first.offCentre <= 1)) fail.push(`scroll to current: ${JSON.stringify(first)} (expected centred within one option)`);

  // ── 10. list keys ───────────────────────────────────────────────────────────
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

  // ── 11. a 12-hour list ──────────────────────────────────────────────────────
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

  // ── 12. DateRangePicker with times ──────────────────────────────────────────
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

  // ── 13. coarse: TimeField segments ──────────────────────────────────────────
  await open(["dates-timefield", "dates-timepicker"], { input: "coarse" });
  const coarse = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[id="dates-timefield"] [role="group"]')].filter((g) => g.querySelector('[role="spinbutton"]'));
    const small = [];
    const missed = [];
    let overlaps = 0;
    let count = 0;
    for (const group of groups) {
      const boxes = [...group.querySelectorAll('[role="spinbutton"]')].map((s) => ({ s, r: s.getBoundingClientRect() }));
      boxes.sort((a, b) => a.r.left - b.r.left);
      boxes.forEach(({ s, r }, i) => {
        count += 1;
        if (r.width < 44 || r.height < 44) small.push(`${s.dataset.type} ${Math.round(r.width)}×${Math.round(r.height)}`);
        const next = boxes[i + 1];
        if (next && r.right > next.r.left + 0.5) overlaps += 1;
        s.scrollIntoView({ block: "center" });
        const box = s.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || !s.contains(hit)) missed.push(s.dataset.type);
      });
    }
    return { count, small: small.slice(0, 4), overlaps, missed: missed.slice(0, 4) };
  });
  // Count before trusting "none were small": an empty list passes every check.
  if (!(coarse.count >= 20 && coarse.small.length === 0 && coarse.overlaps === 0 && coarse.missed.length === 0)) fail.push(`coarse: ${JSON.stringify(coarse)}`);

  // ── 14. coarse: TimePicker list and button ──────────────────────────────────
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
  const coarseList = await page.evaluate(() => {
    const options = [...document.activeElement.querySelectorAll('[role="option"]')].map((o) => o.getBoundingClientRect().height);
    return { count: options.length, min: Math.min(...options) };
  });
  if (!(coarseList.count === 96 && coarseList.min >= 44)) fail.push(`coarse list: ${JSON.stringify(coarseList)}`);
  if (hit !== "Choose time") fail.push(`coarse: a press 20px below the list button's centre lands on ${hit}`);

  // ── 15. 375: TimeField ──────────────────────────────────────────────────────
  await open("dates-timefield", { width: 375, input: "coarse", density: "compact" });
  const narrow = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('[id="dates-timefield"] [role="group"]')].filter((g) => g.querySelector('[role="spinbutton"]'));
    const spills = frames.filter((f) => {
      const r = f.getBoundingClientRect();
      const row = f.parentElement.parentElement.getBoundingClientRect();
      return r.right > row.right + 0.5 || r.left < row.left - 0.5 || f.scrollWidth > f.clientWidth;
    });
    return {
      frames: frames.length,
      spills: spills.length,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (!(narrow.frames >= 10 && narrow.spills === 0 && narrow.scroll === 0)) fail.push(`375: ${JSON.stringify(narrow)}`);

  // ── 16. 375: DateRangePicker with times ─────────────────────────────────────
  await open("dates-daterangepicker", { width: 375 });
  await rangeCard.scrollIntoViewIfNeeded();
  await rangeCard.getByRole("button", { name: /Time range/ }).click();
  await dialog.waitFor();
  await page.waitForTimeout(400);
  const narrowRange = await page.evaluate(() => {
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
  if (!(narrowRange.scroll === 0 && narrowRange.left >= 0 && narrowRange.right >= 0 && narrowRange.parts === 4 && narrowRange.outside === 0)) fail.push(`375 range with times: ${JSON.stringify(narrowRange)}`);
  await page.keyboard.press("Escape");

  if (fail.length) throw new Error(fail.join("\n"));
  return `dates-time ok: time field: frame ${harness.h}px; 9,3,5 → ${afterFive.join(":")}; 12h → ${pm.sent}; compact ${compact.frames[0]}px; coarse ${coarse.count} segments ≥ 44px; 375 no spill; time picker: ${popup.options} options; keys → ${typed.active}; saved ${saved}; range wire ${wire.hidden}; 375 no spill; coarse options ${coarseList.min}px`;
}
