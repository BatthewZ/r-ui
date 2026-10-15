// Browser check: Markdown with hostile input, in a real browser.
//
// Run it through `bun run browser:check content-markdown`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print content-markdown)"
//
// On the Overview's Markdown section (release notes + a hostile document),
// asserts:
//   1. no href or src anywhere in the page body uses a script-capable scheme
//      (javascript:, vbscript:, data: other than an image), the hostile links
//      still show their words, and a safe link in the same paragraph is a link
//      (positive control);
//   2. raw `<script>` / `<img onerror>` render as visible text: no such element
//      in the section, no dialog fires, and the tracking pixel is never requested;
//   3. sizing: Markdown paragraphs take the prose scale (--ProseText-2) while its
//      CodeBlock keeps UI text (--BodyText-2) and none of the prose region's own
//      `pre` box (padding, border), and its table rows are --ROW-H;
//   4. at 375px, comfortable + coarse and compact + fine: the page never scrolls
//      sideways and nothing in the section paints past it unless it sits in a
//      scroller (a `hidden` clip loses content, so it is no excuse) (deep quotes and lists, an unbroken word, a 24-column table, a
//      400-character code line).
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const problems = [];
  const notes = {};
  let dialogs = 0;
  const onDialog = (d) => {
    dialogs += 1;
    void d.dismiss();
  };
  const pixel = [];
  const onRequest = (req) => {
    if (/evil\.example/.test(req.url())) pixel.push(req.url());
  };
  page.on("dialog", onDialog);
  page.on("request", onRequest);

  const open = async (view, width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/content-markdown`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, view]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-testid="markdown-hostile"]').waitFor();
    await page.waitForTimeout(300);
  };

  try {
    // ── 1–3 at desktop width ────────────────────────────────────────────
    await open({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const m = await page.evaluate(() => {
      // Characters a browser ignores in a scheme (controls, spaces, zero-width marks), by code point.
      const ignored = (n) => n <= 0x20 || (n >= 0x7f && n <= 0xa0) || (n >= 0x200b && n <= 0x200d) || n === 0xfeff;
      const strip = (u) => [...u].filter((c) => !ignored(c.codePointAt(0))).join("").toLowerCase();
      const bad = [];
      for (const el of document.body.querySelectorAll("[href], [src]")) {
        for (const attr of ["href", "src"]) {
          const v = el.getAttribute(attr);
          if (v === null) continue;
          const s = strip(v);
          if (/^(?:javascript|vbscript):/.test(s) || (/^data:/.test(s) && !/^data:image\/(?:png|jpeg|jpg|gif|webp|avif)[;,]/.test(s))) bad.push(`${el.tagName.toLowerCase()} ${attr}="${v.slice(0, 40)}"`);
        }
      }
      const hostile = document.querySelector('[data-testid="markdown-hostile"]');
      const visible = (needle) =>
        [...hostile.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")].some((el) => el.textContent.includes(needle) && el.getBoundingClientRect().height > 0);
      const links = [...hostile.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      const tokenPx = (name) => {
        const probe = document.createElement("div");
        probe.style.fontSize = `var(${name})`;
        probe.style.blockSize = `var(${name})`;
        hostile.append(probe);
        const v = Number.parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        return v;
      };
      const rowH = (() => {
        const probe = document.createElement("div");
        probe.style.blockSize = "var(--ROW-H)";
        hostile.append(probe);
        const v = probe.getBoundingClientRect().height;
        probe.remove();
        return v;
      })();
      const notes = document.querySelector("#content-markdown .r-content-md");
      const para = notes.querySelector(":scope > p");
      const pre = notes.querySelector("pre");
      const row = notes.querySelector("tbody tr");
      return {
        bad,
        links,
        scriptText: visible("<script>alert(1)</script>"),
        imgText: visible('<img src=x onerror="alert(2)">'),
        hostileWords: visible("a javascript: link"),
        elements: hostile.querySelectorAll("script, iframe, img").length,
        paraPx: Number.parseFloat(getComputedStyle(para).fontSize),
        prose2: tokenPx("--ProseText-2"),
        prePx: Number.parseFloat(getComputedStyle(pre).fontSize),
        preBox: `${getComputedStyle(pre).paddingInlineStart} ${getComputedStyle(pre).borderTopWidth}`,
        body2: tokenPx("--BodyText-2"),
        rowPx: row.getBoundingClientRect().height,
        rowH,
      };
    });
    for (const b of m.bad) problems.push(`scheme: ${b}`);
    if (!m.links.includes("https://example.com")) problems.push(`scheme: harness: the safe link next to the hostile ones is missing (${m.links.join(", ")})`);
    if (!m.hostileWords) problems.push("scheme: a refused link lost its words");
    if (!m.scriptText || !m.imgText) problems.push(`raw html: not shown as text (script ${m.scriptText}, img ${m.imgText})`);
    if (m.elements) problems.push(`raw html: ${m.elements} script/iframe/img element(s) in the hostile document`);
    if (Math.abs(m.paraPx - m.prose2) > 0.5) problems.push(`sizing: a Markdown paragraph is ${m.paraPx}px, --ProseText-2 is ${m.prose2}px`);
    if (Math.abs(m.prePx - m.body2) > 0.5 || Math.abs(m.prose2 - m.body2) < 0.5) problems.push(`sizing: its CodeBlock text is ${m.prePx}px, --BodyText-2 is ${m.body2}px (prose ${m.prose2}px)`);
    if (m.preBox !== "0px 0px") problems.push(`sizing: its CodeBlock <pre> took the prose pre box (padding-inline-start, border: ${m.preBox})`);
    if (Math.abs(m.rowPx - m.rowH) > 0.5) problems.push(`sizing: its table row is ${m.rowPx}px, --ROW-H is ${m.rowH}px`);
    notes.desktop = { paraPx: m.paraPx, prePx: m.prePx, rowPx: m.rowPx };

    // ── 4. Narrow ───────────────────────────────────────────────────────
    for (const view of [
      { theme: "default", density: "comfortable", input: "coarse" },
      { theme: "nightfall", density: "compact", input: "fine" },
    ]) {
      await open(view, 375);
      const n = await page.evaluate(() => {
        const section = document.getElementById("content-markdown");
        const sec = section.getBoundingClientRect();
        const out = [];
        for (const el of section.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || (r.right <= sec.right + 0.5 && r.left >= sec.left - 0.5)) continue;
          // Only a scroller INSIDE the Markdown (a table, a code block) excuses it:
          // the showcase's own demo frame scrolling would hide a spill, not fix it.
          const root = el.closest(".r-content-md") ?? section;
          let clipped = false;
          for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
            if (/^(?:auto|scroll)$/.test(getComputedStyle(p).overflowX)) clipped = true;
          }
          if (!clipped) out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(sec.left)}–${Math.round(sec.right)}`);
        }
        return { out: out.slice(0, 5), count: out.length, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const label = `${view.theme}/${view.density}/${view.input}@375`;
      if (n.page > 0) problems.push(`${label}: the page scrolls sideways by ${n.page}px`);
      for (const o of n.out) problems.push(`${label}: spills: ${o}`);
      if (n.count > n.out.length) problems.push(`${label}: …and ${n.count - n.out.length} more`);
    }
    if (dialogs) problems.push(`raw html: ${dialogs} dialog(s) fired`);
    if (pixel.length) problems.push(`raw html: the tracking pixel was requested: ${pixel[0]}`);
    notes.dialogs = dialogs;
  } finally {
    page.off("dialog", onDialog);
    page.off("request", onRequest);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
  }

  if (problems.length) throw new Error(`content-markdown FAILED (${problems.length}):\n  ${problems.join("\n  ")}\n${JSON.stringify(notes)}`);
  return `content-markdown OK ${JSON.stringify(notes)}`;
}
