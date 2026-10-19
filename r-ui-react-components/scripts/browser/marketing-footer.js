// @covers   marketing/Footer
// @sections marketing-footer
// @tier     component
//
// Browser check: Footer, on the Footer section (`#marketing-footer`), opened alone.
//
// Run it through `bun run browser:check marketing-footer`.
//
// Asserts:
//   1. harness: at 1280 the full demo (`[data-sc="footer-full"]`) is a <footer> at least
//      28rem wide (the narrow form's bound, read through a probe) and the narrow demo
//      (`[data-sc="footer-narrow"]`, a 22rem box) is narrower;
//   2. landmarks: the full footer's columns are navigations named "Product", "Resources"
//      and "Company" by their headings, the legal row a navigation named "Legal" (Privacy,
//      Terms, Cookie settings), the social links a list named "Social media" of four links
//      each named (GitHub, LinkedIn, YouTube, RSS feed) with an aria-hidden glyph;
//   3. wide form (full footer, 1280): no disclosure button is displayed, every column's
//      list and links show, and the three columns sit side by side (one top);
//   4. narrow form, by the FOOTER's width at the same 1280 viewport (narrow demo): every
//      column's toggle is displayed with aria-expanded="false", its list is not displayed,
//      the navigation keeps its name (its hidden title still names it), the columns stack;
//      a click on "Product" shows its links and sets aria-expanded, Enter on the focused
//      toggle folds it again;
//   5. the full footer turns narrow at 375 (same demo, the viewport moved its width);
//   6. locale: the Select "Language" picks Deutsch → the copyright line reads
//      "© 2026 Kiln Labs. Alle Rechte vorbehalten.", the legal navigation is named
//      "Rechtliches", the social list "Soziale Medien", a column "Produkt"; العربية → the
//      footer's direction is rtl and the legal navigation is "قانوني";
//   7. coarse + 375: every link and button in the footer's navigations (an opened narrow
//      column's toggle included) is at least --HIT-MIN tall (stacked links a floor apart),
//      social links side by side have centres a floor apart, and a press 1px inside the hit
//      floor's edge (off the drawn box) reaches the link; nothing in the section draws past its demo and the page does not scroll
//      sideways;
//   8. print (emulated): the full footer shows the copyright and the Legal navigation,
//      and no column, newsletter, social link or locale switcher;
//   9. no console or page error.
async (page) => {
  const fail = [];
  const notes = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const FULL = '[data-sc="footer-full"]';
  const NARROW = '[data-sc="footer-narrow"]';

  const load = async (width, view = {}) => {
    await openSection(page, "marketing-footer", { width, view: { theme: "default", density: "comfortable", input: "fine", ...view } });
    await page.locator(FULL).waitFor();
    await page.locator(FULL).scrollIntoViewIfNeeded();
  };

  /** A length token resolved in px through a probe (unregistered tokens read back as written). */
  const px = (expr) =>
    page.evaluate((expr) => {
      const probe = document.createElement("div");
      probe.style.inlineSize = expr;
      document.body.append(probe);
      const value = probe.getBoundingClientRect().width;
      probe.remove();
      return value;
    }, expr);

  /** Per column: displayed toggle, displayed list, aria-expanded, top edge. */
  const columns = (scope) =>
    page.evaluate((scope) => {
      const root = document.querySelector(scope);
      return [...root.querySelectorAll("nav[aria-labelledby]")].map((nav) => {
        const toggle = nav.querySelector("button[aria-expanded]");
        const list = nav.querySelector("ul");
        return {
          toggleShown: toggle ? getComputedStyle(toggle).display !== "none" : false,
          expanded: toggle?.getAttribute("aria-expanded"),
          listShown: getComputedStyle(list).display !== "none",
          linksShown: [...list.querySelectorAll("a")].filter((a) => a.getClientRects().length > 0).length,
          links: list.querySelectorAll("a").length,
          top: Math.round(nav.getBoundingClientRect().top),
        };
      });
    }, scope);

  try {
    // ── 1–3: wide form, landmarks ─────────────────────────────────────────────
    await load(1280);
    const bound = await px("28rem");
    const widths = await page.evaluate(
      ([full, narrow]) => ({
        tag: document.querySelector(`${full} footer`)?.tagName ?? null,
        full: document.querySelector(`${full} footer`)?.getBoundingClientRect().width ?? 0,
        narrow: document.querySelector(narrow).firstElementChild.getBoundingClientRect().width,
      }),
      [FULL, NARROW],
    );
    if (widths.tag !== "FOOTER") fail.push(`harness: the full demo renders ${widths.tag}, not a <footer>`);
    if (!(widths.full >= bound) || !(widths.narrow < bound)) {
      fail.push(`harness: full ${widths.full}px and narrow ${widths.narrow}px against the 28rem bound ${bound}px`);
    }

    const full = page.locator(FULL);
    for (const name of ["Product", "Resources", "Company"]) {
      if ((await full.getByRole("navigation", { name, exact: true }).count()) !== 1) fail.push(`landmarks: no navigation named "${name}"`);
    }
    const legal = full.getByRole("navigation", { name: "Legal", exact: true });
    const legalLinks = await legal.getByRole("link").allTextContents();
    if (legalLinks.join("|") !== "Privacy|Terms|Cookie settings") fail.push(`landmarks: the Legal navigation holds ${JSON.stringify(legalLinks)}`);
    const social = full.getByRole("list", { name: "Social media", exact: true });
    for (const name of ["GitHub", "LinkedIn", "YouTube", "RSS feed"]) {
      const link = social.getByRole("link", { name, exact: true });
      if ((await link.count()) !== 1) {
        fail.push(`landmarks: no social link named "${name}"`);
        continue;
      }
      const glyph = await link.evaluate((a) => ({ hidden: a.querySelector("svg")?.closest("[aria-hidden]") !== null, text: a.textContent.trim() }));
      if (!glyph.hidden || glyph.text !== "") fail.push(`landmarks: "${name}" glyph hidden=${glyph.hidden}, text "${glyph.text}"`);
    }

    const wide = await columns(FULL);
    if (wide.length !== 3) fail.push(`wide: harness: ${wide.length} columns, the demo writes 3`);
    if (wide.some((c) => c.toggleShown)) fail.push("wide: a disclosure button is displayed in the wide form");
    if (wide.some((c) => !c.listShown || c.linksShown !== c.links || c.links === 0)) fail.push(`wide: hidden lists or links ${JSON.stringify(wide)}`);
    if (new Set(wide.map((c) => c.top)).size !== 1) fail.push(`wide: the columns do not sit side by side (tops ${wide.map((c) => c.top)})`);

    // ── 4: narrow form by the footer's own width ──────────────────────────────
    const narrowBox = page.locator(NARROW);
    await narrowBox.scrollIntoViewIfNeeded();
    const narrow = await columns(NARROW);
    if (narrow.length !== 3) fail.push(`narrow: harness: ${narrow.length} columns`);
    if (narrow.some((c) => !c.toggleShown || c.expanded !== "false" || c.listShown)) fail.push(`narrow: not folded ${JSON.stringify(narrow)}`);
    if (!narrow.every((c, i) => i === 0 || c.top > narrow[i - 1].top)) fail.push(`narrow: the columns do not stack (tops ${narrow.map((c) => c.top)})`);
    if ((await narrowBox.getByRole("navigation", { name: "Product", exact: true }).count()) !== 1) {
      fail.push("narrow: the folded column's navigation lost its name");
    }
    const productToggle = narrowBox.getByRole("button", { name: "Product", exact: true });
    await productToggle.click();
    const opened = (await columns(NARROW))[0];
    if (opened.expanded !== "true" || !opened.listShown || opened.linksShown !== opened.links) fail.push(`narrow: a click does not open Product ${JSON.stringify(opened)}`);
    await productToggle.focus();
    await page.keyboard.press("Enter");
    const closed = (await columns(NARROW))[0];
    if (closed.expanded !== "false" || closed.listShown) fail.push(`narrow: Enter does not fold Product ${JSON.stringify(closed)}`);

    // ── 6: locale through the provider ────────────────────────────────────────
    await full.scrollIntoViewIfNeeded();
    const copyright = () => full.locator("footer p").filter({ hasText: "©" }).first().textContent();
    if ((await copyright()) !== "© 2026 Kiln Labs") fail.push(`locale: harness: the English line reads "${await copyright()}"`);
    await full.getByRole("combobox", { name: "Language" }).selectOption("de");
    if ((await copyright()) !== "© 2026 Kiln Labs. Alle Rechte vorbehalten.") fail.push(`locale: German copyright reads "${await copyright()}"`);
    if ((await full.getByRole("navigation", { name: "Rechtliches", exact: true }).count()) !== 1) fail.push("locale: no Legal navigation named Rechtliches");
    if ((await full.getByRole("list", { name: "Soziale Medien", exact: true }).count()) !== 1) fail.push("locale: no social list named Soziale Medien");
    if ((await full.getByRole("navigation", { name: "Produkt", exact: true }).count()) !== 1) fail.push("locale: no column named Produkt");
    await full.getByRole("combobox", { name: "Sprache" }).selectOption("ar");
    const arabic = await full.locator("footer").evaluate((el) => getComputedStyle(el).direction);
    if (arabic !== "rtl") fail.push(`locale: Arabic footer direction is ${arabic}`);
    if ((await full.getByRole("navigation", { name: "قانوني", exact: true }).count()) !== 1) fail.push("locale: no Legal navigation named قانوني");

    // ── 5, 7: 375 + coarse ────────────────────────────────────────────────────
    await load(375, { input: "coarse" });
    const floor = await px("var(--HIT-MIN)");
    if (floor < 40) fail.push(`coarse: harness: --HIT-MIN resolves to ${floor}px`);
    const small = await columns(FULL);
    if (small.some((c) => !c.toggleShown || c.listShown)) fail.push(`375: the full footer did not fold ${JSON.stringify(small)}`);
    await full.getByRole("button", { name: "Product", exact: true }).click();
    const sizes = await page.evaluate((FULL) => {
      const root = document.querySelector(FULL);
      const heights = [...root.querySelectorAll("nav a, nav button[aria-expanded]")]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => ({ text: el.textContent.trim(), h: el.getBoundingClientRect().height }));
      const social = [...root.querySelectorAll('[aria-label="Social media"] a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
      });
      return { heights, social };
    }, FULL);
    if (sizes.heights.length < 8) fail.push(`coarse: harness: ${sizes.heights.length} visible links and toggles`);
    const short = sizes.heights.filter((s) => s.h < floor - 0.5);
    if (short.length) fail.push(`coarse: shorter than ${floor}px: ${short.map((s) => `${s.text} ${s.h}`).join(", ")}`);
    if (sizes.social.length !== 4) fail.push(`coarse: harness: ${sizes.social.length} social links`);
    for (let i = 1; i < sizes.social.length; i++) {
      const a = sizes.social[i - 1];
      const b = sizes.social[i];
      if (a.cy === b.cy && Math.abs(b.cx - a.cx) < floor - 0.5) fail.push(`coarse: social links ${i - 1}/${i} centres ${Math.abs(b.cx - a.cx)}px apart`);
    }
    const reach = await page.evaluate(
      ([FULL, floor]) => {
        const link = document.querySelector(`${FULL} [aria-label="Social media"] a`);
        link.scrollIntoView({ block: "center" });
        const r = link.getBoundingClientRect();
        const y = r.top + r.height / 2 - (floor / 2 - 1);
        return { drawnTop: r.top, y, hit: link.contains(document.elementFromPoint(r.left + r.width / 2, y)) };
      },
      [FULL, floor],
    );
    if (!(reach.y < reach.drawnTop)) fail.push("coarse: harness: the probe point is not outside the drawn social link");
    if (!reach.hit) fail.push("coarse: a press inside the hit floor, off the drawn social link, misses it");
    const spill = await page.evaluate(() => {
      const html = document.documentElement;
      const section = document.getElementById("marketing-footer");
      const out = [];
      for (const demo of section.querySelectorAll("[data-sc^='footer-']")) {
        const box = demo.getBoundingClientRect();
        for (const el of demo.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5)) out.push(`${demo.dataset.sc} <${el.tagName.toLowerCase()}>`);
        }
      }
      return { scroll: html.scrollWidth, client: html.clientWidth, out: out.slice(0, 6), demos: section.querySelectorAll("[data-sc^='footer-']").length };
    });
    if (spill.demos !== 5) fail.push(`375: harness: ${spill.demos} footer demos`);
    if (spill.scroll > spill.client) fail.push(`375: the page scrolls sideways (${spill.scroll} > ${spill.client})`);
    if (spill.out.length) fail.push(`375: drawn past its demo: ${spill.out.join(", ")}`);

    // ── 8: print ──────────────────────────────────────────────────────────────
    await load(1280);
    await page.emulateMedia({ media: "print" });
    const printed = await page.evaluate((FULL) => {
      const root = document.querySelector(`${FULL} footer`);
      const shown = (el) => el !== null && el.getClientRects().length > 0;
      return {
        copyright: shown([...root.querySelectorAll("p")].find((p) => p.textContent.startsWith("©")) ?? null),
        legal: shown(root.querySelector('nav[aria-label="Legal"]')),
        columns: [...root.querySelectorAll("nav[aria-labelledby]")].filter(shown).length,
        social: shown(root.querySelector('[aria-label="Social media"]')),
        locale: shown(root.querySelector("select")),
        newsletter: shown(root.querySelector("form")),
      };
    }, FULL);
    await page.emulateMedia({ media: null });
    if (!printed.copyright || !printed.legal) fail.push(`print: the legal row is missing ${JSON.stringify(printed)}`);
    if (printed.columns || printed.social || printed.locale || printed.newsletter) fail.push(`print: more than the legal row prints ${JSON.stringify(printed)}`);
    notes.push(`hit floor ${floor}px`);
  } finally {
    stopErrors();
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-footer FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return `marketing-footer OK (named column, legal and social landmarks; wide side by side, narrow by the footer's own width folds into an accordion (click and Enter); locale via the provider in German and Arabic; coarse floors and no spill at 375; print keeps the legal row only; ${notes.join(", ")})`;
}
