// @covers   form/FileUpload
// @sections form-fileupload
// @tier     component
//
// Browser check: FileUpload with a real file and real layout, on the FileUpload section opened
// alone. Refusals, progress, cancel / retry / failure, removal and its focus, and the submitted
// values are `FileUpload.test.tsx`'s.
//
//   1. harness: the page resolves --CONTROL-H 36px at comfortable/fine, as the source
//      predicts, and the documents zone is ONE button named by its label and prompt;
//   2. a real PNG given to the profile photo field's own file input (`setInputFiles`) is
//      listed;
//   3. at coarse input and 375px: every zone is at least 44px, a row's remove button answers
//      a press outside its visible box (hit-area), and neither the section nor the page
//      scrolls sideways.
//
// Run it through `bun run browser:check form-fileupload`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (view, width) => {
    const section = await openSection(page, "form-fileupload", { width, height: width === 375 ? 800 : undefined, view });
    await section.scrollIntoViewIfNeeded();
    await settle(page);
  };
  // run-code has no Buffer global; a response body is one, and its class makes the files.
  const NodeBuffer = (await (await page.request.get(base)).body()).constructor;

  try {
    // 1. Harness.
    await load({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const controlH = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--CONTROL-H"));
    if (Math.round(Number.parseFloat(controlH)) !== 36) fail.push(`harness: --CONTROL-H is ${controlH}, source predicts 36px`);
    const docs = page.locator('[data-testid="upload-documents"]');
    const docZone = docs.getByRole("button", { name: "Incident attachments Drop files here or browse", exact: true });
    if ((await docZone.count()) !== 1) fail.push(`harness: ${await docZone.count()} documents zones by name`);

    // 2. A real file through the zone's own input; a real PNG, so the thumbnail decodes.
    const avatar = page.locator('[data-testid="upload-avatar"]');
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 8;
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await avatar.locator('input[type="file"]').setInputFiles([{ name: "me.png", mimeType: "image/png", buffer: NodeBuffer.from(png, "base64") }]);
    const listed = await page
      .waitForFunction(
        () => [...(document.querySelector('[data-testid="upload-avatar"] [aria-label="Files"]')?.children ?? [])].map((li) => li.querySelector("[title]")?.textContent).join() === "me.png",
        undefined,
        { timeout: 4000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!listed) fail.push("files: me.png was not listed");

    // 3. Coarse, 375.
    await load({ theme: "default", density: "compact", input: "coarse" }, 375);
    const sizes = await page.locator("#form-fileupload").evaluate((section) => {
      const zones = [...section.querySelectorAll(".r-form-upload-zone")].map((z) => z.getBoundingClientRect().height);
      const spill = [section, ...section.querySelectorAll("*")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          // A truncated file name is designed to clip (its full name is in `title`).
          return el.scrollWidth > el.clientWidth + 1 && ["auto", "scroll", "hidden"].includes(cs.overflowX) && cs.textOverflow !== "ellipsis";
        })
        .map((el) => el.className || el.tagName);
      return {
        zones,
        spill,
        page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        right: Math.max(...[...section.querySelectorAll(".r-form-upload-zone")].map((el) => el.getBoundingClientRect().right)),
        width: document.documentElement.clientWidth,
      };
    });
    if (sizes.zones.length === 0) fail.push("coarse: no zones measured");
    if (sizes.zones.some((h) => h < 44)) fail.push(`form-fileupload coarse: a target under 44px ${JSON.stringify({ zones: sizes.zones })}`);
    if (sizes.page > 0 || sizes.spill.length > 0 || sizes.right > sizes.width)
      fail.push(`form-fileupload 375: sideways overflow ${JSON.stringify({ page: sizes.page, spill: sizes.spill.slice(0, 3), right: sizes.right })}`);
    // A row's remove button answers a press just outside its visible box.
    const remove = docs.getByRole("button", { name: "Remove checkout-runbook-v3.pdf" });
    const probe = await remove.evaluate((button) => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom + 4);
      return { visible: r.height, hit: hit === button || button.contains(hit) };
    });
    if (probe.visible >= 44 || !probe.hit) fail.push(`coarse: the remove button's hit area ${JSON.stringify(probe)}`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`form-fileupload:\n  ${fail.join("\n  ")}`);
  return "form-fileupload OK one named zone; a real PNG through the file input is listed; coarse ≥44px, hit area, no spill at 375";
}
