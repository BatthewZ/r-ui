// Browser check: the Dashboard, Marketing and Overview pages print as ink on paper
// from a dark theme (the first the showcase lists).
//
// Run it through `bun run browser:check print`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print print-pages)"
//
// For each page, in that dark theme at 1280, with `emulateMedia({ media: "print" })`:
//   1. harness: on screen the canvas is dark, so a white canvas under print is the
//      print palette's doing, not the theme's; and every selector the checks below
//      expect to vanish (3), every table head (4) and tab row (6) matches on screen
//      on some page, so "nothing of it prints" is never a stale selector's silence;
//   2. the canvas computes white, body text near-black (luminance < 0.05), and every
//      visible text element reads >= 4.5:1 on what prints behind it: paper, or a
//      fill that prints (`print-color-adjust: exact`). Disabled and screen-reader
//      text, SVG text and inert placeholders are skipped;
//   3. the shell chrome is gone: every AppShell sidebar, bottom nav and skip link
//      (the showcase's and the Dashboard's own) has no box, and a header left with
//      no heading is gone too; menus, toasts, copy buttons, pagination, a FileUpload
//      drop zone and anything marked `data-print="hide"` do not print;
//   4. every table head is `table-header-group` and not sticky;
//   5. nothing is clipped: no element that clips (overflow other than visible)
//      holds more than its box shows, except a one-line truncation outside a
//      table (it says so with an ellipsis), a form field's own value, a
//      screen-reader-only box, and a table the showcase marks as wider than any
//      page by design (`data-sc-scrolls`; counted in the result); the Dashboard's
//      fixed scroll frame prints in the flow;
//   6. every Accordion / Collapsible panel, closed ones included, has height and
//      visible content (at least one closed panel is measured across the run);
//      only the selected tab of a tab row prints; a VirtualizedTable prints no
//      spacer rows and a note under its rows;
//   7. `page.pdf()` renders each page to a PDF of more than one page.
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const fail = [];
  const runs = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  let closedPanels = 0;
  let virtualTables = 0;
  const dark = await darkTheme(page);
  // 3: what must not print.
  const GONE = [
    ".r-navigation-shell-sidebar",
    ".r-navigation-shell-bottomnav",
    ".r-navigation-shell-skip",
    ".r-overlays-toast-region",
    "button[aria-haspopup='menu']",
    "button[data-state='idle']",
    ".r-form-upload-zone",
    "nav:has(> div > [data-pagination])",
    // What components mark themselves (FormActions, CopyButton, Timeline's "Show more", a FileUpload row's actions).
    "[data-print~='hide']",
  ];
  const HEADER = ".r-navigation-shell-header";
  const TAB_ROWS = ".r-navigation-tabs-underline, .r-navigation-tabs-enclosed";
  /** Matches on screen, per selector, summed over the pages: the positive control for 3, 4 and 6. */
  const onScreen = Object.fromEntries([...GONE, HEADER, "thead", TAB_ROWS].map((sel) => [sel, 0]));

  const measure = () =>
    page.evaluate(({ gone, HEADER, TAB_ROWS }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgba = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
      const lum = ([r, g, b]) => {
        const c = (v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const css = (el) => getComputedStyle(el);
      const boxed = (el) => el.getClientRects().length > 0;
      const name = (el) =>
        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
      const paper = [255, 255, 255];
      // What prints behind an element: the nearest ancestor fill that prints, over paper.
      const backdrop = (el) => {
        const fills = [];
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const s = css(n);
          const bg = rgba(s.backgroundColor);
          if (bg[3] > 0 && s.printColorAdjust === "exact") fills.unshift(bg);
          if (bg[3] === 1 && s.printColorAdjust === "exact") break;
        }
        return fills.reduce((acc, f) => over(f, acc), paper);
      };
      const skipped = (el) => !!el.closest('[aria-hidden="true"], [inert], :disabled, [aria-disabled="true"], .sr-only, svg');
      const faded = (el) => {
        for (let n = el; n; n = n.parentElement) if (Number(css(n).opacity) < 1) return true;
        return false;
      };

      const root = css(document.documentElement);
      const body = css(document.body);
      const out = {
        canvas: rgba(root.backgroundColor),
        bodyLum: lum(rgba(body.color)),
        scheme: root.getPropertyValue("--SCHEME-DARK").trim(),
        lowText: [],
        texts: 0,
        chrome: [],
        heads: [],
        clipped: [],
        tooWide: 0,
        panels: { total: 0, closed: 0, bad: [] },
        tabs: [],
        virtual: [],
        frame: null,
      };

      // 2. Text as printed.
      for (const el of document.body.querySelectorAll("*")) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own || !boxed(el) || skipped(el)) continue;
        const s = css(el);
        if (s.visibility !== "visible" || faded(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        out.texts++;
        const bd = backdrop(el);
        const fg = over(rgba(s.color), bd);
        const cr = ratio(fg, bd);
        if (cr < 4.5) out.lowText.push(`${cr.toFixed(2)}:1 ${name(el)}`);
      }

      // 3. Chrome that must not print.
      for (const sel of gone) for (const el of document.querySelectorAll(sel)) if (boxed(el)) out.chrome.push(`${sel} prints: ${name(el)}`);
      for (const h of document.querySelectorAll(HEADER)) {
        if (!h.querySelector("h1, h2, h3, h4, h5, h6") && boxed(h)) out.chrome.push(`a header with no heading prints: ${name(h)}`);
        for (const c of h.querySelectorAll("button, input, select, textarea")) if (boxed(c)) out.chrome.push(`a header control prints: ${name(c)}`);
      }

      // 4. Table heads.
      for (const t of document.querySelectorAll("thead")) {
        if (!boxed(t)) continue;
        const s = css(t);
        if (s.display !== "table-header-group" || s.position === "sticky") out.heads.push(`${s.display}/${s.position} ${name(t.closest("table"))}`);
      }

      // 5. Clipping.
      for (const el of document.body.querySelectorAll("*")) {
        if (!(el instanceof HTMLElement) || !boxed(el) || el.closest("svg")) continue;
        const s = css(el);
        const clipsX = s.overflowX !== "visible";
        const clipsY = s.overflowY !== "visible";
        if (!clipsX && !clipsY) continue;
        if (el.clientWidth <= 1 || el.clientHeight <= 1) continue; // sr-only
        const overX = clipsX && el.scrollWidth > el.clientWidth + 1;
        const overY = clipsY && el.scrollHeight > el.clientHeight + 1;
        if (!overX && !overY) continue;
        // A field's value scrolls inside the field by design.
        if (el.matches("input, textarea, select")) continue;
        // A one-line truncation is designed and says so with an ellipsis.
        if (!overY && s.textOverflow === "ellipsis" && !el.closest("td, th")) continue;
        // A demo the showcase marks as wider than a phone by design (the hostile
        // 24-column Markdown table): even with every cell wrapped, its table is
        // wider than paper. Counted, so the exemption stays visible.
        const tooWide = [...el.querySelectorAll("[data-sc-scrolls] table")].some((t) => t.getBoundingClientRect().width > el.clientWidth + 1);
        if (!overY && tooWide) {
          out.tooWide++;
          continue;
        }
        out.clipped.push(`${overX ? "x" : ""}${overY ? "y" : ""} ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight} ${name(el)}`);
      }
      const frame = document.querySelector("[data-dashboard-frame]");
      if (frame) out.frame = { position: css(frame).position, overflowY: css(frame).overflowY };

      // 6. Disclosure, tabs, virtual tables.
      for (const p of document.querySelectorAll(".r-disclosure-panel")) {
        if (!boxed(p.parentElement ?? p)) continue;
        out.panels.total++;
        const closed = p.dataset.state === "closed";
        if (closed) out.panels.closed++;
        const clip = p.querySelector(".r-disclosure-clip");
        const h = p.getBoundingClientRect().height;
        if (h < 1 || !clip || css(clip).visibility !== "visible") out.panels.bad.push(`${closed ? "closed" : "open"} panel ${h}px ${name(p)}`);
      }
      for (const list of document.querySelectorAll(TAB_ROWS)) {
        if (!boxed(list)) continue;
        const shown = [...list.querySelectorAll('[role="tab"]')].filter(boxed);
        if (shown.length !== 1 || shown[0].getAttribute("aria-selected") !== "true") out.tabs.push(`${shown.length} tab(s) print in ${name(list)}`);
      }
      for (const t of document.querySelectorAll("table[aria-rowcount]")) {
        const rootEl = t.parentElement;
        if (!boxed(rootEl)) continue;
        const spacers = [...t.querySelectorAll("tbody > tr[aria-hidden]:not([data-table-row])")].filter(boxed).length;
        const note = getComputedStyle(rootEl, "::after").content;
        out.virtual.push({ spacers, note: note === "none" ? "" : note, rows: t.querySelectorAll("tbody > tr[data-table-row]").length });
      }
      return out;
    }, { gone: GONE, HEADER, TAB_ROWS });

  await page.emulateMedia({ media: null });
  for (const p of ["dashboard", "marketing", "overview"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}#/${p}`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, { theme: dark }]);
    await page.reload();
    await waitForShowcase(page);
    await page.waitForTimeout(400);

    // 1. Harness: the screen is dark.
    const screen = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("2d");
      c.fillStyle = getComputedStyle(document.documentElement).backgroundColor;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
      return { rgb: [r, g, b], scheme: getComputedStyle(document.documentElement).getPropertyValue("--SCHEME-DARK").trim() };
    });
    if (screen.scheme !== "1" || Math.max(...screen.rgb) > 80) fail.push(`${p}: harness: ${dark} on screen is not dark (${screen.rgb}, --SCHEME-DARK ${screen.scheme})`);
    const seen = await page.evaluate((selectors) => selectors.map((sel) => document.querySelectorAll(sel).length), Object.keys(onScreen));
    Object.keys(onScreen).forEach((sel, i) => (onScreen[sel] += seen[i]));

    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(200);
    const m = await measure();
    const label = `${p}/print`;
    if (m.canvas.slice(0, 3).some((v) => v < 254)) fail.push(`${label}: the canvas prints rgb(${m.canvas.slice(0, 3)}), not white`);
    if (m.scheme !== "0") fail.push(`${label}: --SCHEME-DARK is ${m.scheme} in print, want 0`);
    if (!(m.bodyLum < 0.05)) fail.push(`${label}: body text luminance ${m.bodyLum.toFixed(3)} is not near-black`);
    if (m.texts < 40) fail.push(`${label}: only ${m.texts} text elements measured`);
    for (const t of m.lowText.slice(0, 10)) fail.push(`${label}: text below 4.5:1 on paper: ${t}`);
    for (const c of m.chrome) fail.push(`${label}: ${c}`);
    for (const h of m.heads) fail.push(`${label}: table head ${h}`);
    for (const c of m.clipped.slice(0, 10)) fail.push(`${label}: clipped (${c})`);
    if (p === "dashboard" && (!m.frame || m.frame.position !== "static" || m.frame.overflowY !== "visible")) {
      fail.push(`${label}: the Dashboard frame does not print in the flow (${JSON.stringify(m.frame)})`);
    }
    for (const b of m.panels.bad) fail.push(`${label}: ${b}`);
    for (const t of m.tabs) fail.push(`${label}: ${t}`);
    for (const v of m.virtual) {
      if (v.spacers > 0) fail.push(`${label}: a VirtualizedTable prints ${v.spacers} spacer row(s)`);
      if (!v.note) fail.push(`${label}: a VirtualizedTable prints no partial-rows note`);
    }
    closedPanels += m.panels.closed;
    virtualTables += m.virtual.length;

    // 7. A real PDF, more than one page long.
    const pdf = await page.pdf({ format: "A4" });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    if (pages < 2) fail.push(`${label}: page.pdf() produced ${pages} page(s)`);
    await page.emulateMedia({ media: null });
    runs.push({ page: p, texts: m.texts, panels: m.panels.total, closed: m.panels.closed, virtual: m.virtual.length, tooWide: m.tooWide, pdfPages: pages, kb: Math.round(pdf.length / 1024) });
  }
  if (closedPanels === 0) fail.push("no closed Accordion / Collapsible panel was measured: the disclosure assertion proved nothing");
  if (virtualTables === 0) fail.push("no VirtualizedTable was measured: the partial-rows assertion proved nothing");
  for (const [sel, n] of Object.entries(onScreen)) {
    if (n === 0) fail.push(`harness: \`${sel}\` matches nothing on screen on any page, so its print assertion proved nothing`);
  }
  for (const e of errors) fail.push(e);

  stopErrors();
  await page.emulateMedia({ media: null });
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await page.setViewportSize({ width: 1280, height: 900 });
  if (fail.length) throw new Error(`print-pages FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(runs)}`);
  return `print-pages OK ${JSON.stringify(runs)}`;
}
