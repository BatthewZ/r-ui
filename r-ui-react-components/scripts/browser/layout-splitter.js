// @covers   layout/Splitter
// @sections layout-splitter
// @tier     component
//
// Browser check: Splitter, on the Splitter section opened alone (`[data-testid^="sp-"]`).
//
// Run it through `bun run browser:check layout-splitter`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print layout-splitter)"
//
// Asserts, at comfortable + fine unless said otherwise:
//   1. harness: the mail splitter has two separators named "Resize Folders" / "Resize Messages",
//      valued 20 and 35 (its source's defaults), and its panes are drawn at those shares (±1px);
//   2. drag: the Messages separator dragged 60px toward the end (and 100px off its line, so only
//      pointer capture keeps it following) widens Messages by 60px and narrows the reading pane by
//      60px (±2), the value follows, and the release saves the sizes (the readout shows the
//      separator's new value); dragged
//      far past the end it stops where the reading pane is at its token min `calc(--CONTROL-H * 4)`;
//   3. keys: Home puts Messages at that same min, End the reading pane, ArrowLeft takes 5% of the
//      space from Messages (±1px); Enter on "Resize Folders" collapses Folders (0 wide, inert,
//      valued 0, its links out of the tab order) and Enter again restores its width (±1px);
//   4. RTL: the folders pane sits at the right edge, a 60px drag LEFTward widens Messages by 60px,
//      ArrowLeft grows it by 5%;
//   5. stacked (editor over preview): the separator lies flat; it reports the Preview (the
//      collapsible pane after it); ArrowDown shrinks the Preview by 5% of the height, a 40px drag
//      down by 40px, Enter collapses it to 0 tall;
//   6. nested: dragging the inner "Resize Terminal" moves no outer pane, dragging the outer
//      "Resize Explorer" changes no inner pane's share;
//   7. the controlled sidebar: "Hide sidebar" collapses it (0 wide, separator valued 0 at the
//      splitter's start) and "Show sidebar" brings it back;
//   8. no visual bloat, a full hit floor: the separator is drawn `--R-SIZE-5` thick (compact
//      thinner than comfortable); its hit area spans the floor (24px fine, 44px coarse) from its
//      start edge over the pane after it and never over the pane before (whose scrollbar lies
//      against it): a press 1px before it misses, one at floor − 1 hits, one at floor + 2
//      misses; with the pane after collapsed it hangs back over the pane before instead; at
//      coarse + 375 nothing scrolls sideways (the page, the demo frame, every pane), and a
//      collapsed end leaves the splitter unwidened.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors } = collectErrors(page, { filter: (text) => /splitter|Splitter/.test(text) });

  const load = async (view, width) => {
    await openSection(page, "layout-splitter", { width, view });
    await page.locator('[data-testid="sp-mail"]').waitFor();
  };
  const demo = (id) => page.locator(`[data-testid="${id}"]`);
  const sep = (id, name) => demo(id).getByRole("separator", { name, exact: true });
  /** The first splitter in a demo: its panes' boxes (direct children only) and its own box. */
  const panes = (id) =>
    demo(id).evaluate((wrap) => {
      const root = wrap.querySelector(".r-layout-splitter");
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        root: box(root),
        panes: [...root.children].filter((c) => c.hasAttribute("data-splitter-pane")).map((p) => ({ ...box(p), collapsed: p.hasAttribute("data-collapsed"), inert: p.inert })),
      };
    });
  const resolve = (id, css) =>
    demo(id).evaluate((wrap, value) => {
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
      wrap.querySelector(".r-layout-splitter").appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    }, css);
  const value = async (loc) => Number(await loc.getAttribute("aria-valuenow"));
  const drag = async (loc, dx, dy, offAxis = 0) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2 + offAxis, { steps: 4 });
    await page.mouse.move(x + dx, y + dy + offAxis, { steps: 4 });
    await page.mouse.up();
  };
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

  try {
    await load({ theme: "default", density: "comfortable", input: "fine" });

    // 1. Harness.
    const folders = sep("sp-mail", "Resize Folders");
    const messages = sep("sp-mail", "Resize Messages");
    if ((await demo("sp-mail").getByRole("separator").count()) !== 2) problems.push("harness: the mail splitter does not have exactly two separators");
    const v0 = [await value(folders), await value(messages)];
    if (v0.join() !== "20,35") problems.push(`harness: the mail separators are valued ${v0}, the source's defaults 20,35`);
    const m0 = await panes("sp-mail");
    const avail = m0.panes.reduce((t, p) => t + p.width, 0);
    if (m0.panes.length !== 3 || !(avail > 300)) problems.push(`harness: ${m0.panes.length} panes dividing ${avail}px`);
    if (!near(m0.panes[0].width, avail * 0.2) || !near(m0.panes[1].width, avail * 0.35)) {
      problems.push(`layout: panes ${m0.panes.map((p) => p.width.toFixed(1))} of ${avail.toFixed(1)}px, expected 20% / 35% / 45%`);
    }
    const controlMin = await resolve("sp-mail", "calc(var(--CONTROL-H) * 4)");
    if (!near(controlMin, 144)) problems.push(`harness: calc(--CONTROL-H * 4) resolves to ${controlMin}px, the source predicts 144px at comfortable + fine`);

    // 2. Drag, captured off the line.
    await drag(messages, 60, 0, 100);
    const m1 = await panes("sp-mail");
    if (!near(m1.panes[1].width, m0.panes[1].width + 60, 2) || !near(m1.panes[2].width, m0.panes[2].width - 60, 2)) {
      problems.push(`drag: 60px toward the end made Messages ${m1.panes[1].width.toFixed(1)} (from ${m0.panes[1].width.toFixed(1)}) and the reading pane ${m1.panes[2].width.toFixed(1)} (from ${m0.panes[2].width.toFixed(1)})`);
    }
    if (!near(m1.panes[0].width, m0.panes[0].width)) problems.push("drag: the Messages separator moved the Folders pane");
    const expectV = Math.round(((m0.panes[1].width + 60) / avail) * 100);
    if (Math.abs((await value(messages)) - expectV) > 1) problems.push(`drag: the separator says ${await value(messages)}, the pane is ${expectV}%`);
    const saved = (await demo("sp-mail-saved").textContent()) ?? "";
    const savedMessages = /^Saved: 20 · (\d+) · \d+$/.exec(saved.trim())?.[1];
    if (Number(savedMessages) !== (await value(messages))) problems.push(`persist: after the drag the readout says "${saved}", the separator ${await value(messages)}`);
    await drag(messages, 2000, 0);
    const m2 = await panes("sp-mail");
    if (!near(m2.panes[2].width, controlMin)) problems.push(`drag: far past the end the reading pane is ${m2.panes[2].width.toFixed(1)}px, its min ${controlMin}px`);
    summary.drag = `${m0.panes[1].width.toFixed(0)}→${m1.panes[1].width.toFixed(0)}, stop ${m2.panes[2].width.toFixed(0)}`;

    // 3. Keys.
    await messages.focus();
    await page.keyboard.press("Home");
    const k1 = await panes("sp-mail");
    if (!near(k1.panes[1].width, controlMin)) problems.push(`keys: Home made Messages ${k1.panes[1].width.toFixed(1)}px, its min ${controlMin}px`);
    await page.keyboard.press("End");
    const k2 = await panes("sp-mail");
    if (!near(k2.panes[2].width, controlMin)) problems.push(`keys: End left the reading pane ${k2.panes[2].width.toFixed(1)}px, its min ${controlMin}px`);
    await page.keyboard.press("ArrowLeft");
    const k3 = await panes("sp-mail");
    if (!near(k3.panes[1].width, k2.panes[1].width - avail * 0.05)) problems.push(`keys: ArrowLeft took ${(k2.panes[1].width - k3.panes[1].width).toFixed(1)}px, 5% is ${(avail * 0.05).toFixed(1)}px`);
    await folders.focus();
    const beforeCollapse = (await panes("sp-mail")).panes[0].width;
    await page.keyboard.press("Enter");
    const c1 = await panes("sp-mail");
    if (c1.panes[0].width > 0.5 || !c1.panes[0].collapsed || !c1.panes[0].inert || (await value(folders)) !== 0) {
      problems.push(`collapse: after Enter Folders is ${c1.panes[0].width}px, collapsed ${c1.panes[0].collapsed}, inert ${c1.panes[0].inert}, valued ${await value(folders)}`);
    }
    const tabbable = await demo("sp-mail").evaluate((wrap) => {
      const pane = wrap.querySelector("[data-splitter-pane]");
      const link = pane.querySelector("a");
      link.focus();
      return document.activeElement === link;
    });
    if (tabbable) problems.push("collapse: a link in the collapsed Folders pane still takes focus");
    await folders.focus();
    await page.keyboard.press("Enter");
    const c2 = await panes("sp-mail");
    if (!near(c2.panes[0].width, beforeCollapse)) problems.push(`collapse: Enter restored Folders to ${c2.panes[0].width.toFixed(1)}px, it was ${beforeCollapse.toFixed(1)}px`);

    // 4. RTL.
    const r0 = await panes("sp-rtl");
    if (!near(r0.panes[0].right, r0.root.right, 2)) problems.push(`RTL: Folders ends at ${r0.panes[0].right}, the splitter at ${r0.root.right}`);
    await drag(sep("sp-rtl", "Resize Messages"), -60, 0);
    const r1 = await panes("sp-rtl");
    if (!near(r1.panes[1].width, r0.panes[1].width + 60, 2)) problems.push(`RTL: a 60px leftward drag made Messages ${r1.panes[1].width.toFixed(1)} from ${r0.panes[1].width.toFixed(1)}`);
    const rAvail = r1.panes.reduce((t, p) => t + p.width, 0);
    await sep("sp-rtl", "Resize Messages").focus();
    await page.keyboard.press("ArrowLeft");
    const r2 = await panes("sp-rtl");
    if (!near(r2.panes[1].width, r1.panes[1].width + rAvail * 0.05)) problems.push(`RTL: ArrowLeft grew Messages by ${(r2.panes[1].width - r1.panes[1].width).toFixed(1)}px, 5% is ${(rAvail * 0.05).toFixed(1)}px`);

    // 5. Stacked.
    const preview = sep("sp-editor", "Resize Preview");
    if ((await preview.getAttribute("aria-orientation")) !== "horizontal") problems.push("stacked: the separator is not horizontal");
    const e0 = await panes("sp-editor");
    const eAvail = e0.panes.reduce((t, p) => t + p.height, 0);
    await preview.focus();
    await page.keyboard.press("ArrowDown");
    const e1 = await panes("sp-editor");
    if (!near(e1.panes[1].height, e0.panes[1].height - eAvail * 0.05)) problems.push(`stacked: ArrowDown changed the Preview by ${(e1.panes[1].height - e0.panes[1].height).toFixed(1)}px, expected -${(eAvail * 0.05).toFixed(1)}`);
    await drag(preview, 0, 40);
    const e2 = await panes("sp-editor");
    if (!near(e2.panes[1].height, e1.panes[1].height - 40, 2)) problems.push(`stacked: a 40px drag down made the Preview ${e2.panes[1].height.toFixed(1)} from ${e1.panes[1].height.toFixed(1)}`);
    await preview.focus();
    await page.keyboard.press("Enter");
    const e3 = await panes("sp-editor");
    if (e3.panes[1].height > 0.5) problems.push(`stacked: Enter left the Preview ${e3.panes[1].height}px tall`);
    await page.keyboard.press("Enter");

    // 6. Nested.
    const innerShares = () =>
      demo("sp-nested").evaluate((wrap) => {
        const inner = wrap.querySelectorAll(".r-layout-splitter")[1];
        return [...inner.children].filter((c) => c.hasAttribute("data-splitter-pane")).map((p) => Number(p.style.flexGrow));
      });
    const n0 = await panes("sp-nested");
    const i0 = await innerShares();
    await drag(sep("sp-nested", "Resize Terminal"), 0, -30);
    const n1 = await panes("sp-nested");
    const i1 = await innerShares();
    if (i1.join() === i0.join()) problems.push("nested: dragging Resize Terminal moved nothing");
    if (!near(n1.panes[0].width, n0.panes[0].width)) problems.push("nested: the inner drag moved the outer Explorer pane");
    await drag(sep("sp-nested", "Resize Explorer"), 40, 0);
    const n2 = await panes("sp-nested");
    const i2 = await innerShares();
    if (!near(n2.panes[0].width, n1.panes[0].width + 40, 2)) problems.push(`nested: the outer drag made Explorer ${n2.panes[0].width.toFixed(1)} from ${n1.panes[0].width.toFixed(1)}`);
    if (i2.join() !== i1.join()) problems.push(`nested: the outer drag changed the inner shares ${i1} → ${i2}`);

    // 7. Controlled sidebar.
    const sidebarSep = sep("sp-sidebar", "Resize Sidebar");
    await demo("sp-sidebar").getByRole("button", { name: "Hide sidebar" }).click();
    const s1 = await panes("sp-sidebar");
    const sepBox = await sidebarSep.boundingBox();
    if (s1.panes[0].width > 0.5 || (await value(sidebarSep)) !== 0) problems.push(`sidebar: hidden, it is ${s1.panes[0].width}px and valued ${await value(sidebarSep)}`);
    if (!(sepBox.x - s1.root.left < 3)) problems.push(`sidebar: the collapsed separator sits ${sepBox.x - s1.root.left}px from the start`);
    await demo("sp-sidebar").getByRole("button", { name: "Show sidebar" }).click();
    if ((await panes("sp-sidebar")).panes[0].width < 10) problems.push("sidebar: Show sidebar did not bring it back");

    // 8. Thickness and hit floor.
    const thickness = async (id) => {
      const b = await sep(id, "Resize Messages").boundingBox();
      return { drawn: b.width, token: await resolve(id, "var(--R-SIZE-5)") };
    };
    const comfy = await thickness("sp-mail");
    const compact = await thickness("sp-compact");
    if (!near(comfy.drawn, comfy.token, 0.5) || !near(compact.drawn, compact.token, 0.5)) problems.push(`thickness: drawn ${comfy.drawn}/${compact.drawn}px, --R-SIZE-5 ${comfy.token}/${compact.token}px`);
    if (!(compact.drawn < comfy.drawn)) problems.push(`thickness: compact ${compact.drawn}px is not thinner than comfortable ${comfy.drawn}px`);
    /**
     * Whether a press `d` px along the separator's axis from its start edge (its left, or its top
     * when stacked; `from: "end"` measures back from its right or bottom) lands on it.
     */
    const hitAt = async (id, name, d, from = "start") => {
      const loc = sep(id, name);
      await loc.scrollIntoViewIfNeeded();
      return loc.evaluate(
        (el, [dd, end]) => {
          const r = el.getBoundingClientRect();
          const flat = el.getAttribute("aria-orientation") === "horizontal";
          const x = flat ? r.left + r.width / 2 : end ? r.right - dd : r.left + dd;
          const y = flat ? (end ? r.bottom - dd : r.top + dd) : r.top + r.height / 2;
          return el.contains(document.elementFromPoint(x, y));
        },
        [d, from === "end"],
      );
    };
    /** The hit area spans exactly `hitMin` from one edge into the pane after (or before, `from: "end"`), never past the other edge. */
    const hitSpan = async (id, name, hitMin, from = "start") => ({
      outside: await hitAt(id, name, -1, from),
      far: await hitAt(id, name, hitMin - 1, from),
      past: await hitAt(id, name, hitMin + 2, from),
    });
    const fineSpan = await hitSpan("sp-mail", "Resize Messages", 24);
    if (fineSpan.outside || !fineSpan.far || fineSpan.past) {
      problems.push(`hit at fine: ${JSON.stringify(fineSpan)}; expected nothing over the Messages pane (its scrollbar side) and 24px over the reading pane`);
    }
    summary.fine = `${comfy.drawn}px drawn`;

    await load({ theme: "default", density: "comfortable", input: "coarse" }, 375);
    const coarseSpan = await hitSpan("sp-mail", "Resize Messages", 44);
    if (coarseSpan.outside || !coarseSpan.far || coarseSpan.past) {
      problems.push(`hit at coarse: ${JSON.stringify(coarseSpan)}; expected nothing over the Messages pane and 44px over the reading pane`);
    }
    const drawnCoarse = (await sep("sp-mail", "Resize Messages").boundingBox()).width;
    if (!near(drawnCoarse, comfy.drawn, 0.5)) problems.push(`thickness: at coarse the separator is drawn ${drawnCoarse}px, at fine ${comfy.drawn}px`);
    // Collapse a pane at each kind of edge: the separator then sits on the splitter's own edge,
    // and its hit area must not widen (or lengthen) what is around the splitter.
    await sep("sp-editor", "Resize Preview").focus();
    await page.keyboard.press("Enter");
    // With the pane after it collapsed, the hit area hangs back over the editor instead.
    const endSpan = await hitSpan("sp-editor", "Resize Preview", 44, "end");
    if (endSpan.outside || !endSpan.far || endSpan.past) problems.push(`hit with Preview collapsed: ${JSON.stringify(endSpan)}; expected 44px back over the editor`);
    await demo("sp-sidebar").getByRole("button", { name: "Hide sidebar" }).click();
    const spill = await page.evaluate(() => {
      const section = document.querySelector('[data-testid="sp-mail"]').closest(".sc-demo");
      const out = [];
      const html = document.documentElement;
      if (html.scrollWidth > html.clientWidth) out.push(`page ${html.scrollWidth}/${html.clientWidth}`);
      if (section.scrollWidth > section.clientWidth + 1) out.push(`demo frame ${section.scrollWidth}/${section.clientWidth}`);
      for (const el of section.querySelectorAll("[data-splitter-pane]")) {
        if (el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1) out.push(`pane ${el.scrollWidth}/${el.clientWidth}`);
      }
      const editor = document.querySelector('[data-testid="sp-editor"]');
      if (editor.scrollHeight > editor.clientHeight + 1) out.push(`collapsed end (editor) ${editor.scrollHeight}/${editor.clientHeight} tall`);
      const sidebar = document.querySelector('[data-testid="sp-sidebar"] .r-layout-splitter').parentElement;
      if (sidebar.scrollWidth > sidebar.clientWidth + 1) out.push(`collapsed start (sidebar) ${sidebar.scrollWidth}/${sidebar.clientWidth}`);
      return { out, splitters: section.querySelectorAll(".r-layout-splitter").length };
    });
    if (spill.splitters !== 7) problems.push(`harness: ${spill.splitters} splitters in the section, the source renders 7`);
    if (spill.out.length) problems.push(`375 + coarse: overflow in ${spill.out.join("; ")}`);

    if (errors.length) problems.push(`errors: ${errors.join(" | ")}`);
  } finally {
    await page.mouse.up().catch(() => {});
  }

  if (problems.length) throw new Error(`layout-splitter:\n- ${problems.join("\n- ")}`);
  return `layout-splitter OK drag ${summary.drag}; ${summary.fine}; keys, collapse, RTL, stacked, nested, sidebar, coarse 44px floor, no spill at 375`;
};
