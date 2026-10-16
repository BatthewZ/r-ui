// Browser check: AvatarUpload (a real image, the real canvas, the real Slider) and AvatarGroup layout.
//
// jsdom decodes no image and draws no canvas, so the crop is proven on pixels here. It asserts:
//   1. harness: the profile's control is one button named "Profile photo Choose photo", and its
//      stage resolves to 6 × --ICON (96px at comfortable), predicted by a probe;
//   2. refusal: a PDF picked into the profile is refused: the message describes the button and
//      the Field is invalid (data-invalid on its root);
//   3. crop + upload: a 300 × 100 PNG (red | green with a centred white 50 × 50 square | blue)
//      opens the crop with the zoom slider focused at "100%"; five PageUps read "200%" and scale
//      the preview by 2; "Use photo" puts a "Uploading photo" ring over the stage (the ring's box
//      is the stage's, the photo inside it clear of the stroke), focus on "Cancel upload", and the
//      ring's value grows; the upload ends as "Saved photo: 512 × 512 px", focus on "Replace
//      photo", and the saved image's four corners and centre are white: the centred square at
//      zoom 2 (at zoom 1, or off centre, the corners would be green or a band's colour);
//   4. cancel: a second crop's upload cancelled keeps the saved photo (same src) and puts focus
//      on "Replace photo";
//   5. failure: with "Fail the next upload" on, the upload fails with its reason and focus on
//      "Try again", which then uploads it;
//   6. AvatarGroup: the "Team" list of nine at max 5 has four faces named by person and a "+5"
//      item whose text names the other five; each face overlaps the one before it by a quarter
//      of --CONTROL-H (±1px); the RTL group overlaps leftward; renderOverflow's "+5" button opens
//      a popover in the top layer listing five names, Escape closes it with focus on the button;
//   7. coarse + 375: every face and the overflow button are 44px; the avatar-upload buttons are
//      at least 44px tall; neither section (nor the page) scrolls sideways;
//   8. forced colours: the "+5" chip keeps a visible edge.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const open = async (anchor, { input = "fine", width = 1280 } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate(
      ({ key, view }) => localStorage.setItem(key, JSON.stringify(view)),
      { key: SHOWCASE_VIEW_KEY, view: { theme: "default", density: "comfortable", input } },
    );
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${anchor}"]`).scrollIntoViewIfNeeded();
  };
  const until = async (fn, ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await page.waitForTimeout(50);
    }
    return false;
  };
  const focused = (locator) => locator.evaluate((el) => el === document.activeElement);
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  const noSpill = async (anchor) => {
    const spill = await page.evaluate((id) => {
      const section = document.getElementById(id);
      const scroller = document.scrollingElement;
      return { page: scroller.scrollWidth - scroller.clientWidth, section: section.scrollWidth - section.clientWidth };
    }, anchor);
    if (spill.page > 0 || spill.section > 0) fail.push(`375 ${anchor}: sideways scroll ${JSON.stringify(spill)}`);
  };
  // run-code has no Buffer global; a response body is one, and its class makes the files.
  const NodeBuffer = (await (await page.request.get(base)).body()).constructor;

  try {
    // ── 1: harness ──────────────────────────────────────────────────────────
    await open("form-avatarupload");
    const profile = page.locator('[data-sc="avatar-profile"]');
    const choose = profile.getByRole("button", { name: "Profile photo Choose photo", exact: true });
    const replace = profile.getByRole("button", { name: "Profile photo Replace photo", exact: true });
    const picker = profile.locator('input[type="file"]:not([name])');
    if ((await choose.count()) !== 1 || (await picker.count()) !== 1) fail.push(`harness: ${await choose.count()} choose buttons, ${await picker.count()} pickers`);
    const stageSize = await profile.locator(".r-form-avatar-stage").evaluate((stage) => {
      const probe = document.createElement("div");
      probe.style.inlineSize = "calc(var(--ICON) * 6)";
      stage.parentElement.append(probe);
      const predicted = probe.getBoundingClientRect().width;
      probe.remove();
      return { predicted, actual: stage.getBoundingClientRect().width };
    });
    if (Math.round(stageSize.predicted) !== 96 || !near(stageSize.actual, stageSize.predicted)) fail.push(`harness: stage ${JSON.stringify(stageSize)}, source predicts 96px`);

    // ── 2: refusal ──────────────────────────────────────────────────────────
    await picker.setInputFiles([{ name: "resume.pdf", mimeType: "application/pdf", buffer: NodeBuffer.alloc(2000, 1) }]);
    const refused = await choose.evaluate((button) => ({
      described: (button.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" | "),
      fieldInvalid: button.closest('[data-sc="avatar-photo-field"]')?.hasAttribute("data-invalid") ?? "no field",
    }));
    if (!refused.described.includes("“resume.pdf” is not an image") || refused.fieldInvalid !== true) fail.push(`refusal: ${JSON.stringify(refused)}`);

    // ── 3: crop and upload ──────────────────────────────────────────────────
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 100;
      const context = canvas.getContext("2d");
      for (const [x, colour] of [[0, "#d00000"], [100, "#00a000"], [200, "#0000d0"]]) {
        context.fillStyle = colour;
        context.fillRect(x, 0, 100, 100);
      }
      context.fillStyle = "#ffffff";
      context.fillRect(125, 25, 50, 50);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const pickPhoto = () => picker.setInputFiles([{ name: "bands.png", mimeType: "image/png", buffer: NodeBuffer.from(png, "base64") }]);
    await pickPhoto();
    const zoom = profile.getByRole("slider", { name: "Zoom", exact: true });
    if (!(await until(async () => (await zoom.count()) === 1 && (await focused(zoom)), 3000))) fail.push("crop: the zoom slider did not take focus");
    if ((await zoom.getAttribute("aria-valuetext")) !== "100%") fail.push(`crop: zoom starts "${await zoom.getAttribute("aria-valuetext")}"`);
    for (let i = 0; i < 5; i++) await page.keyboard.press("PageUp");
    const preview = profile.locator(".r-form-avatar-stage img");
    // The zoom eases: read the scale once the transition has finished.
    await preview.evaluate((img) => Promise.all(img.getAnimations().map((animation) => animation.finished)));
    const zoomed = { text: await zoom.getAttribute("aria-valuetext"), transform: await preview.evaluate((img) => getComputedStyle(img).transform) };
    if (zoomed.text !== "200%" || !/^matrix\(2, 0, 0, 2,/.test(zoomed.transform)) fail.push(`crop: after five PageUps ${JSON.stringify(zoomed)}`);
    await profile.getByRole("button", { name: "Use photo", exact: true }).click();
    const ring = profile.getByRole("progressbar", { name: "Uploading photo", exact: true });
    if (!(await until(async () => (await ring.count()) === 1, 3000))) fail.push("upload: no progress ring");
    else {
      const geometry = await ring.evaluate((el) => {
        const stage = el.closest(".r-form-avatar-stage").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const photo = el.parentElement.querySelector("img").getBoundingClientRect();
        return { stage: [stage.left, stage.top, stage.width], ring: [r.left, r.top, r.width], photo: [photo.left, photo.width] };
      });
      const stroke = geometry.ring[2] / 12;
      if (!near(geometry.ring[0], geometry.stage[0]) || !near(geometry.ring[1], geometry.stage[1]) || !near(geometry.ring[2], geometry.stage[2])) {
        fail.push(`upload: ring box ${JSON.stringify(geometry.ring)} is not the stage ${JSON.stringify(geometry.stage)}`);
      }
      if (!(geometry.photo[0] >= geometry.ring[0] + stroke - 0.5 && geometry.photo[0] + geometry.photo[1] <= geometry.ring[0] + geometry.ring[2] - stroke + 0.5)) {
        fail.push(`upload: the photo ${JSON.stringify(geometry.photo)} runs under the ring's stroke (${stroke}px) ${JSON.stringify(geometry.ring)}`);
      }
      if (!(await focused(profile.getByRole("button", { name: "Cancel upload", exact: true })))) fail.push("upload: focus is not on Cancel upload");
      const value = async () => Number((await ring.getAttribute("aria-valuenow")) ?? -1);
      await page.waitForTimeout(400);
      const first = await value();
      await page.waitForTimeout(700);
      const second = await value();
      if (!(second > first && first >= 0)) fail.push(`upload: progress ${first} → ${second} did not grow`);
    }
    const result = profile.locator('[data-sc="avatar-result"]');
    if (!(await until(async () => (await result.innerText()).startsWith("Saved photo: 512 × 512 px"), 6000))) fail.push(`upload: result "${await result.innerText()}"`);
    if (!(await focused(replace))) fail.push("upload: focus is not on Replace photo after the upload");
    const savedSrc = await profile.locator(".r-form-avatar-stage img").getAttribute("src");
    const pixels = await page.evaluate(async (src) => {
      const image = new window.Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const at = (x, y) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
      const last = image.naturalWidth - 6;
      return [at(5, 5), at(last, 5), at(5, last), at(last, last), at(image.naturalWidth / 2, image.naturalHeight / 2)];
    }, savedSrc);
    if (pixels.some((rgb) => rgb.some((c) => c < 230))) fail.push(`crop pixels: corners and centre ${JSON.stringify(pixels)} are not the centred white square at zoom 2`);

    // ── 4: cancel keeps the photo ───────────────────────────────────────────
    await pickPhoto();
    await until(async () => (await zoom.count()) === 1, 3000);
    await profile.getByRole("button", { name: "Use photo", exact: true }).click();
    await until(async () => (await ring.count()) === 1, 3000);
    await profile.getByRole("button", { name: "Cancel upload", exact: true }).click();
    const afterCancel = { ring: await ring.count(), src: await profile.locator(".r-form-avatar-stage img").getAttribute("src"), focus: await focused(replace) };
    if (afterCancel.ring !== 0 || afterCancel.src !== savedSrc || !afterCancel.focus) fail.push(`cancel: ${JSON.stringify({ ...afterCancel, src: afterCancel.src === savedSrc ? "same" : "changed" })}`);

    // ── 5: failure and Try again ────────────────────────────────────────────
    await profile.getByRole("switch", { name: "Fail the next upload", exact: true }).check();
    await pickPhoto();
    await until(async () => (await zoom.count()) === 1, 3000);
    await profile.getByRole("button", { name: "Use photo", exact: true }).click();
    const retry = profile.getByRole("button", { name: "Try again", exact: true });
    if (!(await until(async () => (await retry.count()) === 1, 5000))) fail.push("failure: no Try again");
    else {
      const reason = await profile.getByText("Upload failed: the server is busy", { exact: false }).first().count();
      if (reason !== 1 || !(await focused(retry))) fail.push(`failure: reason shown ${reason}, focus on Try again ${await focused(retry)}`);
      await retry.click();
      if (!(await until(async () => (await replace.count()) === 1 && (await ring.count()) === 0, 6000))) fail.push("failure: Try again did not upload");
    }

    // ── 6: AvatarGroup ──────────────────────────────────────────────────────
    await open("primitives-avatargroup");
    const team = page.getByRole("list", { name: "Team", exact: true });
    const teamState = await team.evaluate((list) => {
      const items = [...list.children];
      return {
        items: items.length,
        faces: [...list.querySelectorAll('[role="img"]')].map((img) => img.getAttribute("aria-label")),
        chip: items.at(-1)?.textContent ?? "",
        boxes: items.map((li) => {
          const r = li.getBoundingClientRect();
          return { left: r.left, right: r.right, w: r.width };
        }),
        ring: getComputedStyle(items[0]).boxShadow,
      };
    });
    if (teamState.items !== 5 || teamState.faces.join() !== "Ada Lovelace,Grace Hopper,Alan Turing,Katherine Johnson") fail.push(`group: ${JSON.stringify(teamState.faces)} in ${teamState.items} items`);
    if (!teamState.chip.startsWith("+5") || !teamState.chip.includes("5 more: Edsger Dijkstra, Barbara Liskov, Margaret Hamilton, Donald Knuth, Frances Allen")) fail.push(`group chip: "${teamState.chip}"`);
    const overlaps = teamState.boxes.slice(1).map((box, i) => teamState.boxes[i].right - box.left);
    if (overlaps.length !== 4 || overlaps.some((o) => !near(o, 9))) fail.push(`group overlap: ${JSON.stringify(overlaps)}, expected a quarter of 36px each`);
    if (!teamState.ring || teamState.ring === "none") fail.push("group: no separating ring");
    const rtlOverlaps = await page.getByRole("list", { name: "الفريق", exact: true }).evaluate((list) => {
      const boxes = [...list.children].map((li) => li.getBoundingClientRect());
      return boxes.slice(1).map((box, i) => box.right - boxes[i].left);
    });
    if (rtlOverlaps.length !== 3 || rtlOverlaps.some((o) => !near(o, 9))) fail.push(`group rtl overlap: ${JSON.stringify(rtlOverlaps)}`);
    const more = page.locator('[data-sc="avatar-group-popover"]').getByRole("button", { name: /^5 more: / });
    await more.click();
    const panel = page.getByRole("dialog", { name: "Also on call" }).or(page.locator('[aria-label="Also on call"]'));
    if (!(await until(async () => (await panel.count()) === 1 && (await panel.isVisible()), 3000))) fail.push("group popover: did not open");
    else {
      const listed = await panel.evaluate((el) => ({ names: [...el.querySelectorAll("li")].map((li) => li.textContent.trim()), top: el.matches(":popover-open") }));
      if (listed.names.length !== 5 || !listed.top) fail.push(`group popover: ${JSON.stringify(listed)}`);
      await page.keyboard.press("Escape");
      if (!(await until(async () => !(await panel.isVisible()), 2000)) || !(await focused(more))) fail.push("group popover: Escape did not close it with focus on the button");
    }

    // ── 7: coarse + 375 ─────────────────────────────────────────────────────
    await open("primitives-avatargroup", { input: "coarse", width: 375 });
    const coarseGroup = await page.getByRole("list", { name: "Team", exact: true }).evaluate((list) =>
      [...list.children].map((li) => {
        const r = li.firstElementChild.getBoundingClientRect();
        return [r.width, r.height];
      }),
    );
    const coarseMore = await page.locator('[data-sc="avatar-group-popover"]').getByRole("button", { name: /^5 more: / }).boundingBox();
    if (coarseGroup.length !== 5 || coarseGroup.some(([w, h]) => !near(w, 44) || !near(h, 44)) || !coarseMore || !near(coarseMore.width, 44)) {
      fail.push(`coarse group: faces ${JSON.stringify(coarseGroup)}, button ${JSON.stringify(coarseMore)}`);
    }
    await noSpill("primitives-avatargroup");
    await open("form-avatarupload", { input: "coarse", width: 375 });
    const buttons = await page.locator('[id="form-avatarupload"] .r-form-avatar-stage').first().evaluate((stage) =>
      [...stage.parentElement.querySelectorAll("button")].map((b) => b.getBoundingClientRect().height),
    );
    if (buttons.length === 0 || buttons.some((h) => h < 44)) fail.push(`coarse upload: button heights ${JSON.stringify(buttons)}`);
    await noSpill("form-avatarupload");

    // ── 8: forced colours ───────────────────────────────────────────────────
    await open("primitives-avatargroup");
    await page.emulateMedia({ forcedColors: "active" });
    const chipEdge = await page.getByRole("list", { name: "Team", exact: true }).evaluate((list) => {
      const css = getComputedStyle(list.lastElementChild.firstElementChild);
      return { style: css.borderTopStyle, width: Number.parseFloat(css.borderTopWidth) };
    });
    if (chipEdge.style === "none" || !(chipEdge.width > 0)) fail.push(`forced: chip edge ${JSON.stringify(chipEdge)}`);
    await page.emulateMedia({ forcedColors: null });
  } finally {
    stopErrors();
  }
  if (errors.length) fail.push(...errors);
  if (fail.length) throw new Error(`form-inputs-avatars:\n  ${fail.join("\n  ")}`);
  return "form-inputs-avatars: refusal, crop at zoom 2 proven on pixels, upload ring and progress, cancel and retry with focus, group overlap (LTR/RTL), overflow chip and popover, coarse sizes, no spill at 375, forced-colour chip edge";
}
