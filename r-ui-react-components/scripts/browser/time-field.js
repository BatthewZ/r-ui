// Browser check: TimeField with real keys, real focus and real layout.
//
// jsdom runs the key model but has no layout, no CSS and no hit testing, so the
// segment geometry, the ring and the band a focused segment paints, the visual
// order in a right-to-left page and the narrow layout are settled here.
//
// On the Overview's TimeField section (default theme) it asserts:
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
//      emulated forced colours the band is still painted (Highlight), not dropped;
//   5. a refused time (bounds 09:00–17:30, 18:00 shown): its segments are
//      aria-invalid and the reason is the visible text they are described by;
//   6. right-to-left page: in the ar-EG demo the hours sit left of the minutes;
//   7. compact card: its frames are the card's --CONTROL-H (28px), not the page's;
//   8. coarse input: every segment in the section is at least 44px wide and tall,
//      neighbours never overlap, and a press at each segment's centre lands on it;
//   9. at 375 wide: no sideways scroll in the page and no frame wider than its row.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const open = async ({ width = 1280, input = "fine", density = "comfortable" } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/dates-timefield`);
    await page.evaluate(
      ({ KEY, input, density }) => localStorage.setItem(KEY, JSON.stringify({ theme: "default", density, input })),
      { KEY: SHOWCASE_VIEW_KEY, input, density },
    );
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[id="dates-timefield"]').waitFor();
  };
  const texts = (sc) =>
    page.evaluate((sc) => [...document.querySelectorAll(`[data-sc="${sc}"] [role="spinbutton"]`)].map((s) => s.getAttribute("aria-valuetext")), sc);
  const focusedType = () => page.evaluate(() => document.activeElement?.dataset?.type ?? document.activeElement?.tagName);
  const submit = async (sc) => {
    const form = page.locator(`[data-sc="${sc}"]`);
    await form.getByRole("button", { name: "Submit" }).click();
    return (await form.locator('[data-sc="submitted"]').textContent()).trim();
  };

  // ── 1. harness ────────────────────────────────────────────────────────────
  await open();
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
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await paint();
  await page.emulateMedia({ forcedColors: null });
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

  // ── 8. coarse ──────────────────────────────────────────────────────────────
  await open({ input: "coarse" });
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

  // ── 9. 375 ─────────────────────────────────────────────────────────────────
  await open({ width: 375, input: "coarse", density: "compact" });
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

  if (fail.length) throw new Error(fail.join("\n"));
  return `time field ok: frame ${harness.h}px; 9,3,5 → ${afterFive.join(":")}; 12h → ${pm.sent}; compact ${compact.frames[0]}px; coarse ${coarse.count} segments ≥ 44px; 375 no spill`;
}
