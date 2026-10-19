// @covers   marketing/Pricing, marketing/PricingTable, marketing/Testimonial
// @sections marketing-pricing marketing-testimonial
// @tier     component
//
// Browser check: the Pricing section's plan cards and billing toggle (`[data-sc^="pricing-"]`),
// its PricingTable comparison (`[data-sc="pricing-compare"]`, and the RTL twin
// `[data-sc="pricing-rtl"]`), and the Testimonial section (`[data-sc^="testimonial-"]`), each
// opened alone. The three parts run one after another, each from its own loads; a part that
// fails does not stop the next.
//
// Run it through `bun run browser:check marketing-pricing`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print marketing-pricing)"
//
// Asserts, at comfortable + fine unless said otherwise.
//
// Plans (Pricing):
//   1. harness: the three-plan demo lists Starter, Team, Business, and Team's price reads what
//      Intl formats for 12 USD in the page's own locale (no zero cents);
//   2. the toggle: a press on "Annual" moves Team to the Intl format of 10 and Business to 20,
//      writes Team's yearly bill, and the demo's own state says "annual"; the polite live
//      region (aria-live polite through role=status) changes exactly once, to a message that
//      names every plan; ArrowLeft on the focused radio goes back to monthly with exactly one
//      more change;
//   3. the saving describes the toggle (aria-describedby resolves to "Save");
//   4. the highlighted plan without colour: its card's border is twice `--BORDER-WIDTH`
//      (measured by a probe) and every other card's is once, and it alone holds the words
//      "Most popular"; under emulated forced colours the doubled edge survives;
//   5. the cards share their rows: at 1280 the three cards sit side by side and, with the
//      first card's description made three lines longer, their price rows and their action
//      rows still start at the same height (±1px);
//   6. at coarse input both toggle segments answer presses across their 44px frame (the
//      hit area over its padding) and every action button is ≥ 44px tall;
//   7. at 375 + coarse: the plans stack in one column, no card or plan list reaches past its
//      demo;
//   8. no console or page error.
//
// Compare (PricingTable):
//   1. harness: the table is named "Compare plans", has three groups (row groups) and is its
//      own vertical scroller (the demo caps it at eight rows);
//   2. sticky head: scrolled down inside its frame, the head's top stays on the frame's top
//      (±1px) and a point in the head, and the head's corner over the pinned column, hit-test
//      to the head, not a body row scrolled under it;
//   3. at 375: the table is wider than its frame and scrolls sideways inside it while the page
//      does not; scrolled to its end, the feature row headers in view and the corner stay on
//      the frame's inline-start edge (±1px), and the row headers hit-test to themselves;
//   4. RTL at 375: the same, mirrored: the pinned column holds the frame's right edge;
//   5. explanations by keyboard: Tab, from the control before the table, reaches the dotted
//      "Channels" name; its tooltip shows (role tooltip, in the top layer) and describes the
//      button; Escape closes it with focus kept; Tab moves on to the next explained name and
//      its tooltip;
//   6. by mouse: resting on "Single sign-on" opens its tooltip (within 1.5s); a press on
//      "Audit log" opens its own at once (read within 150ms, before the 400ms hover delay could);
//   7. no console or page error.
//
// Testimonials (Testimonial):
//   1. semantics: every testimonial is a figure holding exactly one blockquote and one
//      figcaption with a name, the quote's text not in the caption and no <cite> naming the
//      person; in the accessibility tree Sofia Marchetti's and Amara Nwosu's are figures named
//      by their captions; the cited card has a <cite> with the work ("Case study, 2026") and
//      its blockquote's `cite` URL; its rating is an image named "Rated 4.5 out of 5";
//   2. quotation marks: the first paragraph opens with `open-quote` and the last closes with
//      `close-quote`, under `quotes: auto` (the language's own marks);
//   3. the grid: three cards in one row at 1280, equally tall, their captions' bottoms level
//      (±1px), and their avatars `--CONTROL-H` tall;
//   4. the carousel holds five testimonials, each filling its slide's height;
//   5. at 375 + coarse: avatars in cards are at least 44px (the coarse `--CONTROL-H`), compact ones
//      `--ICON`; no figure reaches past its demo, no text past its figure (the unbroken German
//      word breaks);
//   6. no console or page error (the broken photo falls back to initials silently).
async (page) => {
  /** Pricing's plan cards and billing toggle. */
  const planCards = async () => {
    const problems = [];
    const summary = {};
    const { errors } = collectErrors(page);

    const load = async (view, width = 1280) => {
      await openSection(page, "marketing-pricing", { width, view });
      await page.locator('[data-sc="pricing-three"]').waitFor();
    };
    const three = page.locator('[data-sc="pricing-three"]');
    const cardOf = (name) => three.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    const priceOf = (name) => cardOf(name).locator("[data-price] .text-display-3").innerText();
    const usd = (n) => page.evaluate((n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n), n);
    const borderUnit = () =>
      page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;inline-size:var(--BORDER-WIDTH)";
        document.body.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      });
    const edges = () =>
      three.locator('ul[role="list"] > li > [data-print]').evaluateAll((cards) =>
        cards.map((card) => ({
          name: card.querySelector("h1,h2,h3,h4,h5,h6")?.textContent,
          border: Number.parseFloat(getComputedStyle(card).borderTopWidth),
          highlighted: card.hasAttribute("data-highlighted"),
          popular: card.textContent.includes("Most popular"),
        })),
      );

    try {
      await load({ theme: "default", density: "comfortable", input: "fine" });

      // 1. Harness.
      const names = await three.getByRole("list", { name: "Plans" }).getByRole("heading").allInnerTexts();
      if (names.join("|") !== "Starter|Team|Business") problems.push(`harness: the demo lists ${JSON.stringify(names)}`);
      const twelve = await usd(12);
      if ((await priceOf("Team")) !== twelve) problems.push(`harness: Team reads ${await priceOf("Team")}, Intl formats ${twelve}`);

      // 2. The toggle and its one announcement per change.
      const status = three.locator('[role="status"]');
      if ((await status.count()) !== 1) problems.push(`toggle: harness: ${await status.count()} live regions in the demo, expected 1`);
      await status.evaluate((el) => {
        window.__pricingSpoken = [];
        let last = el.textContent;
        new window.MutationObserver(() => {
          if (el.textContent && el.textContent !== last) window.__pricingSpoken.push(el.textContent);
          last = el.textContent;
        }).observe(el, { childList: true, characterData: true, subtree: true });
      });
      const politeness = await status.evaluate((el) => el.getAttribute("aria-live") ?? (el.getAttribute("role") === "status" ? "polite" : "off"));
      if (politeness !== "polite") problems.push(`toggle: the live region is ${politeness}, expected polite`);
      await three.getByText("Annual", { exact: true }).click();
      await page.waitForTimeout(400);
      const ten = await usd(10);
      const twenty = await usd(20);
      if ((await priceOf("Team")) !== ten || (await priceOf("Business")) !== twenty) problems.push(`toggle: annual prices are ${await priceOf("Team")} / ${await priceOf("Business")}, expected ${ten} / ${twenty}`);
      if (!(await cardOf("Team").getByText(/billed yearly/).isVisible())) problems.push("toggle: Team shows no yearly bill under annual billing");
      if ((await three.locator('[data-sc="pricing-billing"]').innerText()) !== "annual") problems.push("toggle: the demo's own state did not follow");
      let spoken = await page.evaluate(() => window.__pricingSpoken);
      if (spoken.length !== 1) problems.push(`toggle: the live region changed ${spoken.length} times for one press: ${JSON.stringify(spoken)}`);
      else if (!["Starter", "Team", "Business"].every((n) => spoken[0].includes(n)) || !spoken[0].includes(ten)) problems.push(`toggle: the announcement "${spoken[0]}" does not name every plan's new price`);
      await three.getByRole("radio", { name: "Annual" }).focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(400);
      if ((await priceOf("Team")) !== twelve) problems.push("toggle: ArrowLeft did not go back to monthly");
      spoken = await page.evaluate(() => window.__pricingSpoken);
      if (spoken.length !== 2) problems.push(`toggle: after a second change the region changed ${spoken.length} times in all, expected 2`);
      summary.spoken = spoken.length;

      // 3. The saving describes the toggle.
      const described = await three.getByRole("radiogroup", { name: "Billing period" }).evaluate((el) =>
        (el.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" "),
      );
      if (!/Save/.test(described)) problems.push(`saving: the toggle is described by "${described}"`);

      // 4. The highlighted plan, without colour.
      const unit = await borderUnit();
      const check = (list, where) => {
        if (list.length !== 3) return problems.push(`highlight ${where}: harness: ${list.length} cards measured`);
        for (const c of list) {
          const want = c.highlighted ? unit * 2 : unit;
          if (Math.abs(c.border - want) > 0.5) problems.push(`highlight ${where}: ${c.name}'s edge is ${c.border}px, expected ${want}px`);
          if (c.popular !== (c.name === "Team")) problems.push(`highlight ${where}: ${c.name} ${c.popular ? "holds" : "lacks"} "Most popular"`);
        }
        if (list.filter((c) => c.highlighted).map((c) => c.name).join() !== "Team") problems.push(`highlight ${where}: the highlighted card is not Team alone`);
      };
      check(await edges(), "");
      await page.emulateMedia({ forcedColors: "active" });
      check(await edges(), "(forced colours)");
      await page.emulateMedia({ forcedColors: "none" });
      summary.edge = `${unit}px / ${unit * 2}px`;

      // 5. Rows shared across the cards. The demo's cards hold parts of equal height, which
      // would line up without shared rows too: the first card's description is made three
      // lines longer first, so only rows shared across the row can keep the others level.
      await three.locator('ul[role="list"] > li > [data-print]').first().evaluate((card) => {
        const description = card.children[1];
        for (let i = 0; i < 3; i++) description.append(document.createElement("br"), "One more line.");
      });
      const rows = await three.locator('ul[role="list"] > li > [data-print]').evaluateAll((cards) =>
        cards.map((card) => {
          const parts = [...card.children].map((p) => p.getBoundingClientRect());
          return { left: card.getBoundingClientRect().left, price: parts[2]?.top, action: parts[3]?.top };
        }),
      );
      if (new Set(rows.map((r) => Math.round(r.left))).size !== 3) problems.push(`rows: at 1280 the cards are not side by side: ${JSON.stringify(rows)}`);
      for (const key of ["price", "action"]) {
        const tops = rows.map((r) => r[key]);
        if (tops.some((t) => t === undefined) || Math.max(...tops) - Math.min(...tops) > 1) problems.push(`rows: the ${key} rows start at ${tops.join(", ")}`);
      }

      // 6. Coarse sizes.
      await load({ theme: "default", density: "comfortable", input: "coarse" });
      // A segment is drawn inside its frame's padding; its target is the hit area, which must
      // answer a press 1px inside the frame's top and bottom edges at the segment's centre.
      const heights = await three.evaluate((root) => {
        const frame = root.querySelector('[role="radiogroup"]');
        const f = frame.getBoundingClientRect();
        const labels = [...frame.querySelectorAll("label")];
        return {
          segments: labels.map((l) => {
            const r = l.getBoundingClientRect();
            const x = r.left + r.width / 2;
            return [f.top + 1, f.bottom - 1].every((y) => l.contains(document.elementFromPoint(x, y))) ? f.height : 0;
          }),
          actions: [...root.querySelectorAll('ul[role="list"] button')].map((b) => b.getBoundingClientRect().height),
        };
      });
      if (heights.segments.length !== 2 || heights.actions.length !== 3) problems.push(`coarse: harness: ${JSON.stringify(heights)}`);
      for (const [kind, list] of Object.entries(heights)) {
        if (list.some((h) => h < 44 - 0.5)) problems.push(`coarse: ${kind} targets ${list.join(", ")} tall (0: a press at the frame's edge misses the segment), the floor is 44`);
      }

      // 7. Narrow.
      await load({ theme: "default", density: "comfortable", input: "coarse" }, 375);
      const narrow = await page.evaluate(() => {
        const demos = [...document.querySelectorAll('[data-sc^="pricing-"]')];
        const spill = [];
        for (const demo of demos) {
          const d = demo.getBoundingClientRect();
          for (const el of demo.querySelectorAll('ul[role="list"], ul[role="list"] > li > *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.left < d.left - 1 || r.right > d.right + 1)) spill.push(`${demo.dataset.sc}: ${el.tagName} ${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(d.left)}..${Math.round(d.right)}`);
          }
        }
        // The plan list is the first list; each card holds its own feature list, whose items sit indented.
        const plans = document.querySelector('[data-sc="pricing-three"] ul[role="list"]');
        const cards = [...plans.children].map((li) => Math.round(li.getBoundingClientRect().left));
        return { demos: demos.length, spill, cards: cards.length, columns: new Set(cards).size };
      });
      if (narrow.demos < 5) problems.push(`375: harness: ${narrow.demos} pricing demos found`);
      if (narrow.cards !== 3) problems.push(`375: harness: ${narrow.cards} plan cards, the demo writes 3`);
      if (narrow.columns !== 1) problems.push(`375: the plans are in ${narrow.columns} columns, expected one`);
      if (narrow.spill.length) problems.push(`375: spills: ${narrow.spill.slice(0, 5).join(" | ")}`);

      if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);
    } finally {
      await page.emulateMedia({ forcedColors: "none" }).catch(() => {});
    }

    if (problems.length) throw new Error(`plans:\n- ${problems.join("\n- ")}`);
    return `plans: one announcement per change (${summary.spoken} for two), edges ${summary.edge}, rows aligned, coarse floors, 375 stacked`;
  };

  /** PricingTable: the pinned head and column, and the explanations. */
  const comparison = async () => {
    const problems = [];
    const summary = {};
    const { errors } = collectErrors(page);

    const load = async (view, width = 1280) => {
      await openSection(page, "marketing-pricing", { width, view });
      await page.locator('[data-sc="pricing-compare"] table').waitFor();
    };
    const tableIn = (demo) => page.locator(`[data-sc="${demo}"] table`).first();
    const tip = () =>
      page.evaluate(() => {
        const el = [...document.querySelectorAll('[role="tooltip"]')].find((t) => !t.inert && t.getBoundingClientRect().width > 0);
        if (!el) return null;
        return { id: el.id, text: el.textContent.trim(), promoted: el.matches(":popover-open") };
      });
    const waitTip = async (timeout = 1500) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const t = await tip();
        if (t) return t;
        await page.waitForTimeout(30);
      }
      return null;
    };
    /** Scrolls the table's frame and reports where the pinned cells and the head sit. */
    const pinned = (table, { top = 0, toEnd = false } = {}) =>
      table.evaluate(
        async (el, [top, toEnd]) => {
          const frame = el.parentElement;
          frame.scrollTop = top;
          if (toEnd) frame.scrollLeft = getComputedStyle(frame).direction === "rtl" ? -frame.scrollWidth : frame.scrollWidth;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const f = frame.getBoundingClientRect();
          const rtl = getComputedStyle(frame).direction === "rtl";
          const edge = (r) => (rtl ? f.right - r.right : r.left - f.left);
          const hits = (cell) => {
            const r = cell.getBoundingClientRect();
            const x = rtl ? r.right - 4 : r.left + 4;
            const y = r.top + r.height / 2;
            if (y < Math.max(f.top, 0) || y > Math.min(f.bottom, innerHeight)) return null;
            return cell.contains(document.elementFromPoint(x, y));
          };
          const rowHeads = [...el.querySelectorAll('tbody th[scope="row"]')];
          const corner = el.querySelector("thead th");
          const head = el.querySelector("thead").getBoundingClientRect();
          const headHit = el.querySelector("thead").contains(document.elementFromPoint(head.left + head.width / 2, head.top + head.height / 2));
          // The corner is where the pinned head and the pinned column cross: the head must win there too.
          const c = corner.getBoundingClientRect();
          const cornerHit = corner.contains(document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2));
          const visible = rowHeads.filter((th) => hits(th) !== null);
          return {
            scrollTop: frame.scrollTop,
            scrollLeft: frame.scrollLeft,
            overflowX: frame.scrollWidth - frame.clientWidth,
            overflowY: frame.scrollHeight - frame.clientHeight,
            headTop: head.top - f.top,
            headHit,
            cornerHit,
            cornerEdge: edge(corner.getBoundingClientRect()),
            rowEdges: visible.map((th) => edge(th.getBoundingClientRect())),
            rowHits: visible.map(hits),
            page: { scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth },
          };
        },
        [top, toEnd],
      );

    try {
      await load({ theme: "default", density: "comfortable", input: "fine" });
      const table = tableIn("pricing-compare");

      // 1. Harness.
      if ((await table.getAttribute("aria-label")) !== "Compare plans") problems.push(`harness: the table is named "${await table.getAttribute("aria-label")}"`);
      const groups = await table.locator('th[scope="rowgroup"]').count();
      if (groups !== 3) problems.push(`harness: ${groups} groups, expected 3`);
      const rest = await pinned(table);
      if (!(rest.overflowY > 0)) problems.push(`harness: the table's frame does not scroll down (${rest.overflowY}px)`);

      // 2. Sticky head.
      const down = await pinned(table, { top: 160 });
      if (down.scrollTop < 100) problems.push(`sticky head: harness: the frame scrolled only ${down.scrollTop}px`);
      if (Math.abs(down.headTop) > 1) problems.push(`sticky head: scrolled ${down.scrollTop}px, the head sits ${down.headTop}px below the frame's top`);
      if (!down.headHit) problems.push("sticky head: a body row paints over the pinned head");
      if (!down.cornerHit) problems.push("sticky head: a pinned feature name scrolled under the head paints over its corner");
      summary.head = `${down.scrollTop}px`;

      // 3 and 4. The pinned column at 375, both directions.
      await load({ theme: "default", density: "comfortable", input: "fine" }, 375);
      for (const demo of ["pricing-compare", "pricing-rtl"]) {
        const t = tableIn(demo);
        await t.scrollIntoViewIfNeeded();
        const p = await pinned(t, { toEnd: true });
        if (!(p.overflowX > 0)) problems.push(`${demo} 375: harness: the table fits its frame (${p.overflowX}px over), nothing to pin against`);
        if (Math.abs(p.scrollLeft) < 1) problems.push(`${demo} 375: the frame did not scroll sideways`);
        if (p.rowEdges.length === 0) problems.push(`${demo} 375: harness: no feature row header in view`);
        if (Math.abs(p.cornerEdge) > 1 || p.rowEdges.some((e) => Math.abs(e) > 1)) problems.push(`${demo} 375: scrolled ${p.scrollLeft}px, the pinned cells sit ${[p.cornerEdge, ...p.rowEdges].map(Math.round).join(", ")}px from the start edge`);
        if (p.rowHits.some((h) => !h)) problems.push(`${demo} 375: a value cell paints over a pinned feature name`);
        if (p.page.scroll > p.page.width) problems.push(`${demo} 375: the page scrolls sideways (${p.page.scroll}/${p.page.width})`);
        summary[demo] = `${Math.round(p.scrollLeft)}px`;
      }

      // 5. Keyboard: from the last control before the table to the explained names.
      await load({ theme: "default", density: "comfortable", input: "fine" });
      const channels = table.getByRole("button", { name: "Channels" });
      await channels.scrollIntoViewIfNeeded();
      await page.locator('[data-sc="pricing-three"] ul[role="list"] button').last().focus();
      let reached = false;
      for (let i = 0; i < 6 && !reached; i += 1) {
        await page.keyboard.press("Tab");
        reached = await channels.evaluate((el) => el === document.activeElement);
      }
      if (!reached) problems.push("keys: Tab never reached the dotted “Channels” name");
      else {
        const t = await waitTip();
        if (!t || !/in-app panel/.test(t.text)) problems.push(`keys: focus on “Channels” showed ${JSON.stringify(t)}`);
        else {
          if (!t.promoted) problems.push("keys: the tooltip is not in the top layer");
          const described = await channels.getAttribute("aria-describedby");
          if (!(described ?? "").split(/\s+/).includes(t.id)) problems.push("keys: the tooltip does not describe its name");
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        if (await tip()) problems.push("keys: Escape left the tooltip open");
        if (!(await channels.evaluate((el) => el === document.activeElement))) problems.push("keys: Escape moved focus");
        await page.keyboard.press("Tab");
        const next = await page.evaluate(() => document.activeElement?.textContent?.trim());
        if (next !== "Review before publishing") problems.push(`keys: Tab from “Channels” went to "${next}", the next explained name is “Review before publishing”`);
        const t2 = await waitTip();
        if (!t2 || !/approval/.test(t2.text)) problems.push(`keys: the next name's tooltip is ${JSON.stringify(t2)}`);
      }
      await page.keyboard.press("Escape");

      // 6. Mouse: hover after the delay; a press keeps it open.
      const sso = table.getByRole("button", { name: "Single sign-on" });
      await sso.scrollIntoViewIfNeeded();
      const box = await sso.boundingBox();
      await page.mouse.move(2, 2);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
      const hovered = await waitTip();
      if (!hovered || !/identity provider/.test(hovered.text)) problems.push(`mouse: hovering “Single sign-on” showed ${JSON.stringify(hovered)}`);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      const audit = table.getByRole("button", { name: "Audit log" });
      await audit.scrollIntoViewIfNeeded();
      const a = await audit.boundingBox();
      const t0 = Date.now();
      await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
      const pressed = await waitTip(150);
      const after = Date.now() - t0;
      if (!pressed || !/kept for a year/.test(pressed.text)) problems.push(`mouse: a press on “Audit log” showed ${JSON.stringify(pressed)} within ${after}ms`);
      await page.keyboard.press("Escape");

      if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);
    } finally {
      await page.mouse.move(2, 2).catch(() => {});
    }

    if (problems.length) throw new Error(`compare:\n- ${problems.join("\n- ")}`);
    return `compare: head pinned at ${summary.head}, column pinned at ${summary["pricing-compare"]} (RTL ${summary["pricing-rtl"]}), tooltips by Tab, hover and press`;
  };

  /** Testimonial: semantics, quotation marks, the grid, the carousel, 375. */
  const testimonials = async () => {
    const problems = [];
    const summary = {};
    const { errors } = collectErrors(page);

    const load = async (view, width = 1280) => {
      await openSection(page, "marketing-testimonial", { width, view });
      await page.locator('[data-sc="testimonial-grid"]').waitFor();
    };
    const probe = (token) =>
      page.evaluate((token) => {
        const s = document.createElement("span");
        s.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${token})`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      }, token);

    try {
      await load({ theme: "default", density: "comfortable", input: "fine" });

      // 1. Semantics.
      const structure = await page.evaluate(() =>
        [...document.querySelectorAll("figure.r-marketing-testimonial")].map((f) => ({
          quotes: f.querySelectorAll(":scope > blockquote").length,
          captions: f.querySelectorAll(":scope > figcaption").length,
          // The name is the first line of the caption's text block (an avatar's initials are also medium weight).
          name: f.querySelector(":scope > figcaption > span:last-child > span:first-child")?.textContent ?? "",
          captionHasQuote: f.querySelector("figcaption").textContent.includes(f.querySelector("blockquote").textContent.slice(0, 20)),
          cites: [...f.querySelectorAll("cite")].map((c) => c.textContent),
        })),
      );
      if (structure.length < 12) problems.push(`semantics: harness: ${structure.length} testimonials found`);
      for (const t of structure) {
        if (t.quotes !== 1 || t.captions !== 1) problems.push(`semantics: ${t.name} has ${t.quotes} blockquotes and ${t.captions} captions`);
        if (!t.name) problems.push("semantics: a testimonial's caption names no one");
        if (t.captionHasQuote) problems.push(`semantics: ${t.name}'s caption repeats the quote`);
        if (t.cites.some((c) => c.includes(t.name))) problems.push(`semantics: ${t.name} is cited as a work`);
      }
      const sofia = page.locator('[data-sc="testimonial-variants"]').getByRole("figure", { name: /Sofia Marchetti/ });
      if ((await sofia.count()) !== 1) problems.push(`semantics: the accessibility tree has ${await sofia.count()} figures named "Sofia Marchetti" in the variants row`);
      else {
        const cite = await sofia.locator("cite").allInnerTexts();
        if (cite.join() !== "Case study, 2026") problems.push(`semantics: the cited card cites ${JSON.stringify(cite)}`);
        if ((await sofia.locator("blockquote").getAttribute("cite")) !== "https://example.com/customers/corvid") problems.push("semantics: the blockquote lost its cite URL");
        if ((await sofia.getByRole("img", { name: "Rated 4.5 out of 5" }).count()) !== 1) problems.push("semantics: the rating is not an image named “Rated 4.5 out of 5”");
      }
      const tree = await page.locator('[data-sc="testimonial-variants"]').ariaSnapshot();
      if (!/figure "[^"]*Amara Nwosu/.test(tree) || !/blockquote/.test(tree)) problems.push(`semantics: the snapshot lacks a named figure with a blockquote:\n${tree.slice(0, 400)}`);

      // 2. Quotation marks.
      const marks = await page.locator('[data-sc="testimonial-german"] blockquote').evaluate((q) => ({
        quotes: getComputedStyle(q).quotes,
        open: getComputedStyle(q.firstElementChild, "::before").content,
        close: getComputedStyle(q.lastElementChild, "::after").content,
        lang: q.closest("[lang]")?.getAttribute("lang"),
      }));
      if (marks.lang !== "de") problems.push(`marks: harness: the German demo's language is ${marks.lang}`);
      if (marks.open !== "open-quote" || marks.close !== "close-quote" || marks.quotes !== "auto") problems.push(`marks: ${JSON.stringify(marks)}`);

      // 3. The grid.
      const control = await probe("--CONTROL-H");
      const grid = await page.locator('[data-sc="testimonial-grid"]').evaluate((ul) =>
        [...ul.querySelectorAll(":scope > li > figure")].map((f) => {
          const r = f.getBoundingClientRect();
          const avatar = f.querySelector(".r-primitives-avatar")?.getBoundingClientRect();
          return { left: r.left, height: r.height, caption: f.querySelector("figcaption").getBoundingClientRect().bottom, avatar: avatar?.height };
        }),
      );
      if (grid.length !== 3) problems.push(`grid: harness: ${grid.length} cards`);
      else {
        if (new Set(grid.map((g) => Math.round(g.left))).size !== 3) problems.push("grid: the three cards are not in one row at 1280");
        const spread = (key) => Math.max(...grid.map((g) => g[key])) - Math.min(...grid.map((g) => g[key]));
        if (spread("height") > 1) problems.push(`grid: card heights ${grid.map((g) => Math.round(g.height)).join(", ")}`);
        if (spread("caption") > 1) problems.push(`grid: caption bottoms ${grid.map((g) => Math.round(g.caption)).join(", ")}`);
        if (grid.some((g) => Math.abs((g.avatar ?? 0) - control) > 0.5)) problems.push(`grid: avatars ${grid.map((g) => g.avatar).join(", ")}, --CONTROL-H is ${control}`);
      }

      // 4. The carousel.
      const slides = await page.locator('[data-sc="testimonial-carousel"]').evaluate((root) =>
        [...root.querySelectorAll("figure.r-marketing-testimonial")].map((f) => {
          const slide = f.parentElement.getBoundingClientRect();
          return Math.abs(f.getBoundingClientRect().height - slide.height);
        }),
      );
      if (slides.length !== 5) problems.push(`carousel: harness: ${slides.length} testimonials in the carousel`);
      if (slides.some((d) => d > 1)) problems.push(`carousel: a testimonial is ${Math.max(...slides)}px shorter than its slide`);

      // 5. Narrow and coarse.
      await load({ theme: "default", density: "comfortable", input: "coarse" }, 375);
      const icon = await probe("--ICON");
      const narrow = await page.evaluate(() => {
        const out = { spill: [], avatars: [], compact: [] };
        for (const demo of document.querySelectorAll('[data-sc^="testimonial-"]')) {
          const d = demo.getBoundingClientRect();
          for (const f of demo.querySelectorAll("figure.r-marketing-testimonial")) {
            const r = f.getBoundingClientRect();
            if (demo.dataset.sc !== "testimonial-carousel" && (r.left < d.left - 1 || r.right > d.right + 1)) out.spill.push(`${demo.dataset.sc}: figure ${Math.round(r.left)}..${Math.round(r.right)}`);
            for (const el of f.querySelectorAll("p, span, cite")) {
              const e = el.getBoundingClientRect();
              if (e.width > 0 && (e.left < r.left - 1 || e.right > r.right + 1)) out.spill.push(`${demo.dataset.sc}: "${el.textContent.slice(0, 24)}" ${Math.round(e.left)}..${Math.round(e.right)} in ${Math.round(r.left)}..${Math.round(r.right)}`);
            }
            const a = f.querySelector(".r-primitives-avatar")?.getBoundingClientRect().height;
            if (a !== undefined) (f.dataset.variant === "compact" ? out.compact : out.avatars).push(a);
          }
        }
        return out;
      });
      if (narrow.avatars.length === 0 || narrow.avatars.some((h) => h < 44 - 0.5)) problems.push(`coarse: card avatars ${narrow.avatars.join(", ")}, expected 44`);
      if (narrow.compact.length === 0 || narrow.compact.some((h) => Math.abs(h - icon) > 0.5)) problems.push(`coarse: compact avatars ${narrow.compact.join(", ")}, --ICON is ${icon}`);
      if (narrow.spill.length) problems.push(`375: spills: ${narrow.spill.slice(0, 5).join(" | ")}`);
      summary.avatars = `${narrow.avatars[0]}px / ${narrow.compact[0]}px`;

      if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);
    } finally {
      await page.mouse.move(2, 2).catch(() => {});
    }

    if (problems.length) throw new Error(`testimonials:\n- ${problems.join("\n- ")}`);
    return `testimonials: figures named by their captions, cite is the work, grid level, carousel full height, coarse avatars ${summary.avatars}, 375 clean`;
  };

  const passed = [];
  const failed = [];
  for (const part of [planCards, comparison, testimonials]) {
    try {
      passed.push(await part());
    } catch (error) {
      failed.push(error.message);
    }
  }
  if (failed.length) throw new Error(`marketing-pricing FAILED (${failed.length} of 3 parts):\n${failed.join("\n")}`);
  return `marketing-pricing OK ${passed.join("; ")}`;
};
