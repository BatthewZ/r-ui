// Browser check: every component state survives forced colors (Windows High Contrast).
//
// Under `forced-colors: active` Chromium paints author fills as Canvas, drops
// box-shadows and gradients, and repaints borders and text in system colours, so a
// state drawn by a wash, a shadow ring or a hue alone disappears. jsdom has no CSS;
// this reads computed styles in a real browser, where they are the FORCED values.
//
// With forced colors emulated (Chromium's default palette), in the default theme and
// the first dark theme the showcase lists, at 1280 wide, it asserts that each audited "on" element differs
// from its "off" sibling in a property that survives forcing:
//   1. checkbox / radio checked vs not: the box's fill; the check mark is drawn in a
//      colour other than its fill;
//   2. switch on vs off: the track's fill, and each thumb differs from its own track
//      (the off thumb used to vanish into a CanvasText track);
//   3. selected segment and selected enclosed tab vs the rest: a system-colour fill,
//      with text in a colour other than that fill;
//   4. underline tab, current nav link, current page: the marker pseudo-element is
//      painted only on the "on" item;
//   5. pressed IconButton and pressed Button: the fill;
//   6. selected table row: a marker on the first cell, absent on other rows;
//   7. invalid vs valid: a thicker edge on a field frame, a checkbox, a switch track
//      and a segmented control (the red colour is gone);
//   8. disabled vs enabled button: opacity (the fade survives);
//   9. accordion expanded vs collapsed: the chevron's rotation;
//  10. meter: the track has an edge (else the fill's length means nothing), and the
//      fill differs from the track;
//  11. skeleton and avatar: each has an edge (both were fills or shadows), the
//      avatar's at --BORDER-WIDTH;
//  12. breadcrumb link vs current crumb: the link is in a different system colour;
//  13. a nav count pill has an edge;
//  14. menu: the item under the pointer is filled, its siblings are not, and its text
//      is not the fill's colour; a destructive item keeps legible text when filled;
//  15. focus is visible: for a sample of controls focused from the keyboard, the
//      control (or the frame that draws its ring) has exactly one solid outline (an
//      inner part's reset outline must not come back as a second ring), and an inset
//      ring is not the colour of the fill it sits on (a ring in Highlight on a
//      Highlight-filled selected tab is invisible);
//  16. progress: a bar's track has an edge (dashed while indeterminate) and the fill
//      differs from it; a ring's arc differs from its track and from Canvas.
// It also asserts that --SCHEME-DARK follows the forced palette (light or dark), not
// the theme, so the series and sequential fills that keep their colour suit the Canvas.
// On the AppShell's rail (900 wide) and bottom nav (375) it also asserts that a rail
// label bubble shown on focus and the count badges opt out of repainting and keep
// their text in a colour other than their fill (text on a kept system-colour fill
// is otherwise plated in Canvas and lost).
// The check fails if any audited element is missing, so a renamed hook cannot pass
// silently.
//
// Run it through `bun run browser:check forced-colors`, or by hand against a running
// showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print forced-colors-states)"
async (page) => {
  const base = page.url().split("#")[0];
  const problems = [];
  let checked = 0;

  const load = async (theme, width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme,
      density: "comfortable",
      input: "fine",
    });
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(".sc-section").first().waitFor();
    await page.waitForTimeout(300);
  };

  // Read before any emulation: under forced colours --SCHEME-DARK follows the forced palette.
  const dark = await darkTheme(page);
  try {
    for (const theme of ["default", dark]) {
      await load(theme, 1280);
      const label = `${theme}@1280`;

      const forced = await page.evaluate(() => matchMedia("(forced-colors: active)").matches);
      if (!forced) {
        problems.push(`${label}: harness: forced colors are not active`);
        continue;
      }
      // The forced palette, not the theme, sets the scheme: series and sequential
      // fills keep their colour, and must take their light values on a light Canvas
      // even in a dark theme (the emulated palette is light; a dark one gives 1).
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ forcedColors: "active", colorScheme });
        const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--SCHEME-DARK").trim());
        const want = colorScheme === "dark" ? "1" : "0";
        if (scheme !== want) problems.push(`${label}: --SCHEME-DARK is ${scheme} under a ${colorScheme} forced palette, expected ${want}`);
        checked++;
      }
      await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });

      const r = await page.evaluate(() => {
        const out = [];
        let n = 0;
        const cs = (el, pseudo) => getComputedStyle(el, pseudo);
        const sec = (id) => document.getElementById(id);
        const need = (what, el) => {
          if (!el) out.push(`missing: ${what}`);
          return el;
        };
        const transparent = (c) => c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
        // A forced fill is Canvas with the author's alpha: on Canvas it shows nothing,
        // so any Canvas-coloured fill counts as no fill at all.
        const probe = document.body.appendChild(document.createElement("i"));
        probe.style.backgroundColor = "Canvas";
        const rgb = (c) => c.match(/[\d.]+/g)?.slice(0, 3).join(",");
        const canvas = rgb(cs(probe).backgroundColor);
        probe.remove();
        const fill = (c) => (transparent(c) || rgb(c) === canvas ? "no fill" : c);
        const differ = (what, a, b, prop, pseudo) => {
          if (!need(`${what} (on)`, a) || !need(`${what} (off)`, b)) return;
          n++;
          const read = (el) => (prop === "backgroundColor" ? fill(cs(el, pseudo)[prop]) : cs(el, pseudo)[prop]);
          const va = read(a);
          const vb = read(b);
          if (va === vb) out.push(`${what}: on and off share ${pseudo ?? ""}${prop} ${va}`);
        };
        const legible = (what, el) => {
          if (!need(what, el)) return;
          n++;
          const s = cs(el);
          if (s.color === s.backgroundColor) out.push(`${what}: text ${s.color} on its own fill`);
        };
        const marker = (what, on, off, pseudo) => {
          if (!need(`${what} (on)`, on) || !need(`${what} (off)`, off)) return;
          n++;
          const painted = (el) => {
            const s = cs(el, pseudo);
            return s.content !== "none" && s.display !== "none" && !transparent(s.backgroundColor);
          };
          if (!painted(on)) out.push(`${what}: the "on" item has no painted ${pseudo} marker`);
          if (painted(off)) out.push(`${what}: the "off" item paints a ${pseudo} marker too`);
        };
        const edged = (what, el, pseudo) => {
          if (!need(what, el)) return;
          n++;
          const s = cs(el, pseudo);
          const border = s.borderTopStyle !== "none" && Number.parseFloat(s.borderTopWidth) > 0;
          const outline = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
          if (!border && !outline) out.push(`${what}: no border or outline (a fill or shadow alone vanishes)`);
        };
        const thicker = (what, on, off) => {
          if (!need(`${what} (invalid)`, on) || !need(`${what} (valid)`, off)) return;
          n++;
          const w = (el) => Number.parseFloat(cs(el).borderTopWidth);
          if (!(w(on) > w(off))) out.push(`${what}: invalid edge ${w(on)}px is not thicker than valid ${w(off)}px`);
        };

        // 1. checkbox and radio
        const cb = sec("form-checkbox");
        differ("checkbox", cb?.querySelector(".r-form-check-input:checked"), cb?.querySelector(".r-form-check-input:not(:checked):not(:indeterminate)"), "backgroundColor");
        const mark = cb?.querySelector(".r-form-check-input:checked:not(:indeterminate) ~ .r-form-check-mark-on");
        if (need("checkbox mark", mark)) {
          n++;
          const box = cb.querySelector(".r-form-check-input:checked:not(:indeterminate)");
          if (cs(mark).color === cs(box).backgroundColor || cs(mark).opacity !== "1")
            out.push(`checkbox mark: ${cs(mark).color} (opacity ${cs(mark).opacity}) on a ${cs(box).backgroundColor} box`);
        }
        const rg = sec("form-radiogroup");
        differ("radio", rg?.querySelector(".r-form-radio-input:checked"), rg?.querySelector(".r-form-radio-input:not(:checked):not(:disabled)"), "backgroundColor");

        // 2. switch
        const sw = sec("form-switch");
        const on = sw?.querySelector(".r-form-switch-track:checked:not(:disabled)");
        const off = sw?.querySelector(".r-form-switch-track:not(:checked):not(:disabled):not([aria-invalid='true'])");
        differ("switch track", on, off, "backgroundColor");
        for (const [name, track] of [["on", on], ["off", off]]) {
          const thumb = track?.parentElement.querySelector(".r-form-switch-thumb");
          if (need(`switch ${name} thumb`, thumb)) {
            n++;
            if (cs(thumb).backgroundColor === cs(track).backgroundColor)
              out.push(`switch ${name}: thumb ${cs(thumb).backgroundColor} is the track's colour`);
          }
        }

        // 3. selected segment, selected enclosed tab
        const sg = sec("form-segmentedcontrol");
        const seg = sg?.querySelector(".r-form-segment[data-selected]:not([data-disabled])");
        differ("segment", seg, seg?.parentElement.querySelector(".r-form-segment:not([data-selected]):not([data-disabled])"), "backgroundColor");
        legible("selected segment", seg);
        const tabs = sec("navigation-tabs");
        const enclosed = [...(tabs?.querySelectorAll('[role="tablist"]') ?? [])].find((l) => !l.querySelector(".r-navigation-tab-underline"));
        const tabOn = enclosed?.querySelector('[aria-selected="true"]');
        differ("enclosed tab", tabOn, enclosed?.querySelector('[aria-selected="false"]'), "backgroundColor");
        legible("selected enclosed tab", tabOn);

        // 4. markers
        marker("underline tab", tabs?.querySelector('.r-navigation-tab-underline[aria-selected="true"]'), tabs?.querySelector('.r-navigation-tab-underline[aria-selected="false"]:not(:disabled)'), "::after");
        const nl = sec("navigation-navlist");
        marker("nav link", nl?.querySelector('.r-navigation-link[aria-current="page"]'), nl?.querySelector(".r-navigation-link:not([aria-current])"), "::before");
        const pg = sec("navigation-pagination");
        marker("pagination page", pg?.querySelector('.r-navigation-pagination-page[aria-current="page"]'), pg?.querySelector(".r-navigation-pagination-page:not([aria-current])"), "::after");
        const shell = sec("navigation-appshell");
        marker("AppShell nav item", shell?.querySelector('.r-navigation-link[aria-current="page"]'), shell?.querySelector(".r-navigation-link:not([aria-current])"), "::before");

        // 5. pressed IconButton
        const ib = sec("primitives-iconbutton");
        differ("pressed IconButton", ib?.querySelector('button[aria-pressed="true"]'), ib?.querySelector('button[aria-pressed="false"]'), "backgroundColor");
        const btn = sec("primitives-button");
        differ("pressed Button", btn?.querySelector('button[aria-pressed="true"]'), btn?.querySelector('button[aria-pressed="false"]'), "backgroundColor");

        // 6. selected table row
        const tb = sec("data-table");
        marker("selected table row", tb?.querySelector("[data-table-row][data-selected] > :first-child"), tb?.querySelector("[data-table-row]:not([data-selected]) > :first-child"), "::before");

        // 7. invalid
        const inp = sec("form-input");
        thicker("field frame", inp?.querySelector(".r-form-frame[data-invalid]"), inp?.querySelector(".r-form-frame:not([data-invalid]):not([data-disabled]):not([data-readonly])"));
        thicker("checkbox", cb?.querySelector('.r-form-check-input[aria-invalid="true"]:not(:checked)'), cb?.querySelector(".r-form-check-input:not([aria-invalid='true']):not(:checked):not(:indeterminate)"));
        thicker("switch", sw?.querySelector('.r-form-switch-track[aria-invalid="true"]:not(:checked)'), off);
        thicker("segmented control", sg?.querySelector(".r-form-segmented[data-invalid]"), sg?.querySelector(".r-form-segmented:not([data-invalid])"));

        // 8. disabled
        const bt = sec("primitives-button");
        differ("disabled button", bt?.querySelector("button:disabled"), bt?.querySelector("button:not(:disabled):not([aria-disabled='true'])"), "opacity");

        // 9. accordion
        const ac = sec("disclosure-accordion");
        const chevron = (expanded) => ac?.querySelector(`button[aria-expanded="${expanded}"]:not(:disabled) svg`);
        differ("accordion chevron", chevron(true), chevron(false), "rotate");

        // 10. meter
        const mt = sec("data-meter");
        const track = mt?.querySelector(".r-data-meter-track");
        edged("meter track", track);
        if (track?.firstElementChild) {
          n++;
          if (cs(track.firstElementChild).backgroundColor === cs(track).backgroundColor) out.push("meter: the fill is the track's colour");
        }

        // 11. skeleton, avatar
        edged("skeleton", sec("primitives-loading")?.querySelector(".r-primitives-skeleton"));
        edged("avatar", sec("primitives-avatar")?.querySelector(".r-primitives-avatar"), "::after");
        // ...drawn at the theme's line weight: a retuned --BORDER-WIDTH moves it.
        const avatar = sec("primitives-avatar")?.querySelector(".r-primitives-avatar");
        if (need("avatar (weight)", avatar)) {
          n++;
          avatar.style.setProperty("--BORDER-WIDTH", "3px");
          const weight = Number.parseFloat(cs(avatar, "::after").borderTopWidth);
          avatar.style.removeProperty("--BORDER-WIDTH");
          if (weight !== 3) out.push(`avatar: its hairline is ${weight}px under --BORDER-WIDTH 3px (not read from the line weight)`);
        }

        // 12. breadcrumbs
        const bc = sec("navigation-breadcrumbs");
        differ("breadcrumb link vs current", bc?.querySelector("a[href]:not([aria-current])"), bc?.querySelector('[aria-current="page"]'), "color");

        // 13. nav count pill
        edged("nav count badge", nl?.querySelector(".r-navigation-link-badge"));

        // 16. progress: a bar's track has an edge (dashed while indeterminate) and its
        // fill differs from it; a ring's arc differs from its track and from Canvas.
        const pb = sec("feedback-progressbar");
        const determinate = pb?.querySelector('[role="progressbar"]:not([data-indeterminate]) .r-feedback-progress-track');
        edged("progress track", determinate);
        if (need("progress fill", determinate?.firstElementChild)) {
          n++;
          if (fill(cs(determinate.firstElementChild).backgroundColor) === fill(cs(determinate).backgroundColor))
            out.push("progress: the fill is the track's colour");
        }
        const sweeping = pb?.querySelector('[role="progressbar"][data-indeterminate] .r-feedback-progress-track');
        edged("indeterminate progress track", sweeping);
        if (sweeping) {
          n++;
          if (cs(sweeping).outlineStyle !== "dashed") out.push(`indeterminate progress track: outline ${cs(sweeping).outlineStyle}, not dashed`);
        }
        const ring = sec("feedback-progressring")?.querySelector('[role="progressbar"]:not([data-indeterminate]) svg');
        const [ringTrack, arc] = ring ? [...ring.querySelectorAll("circle")] : [];
        if (need("progress ring track", ringTrack) && need("progress ring arc", arc)) {
          n++;
          const t = cs(ringTrack).stroke;
          const a = cs(arc).stroke;
          // A wash keeps its alpha under forced-color-adjust: none; the track must be a solid system colour.
          const translucent = (c) => {
            const alpha = c.match(/\/\s*([\d.]+)\)$/) ?? c.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
            return Boolean(alpha && Number(alpha[1]) < 1);
          };
          if (t === a || rgb(a) === canvas || t === "none" || translucent(t)) out.push(`progress ring: arc ${a} on track ${t}`);
        }

        return { out, n };
      });
      checked += r.n;
      for (const p of r.out) problems.push(`${label}: ${p}`);

      // 14. menu highlight: the pointer moves focus, but not :focus-visible.
      const dm = page.locator("#overlays-dropdownmenu");
      await dm.getByRole("button", { name: "Actions", exact: true }).click();
      const menu = page.getByRole("menu");
      await menu.waitFor();
      const items = menu.getByRole("menuitem");
      await items.nth(1).hover();
      await page.waitForTimeout(100);
      const hover = await menu.evaluate((m) => {
        const all = [...m.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
        const hot = document.activeElement;
        const cold = all.find((i) => i !== hot);
        if (!all.includes(hot) || !cold) return { error: "no focused item and sibling" };
        const probe = document.body.appendChild(document.createElement("i"));
        probe.style.backgroundColor = "Canvas";
        const rgb = (c) => c.match(/[\d.]+/g)?.slice(0, 3).join(",");
        const canvas = rgb(getComputedStyle(probe).backgroundColor);
        probe.remove();
        const fill = (c) => (/rgba\([^)]*,\s*0\)$/.test(c) || rgb(c) === canvas ? "no fill" : c);
        const s = getComputedStyle(hot);
        return { hot: fill(s.backgroundColor), cold: fill(getComputedStyle(cold).backgroundColor), color: s.color };
      });
      checked++;
      if (hover.error) problems.push(`${label}: menu: ${hover.error}`);
      else if (hover.hot === hover.cold) problems.push(`${label}: menu: the item under the pointer is not filled (${hover.hot})`);
      else if (hover.color === hover.hot) problems.push(`${label}: menu: highlighted text ${hover.color} on its own fill`);
      const destructive = menu.locator('[role="menuitem"][data-variant="danger"]');
      if ((await destructive.count()) === 0) problems.push(`${label}: menu: missing a destructive item`);
      else {
        await destructive.first().hover();
        await page.waitForTimeout(100);
        const d = await destructive.first().evaluate((el) => {
          const s = getComputedStyle(el);
          const icon = el.querySelector("svg");
          return { bg: s.backgroundColor, color: s.color, icon: icon ? getComputedStyle(icon).color : null };
        });
        checked++;
        if (d.color === d.bg || d.icon === d.bg) problems.push(`${label}: menu: destructive item text ${d.color} / icon ${d.icon} on its ${d.bg} highlight`);
      }
      await page.keyboard.press("Escape");

      // 15. focus is visible. A key press first, so focus() counts as keyboard focus.
      const targets = [
        ["#primitives-button button:not(:disabled)", "button"],
        ['#primitives-iconbutton button[aria-pressed="true"]', "pressed IconButton"],
        ["#form-input input.r-form-input", "input"],
        ["#form-combobox input.r-form-input", "combobox"],
        ["#dates-datepicker input.r-form-input", "date picker"],
        ["#form-checkbox .r-form-check-input:checked", "checkbox"],
        ["#form-switch .r-form-switch-track:checked", "switch"],
        ["#form-segmentedcontrol .r-form-segment[data-selected] input", "selected segment"],
        ['#navigation-tabs [role="tab"][aria-selected="true"]:not(.r-navigation-tab-underline)', "selected enclosed tab"],
        ['#navigation-tabs .r-navigation-tab-underline[aria-selected="true"]', "underline tab"],
        ['#navigation-navlist .r-navigation-link[aria-current="page"]', "current nav link"],
        ['#navigation-pagination .r-navigation-pagination-page[aria-current="page"]', "current page"],
        ["#disclosure-accordion button[aria-expanded]", "accordion header"],
        ["#primitives-link a[href]", "link"],
      ];
      for (const [selector, what] of targets) {
        const el = page.locator(selector).first();
        if ((await el.count()) === 0) {
          problems.push(`${label}: focus: missing ${what} (${selector})`);
          continue;
        }
        await el.scrollIntoViewIfNeeded();
        await page.keyboard.press("Shift");
        await el.focus();
        const f = await el.evaluate((node) => {
          if (!node.matches(":focus-visible")) return { error: "focus() did not match :focus-visible" };
          const rings = [];
          for (let ring = node, depth = 0; ring && depth < 4; ring = ring.parentElement, depth++) {
            const s = getComputedStyle(ring);
            if (s.outlineStyle === "none" || Number.parseFloat(s.outlineWidth) <= 0) continue;
            // A visually hidden input's outline is clipped away with it.
            if (ring.getBoundingClientRect().width <= 1) continue;
            const inset = Number.parseFloat(s.outlineOffset) + Number.parseFloat(s.outlineWidth) <= 0;
            rings.push({ inset, outline: s.outlineColor, fill: s.backgroundColor, style: s.outlineStyle, on: ring.tagName.toLowerCase() });
          }
          if (rings.length === 0) return { error: "no outline on the control or its frame" };
          // The forced `outline-style: solid` revives an outline a part reset with
          // `outline: none`, drawing a second ring inside its frame's.
          if (rings.length > 1) return { error: `${rings.length} rings (${rings.map((r) => r.on).join(" inside ")}), expected one` };
          return rings[0];
        });
        checked++;
        if (f.error) problems.push(`${label}: focus: ${what}: ${f.error}`);
        else if (f.style !== "solid") problems.push(`${label}: focus: ${what}: outline is ${f.style}, not solid`);
        else if (f.inset && f.outline === f.fill) problems.push(`${label}: focus: ${what}: an inset ${f.outline} ring on a ${f.fill} fill`);
        await el.evaluate((node) => node.blur());
      }
    }

    // The AppShell's compact forms: on the rail (900) a label bubble shown on focus
    // and the count badge, in the bottom nav (375) the count badge, all sit on kept
    // system-colour fills.
    for (const [width, form, part] of [
      [900, "rail", ".r-navigation-shell-sidebar"],
      [375, "bottom nav", ".r-navigation-shell-bottomnav"],
    ]) {
      await load("default", width);
      const where = `${form}@${width}`;
      const link = page.locator(`#navigation-appshell ${part} .r-navigation-link:has(.r-navigation-link-badge)`).first();
      if ((await link.count()) === 0) {
        problems.push(`${where}: missing a link with a count badge`);
        continue;
      }
      await link.scrollIntoViewIfNeeded();
      await page.keyboard.press("Shift");
      await link.focus();
      await page.waitForTimeout(100);
      const parts = await link.evaluate((a, rail) => {
        const pick = (el) => {
          const s = getComputedStyle(el);
          return { color: s.color, bg: s.backgroundColor, fca: s.forcedColorAdjust, clip: s.clipPath };
        };
        const found = { badge: pick(a.querySelector(".r-navigation-link-badge")) };
        if (rail) found.label = pick(a.querySelector(".r-navigation-link-label"));
        return found;
      }, form === "rail");
      for (const [what, s] of Object.entries(parts)) {
        checked++;
        if (what === "label" && s.clip !== "none") problems.push(`${where}: the label bubble is not shown on focus (clip-path ${s.clip})`);
        if (s.color === s.bg) problems.push(`${where}: ${what}: text ${s.color} on its own fill`);
        if (s.fca !== "none") problems.push(`${where}: ${what}: text on a kept ${s.bg} fill is plated in Canvas (forced-color-adjust ${s.fca})`);
      }
    }
  } finally {
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference", colorScheme: "light" });
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  if (checked < 60) problems.push(`harness: only ${checked} assertions ran; expected at least 60`);
  if (problems.length) throw new Error(`forced-colors-states: ${problems.length} problem(s)\n${problems.join("\n")}`);
  return `forced colors: ${checked} state assertions across default and ${dark} at 1280, plus the rail at 900 and the bottom nav at 375`;
}
