// Browser check: the dates group with real keys, real layout and the top layer.
//
// jsdom has no layout, no top layer and no hit testing, so the calendar's month
// count, its cell sizes and a popup escaping a clipping card are settled here.
//
// On the Overview's dates sections (default theme) it asserts:
//   1. harness: in the single-date demo a day cell is exactly the page's
//      --CONTROL-H (36px at comfortable + fine, predicted from source), and the
//      range demo shows two months side by side at 1280;
//   2. keyboard across a month boundary (real presses): from 30 October,
//      ArrowRight twice lands on 1 November, the grid pages to November 2026, and
//      ArrowLeft goes back into October;
//   3. a range by keyboard: Enter on 20 October, ArrowDown twice (3 November, in the
//      second month: no paging), Enter: the demo reports 2026-10-20 → 2026-11-03;
//   4. typed entry: "10/15/2026" in the en-US field and "15.10.2026" in the de-DE
//      field both submit due = 2026-10-15; "13/45/2026" is refused (aria-invalid,
//      the reason in its description, nothing submitted);
//   5. the DateRangePicker opened from the compact card with overflow: hidden is a
//      DOM descendant of the card, in the top layer (:popover-open), its day cells
//      are the CARD's --CONTROL-H (28px, not the page's 36px), it reaches past the
//      card's clip box, and a day lying outside that box takes the press
//      (elementFromPoint); a preset applies and the card reports it;
//   6. at 375 wide, with the range popup open: no sideways scroll in the page, the
//      panel lies inside the viewport, and the calendar fell back to one month
//      because its own width holds one;
//   7. at coarse input: every day cell and the month buttons are at least 44px, and
//      the toolbar trigger is at least 44px tall.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const KEY = "r-ui-showcase:view";
  const open = async (section, { width = 1280, input = "fine" } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${section}`);
    await page.evaluate(({ KEY, input }) => localStorage.setItem(KEY, JSON.stringify({ theme: "default", density: "comfortable", input })), { KEY, input });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${section}"]`).waitFor();
    await page.waitForTimeout(400);
  };
  const captions = (scope) =>
    page.evaluate(
      (scope) =>
        [...document.querySelectorAll(`${scope} [role="grid"]`)].map((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent),
      scope,
    );
  const focused = () => page.evaluate(() => document.activeElement?.dataset?.date ?? document.activeElement?.tagName);

  // ── 1. harness ────────────────────────────────────────────────────────────
  await open("dates-calendar");
  const single = '[data-sc="calendar-single"]';
  const harness = await page.evaluate((single) => {
    const cell = document.querySelector(`${single} [data-date="2026-10-30"]`);
    const r = cell.getBoundingClientRect();
    return { w: r.width, h: r.height, token: Number.parseFloat(getComputedStyle(cell).getPropertyValue("--CONTROL-H")) };
  }, single);
  if (harness.token !== 36 || harness.w !== 36 || harness.h !== 36) fail.push(`harness: day cell ${harness.w}×${harness.h}, --CONTROL-H ${harness.token} (expected 36)`);
  const wide = await captions('[data-sc="range-calendar"]');
  if (wide.join("|") !== "October 2026|November 2026") fail.push(`harness: range demo at 1280 shows ${JSON.stringify(wide)}, expected two months`);

  // ── 2. keyboard across a month boundary ───────────────────────────────────
  await page.locator(`${single} [data-date="2026-10-30"]`).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const crossed = { at: await focused(), shown: await captions(single) };
  await page.keyboard.press("ArrowLeft");
  const back = { at: await focused(), shown: await captions(single) };
  if (crossed.at !== "2026-11-01" || crossed.shown.join() !== "November 2026") fail.push(`keyboard: two ArrowRights from Oct 30 → ${JSON.stringify(crossed)}`);
  if (back.at !== "2026-10-31" || back.shown.join() !== "October 2026") fail.push(`keyboard: ArrowLeft from Nov 1 → ${JSON.stringify(back)}`);

  // ── 3. a range by keyboard ────────────────────────────────────────────────
  const range = '[data-sc="range-calendar"]';
  await page.locator(`${range} [data-date="2026-10-20"]`).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const mid = { at: await focused(), shown: await captions(range) };
  await page.keyboard.press("Enter");
  const picked = (await page.locator('[data-sc="range-output"]').textContent()).trim();
  if (mid.at !== "2026-11-03" || mid.shown.length !== 2) fail.push(`range: ArrowDown×2 from Oct 20 → ${JSON.stringify(mid)}`);
  if (picked !== "2026-10-20 → 2026-11-03") fail.push(`range: keyboard range reported "${picked}"`);

  // ── 4. typed entry per locale ─────────────────────────────────────────────
  await open("dates-datepicker");
  const typed = async (sc, text) => {
    const form = page.locator(`[data-sc="${sc}"]`);
    const input = form.getByRole("textbox");
    await input.fill(text);
    await input.press("Tab");
    await form.getByRole("button", { name: "Submit" }).click();
    return {
      submitted: (await form.locator('[data-sc="submitted"]').textContent()).trim(),
      invalid: await input.getAttribute("aria-invalid"),
      described: await input.evaluate((el) =>
        (el.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent).join(" | "),
      ),
    };
  };
  const en = await typed("datepicker-en", "10/15/2026");
  const de = await typed("datepicker-de", "15.10.2026");
  if (en.submitted !== "due = 2026-10-15" || en.invalid) fail.push(`typed en-US: ${JSON.stringify(en)}`);
  if (de.submitted !== "due = 2026-10-15" || de.invalid) fail.push(`typed de-DE: ${JSON.stringify(de)}`);
  await page.reload();
  await waitForShowcase(page);
  await page.locator('[data-sc="datepicker-en"]').waitFor();
  const bad = await typed("datepicker-en", "13/45/2026");
  if (bad.invalid !== "true" || !bad.described.includes("is not a date") || bad.submitted !== "due = (empty)") fail.push(`typed refusal: ${JSON.stringify(bad)}`);

  // ── 5. popup from a compact clipping card ─────────────────────────────────
  await open("dates-daterangepicker");
  const card = page.locator('[data-sc="range-toolbar-card"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: /Time range/ }).click();
  await page.waitForTimeout(300);
  const popup = await page.evaluate(() => {
    const card = document.querySelector('[data-sc="range-toolbar-card"]');
    const panel = card.querySelector('[role="dialog"]');
    if (!panel) return { panel: false };
    const clip = card.getBoundingClientRect();
    const days = [...panel.querySelectorAll("[data-date]")];
    // Below the card, or above it if the panel flipped.
    const outside = days.find((d) => {
      const r = d.getBoundingClientRect();
      return r.top > clip.bottom + 2 || r.bottom < clip.top - 2;
    });
    const or = outside?.getBoundingClientRect();
    const hit = or && document.elementFromPoint(or.left + or.width / 2, or.top + or.height / 2);
    const page36 = Number.parseFloat(getComputedStyle(document.querySelector("main") ?? document.body).getPropertyValue("--CONTROL-H"));
    return {
      panel: true,
      inCard: card.contains(panel),
      topLayer: panel.matches(":popover-open"),
      cardControl: Number.parseFloat(getComputedStyle(card).getPropertyValue("--CONTROL-H")),
      pageControl: page36,
      cell: days[0]?.getBoundingClientRect().height,
      overflow: getComputedStyle(card).overflow,
      reachesPast: (() => {
        const p = panel.getBoundingClientRect();
        return p.bottom > clip.bottom + 20 || p.top < clip.top - 20;
      })(),
      hitOutside: Boolean(hit && outside && hit.closest("[data-date]") === outside),
    };
  });
  if (!popup.panel) fail.push("popup: no dialog inside the card after pressing the trigger");
  else {
    if (!popup.inCard || !popup.topLayer) fail.push(`popup: in card ${popup.inCard}, top layer ${popup.topLayer}`);
    if (popup.overflow !== "hidden") fail.push(`popup harness: the card is overflow ${popup.overflow}, expected hidden`);
    if (!(popup.cardControl === 28 && popup.pageControl === 36 && popup.cell === 28)) fail.push(`popup: day cell ${popup.cell}px, card --CONTROL-H ${popup.cardControl}, page ${popup.pageControl} (expected compact 28 in a 36 page)`);
    if (!popup.reachesPast || !popup.hitOutside) fail.push(`popup: reaches past the clip ${popup.reachesPast}, a day outside it takes the press ${popup.hitOutside}`);
  }
  // A DOM click: the press itself was measured above, and a clipped panel must
  // report its failures rather than time out here.
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-sc="range-toolbar-card"] [role="dialog"] button')].find((b) => b.textContent === "Last 30 days")?.click(),
  );
  await page.waitForTimeout(300);
  const applied = (await card.locator('[data-sc="range-value"]').textContent()).trim();
  if (!applied.endsWith("(last-30-days)")) fail.push(`popup: preset reported "${applied}"`);

  // ── 6. 375 wide ────────────────────────────────────────────────────────────
  await open("dates-daterangepicker", { width: 375 });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: /Time range/ }).click();
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const panel = document.querySelector('[data-sc="range-toolbar-card"] [role="dialog"]');
    const r = panel?.getBoundingClientRect();
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      left: r?.left,
      right: r && window.innerWidth - r.right,
      months: panel ? panel.querySelectorAll('[role="grid"]').length : 0,
    };
  });
  if (narrow.scroll > 0) fail.push(`375: the page scrolls sideways by ${narrow.scroll}px with the popup open`);
  if (!(narrow.left >= 0 && narrow.right >= 0)) fail.push(`375: popup outside the viewport (left ${narrow.left}, right gap ${narrow.right})`);
  if (narrow.months !== 1) fail.push(`375: popup shows ${narrow.months} months, expected 1`);
  await page.keyboard.press("Escape");

  // ── 7. coarse ──────────────────────────────────────────────────────────────
  await open("dates-calendar", { input: "coarse" });
  const coarse = await page.evaluate(() => {
    const section = document.querySelector('[id="dates-calendar"]');
    const days = [...section.querySelectorAll("[data-date]")].map((d) => d.getBoundingClientRect());
    const nav = [...section.querySelectorAll('button[aria-label$="month"]')].map((b) => b.getBoundingClientRect());
    return {
      dayMin: Math.min(...days.map((r) => Math.min(r.width, r.height))),
      navMin: Math.min(...nav.map((r) => Math.min(r.width, r.height))),
      days: days.length,
    };
  });
  if (!(coarse.days > 100 && coarse.dayMin >= 44 && coarse.navMin >= 44)) fail.push(`coarse: smallest day ${coarse.dayMin}px, month button ${coarse.navMin}px over ${coarse.days} days`);
  await open("dates-daterangepicker", { input: "coarse" });
  const trigger = await card.getByRole("button", { name: /Time range/ }).boundingBox();
  if (!(trigger.height >= 44)) fail.push(`coarse: toolbar trigger ${trigger.height}px tall`);

  await page.evaluate((KEY) => localStorage.removeItem(KEY), KEY);
  await page.setViewportSize({ width: 1280, height: 900 });
  if (fail.length) throw new Error(fail.join("\n"));
  return `dates ok: cell ${harness.h}px; Oct 30 → ${crossed.at}; range ${picked}; en/de → 2026-10-15; popup cell ${popup.cell}px in card, outside clip hit; 375: ${narrow.months} month, no scroll; coarse day ${coarse.dayMin}px`;
}
