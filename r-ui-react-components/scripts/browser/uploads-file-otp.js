// Browser check: FileUpload and OTPInput with real files, real keys, real layout.
//
// On the Overview's FileUpload and OTPInput sections it asserts:
//   1. harness: the page resolves --CONTROL-H 36px at comfortable/fine, as the
//      source predicts, and the documents zone is ONE button named by its label
//      and prompt;
//   2. files: setInputFiles on the zone's own file input adds a file (a row with
//      its name and size); in the profile photo field a wrong type and an
//      oversize file are refused with their messages, which describe the zone
//      (aria-describedby) and make the Field invalid (data-invalid on its root);
//   3. upload: a document's progressbar advances (aria-valuenow grows); Cancel
//      aborts it ("Cancelled", no bar, a late answer changes nothing) and leaves
//      focus on Retry; Retry finishes it ("Uploaded", one hidden input per value
//      for native submission); a "…corrupt…" file fails with its reason; Remove
//      takes a row away and focus goes back to the zone;
//   4. OTP: the verify card holds exactly one textbox, named "Verification code ,
//      6 digits"; a pasted "123-456" fills all six boxes and completes exactly
//      once (the wrong-code message says 4 of 5 attempts are left, not 3);
//      Backspace goes back a box at a time, the arrows move the active box and a
//      typed digit replaces the selected one; the right code verifies;
//   5. at coarse input and 375px: the zone and every OTP box are at least 44px,
//      a row's remove button answers a press outside its visible box (hit-area),
//      and neither section (nor the page) scrolls sideways.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const setView = async (view, anchor) => {
    await page.goto(`${base}#/overview/${anchor}`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), view);
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`#${anchor}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  };
  const until = async (fn, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await page.waitForTimeout(50);
    }
    return false;
  };
  // run-code has no Buffer global; a response body is one, and its class makes the files.
  const NodeBuffer = (await (await page.request.get(base)).body()).constructor;
  const file = (name, mimeType, size) => ({ name, mimeType, buffer: NodeBuffer.alloc(size, 1) });
  const isFocused = (locator) => locator.evaluate((el) => el === document.activeElement);

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setView({ theme: "default", density: "comfortable", input: "fine" }, "form-fileupload");

    // ── 1: harness ────────────────────────────────────────────────────────
    const controlH = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--CONTROL-H"));
    if (Math.round(Number.parseFloat(controlH)) !== 36) fail.push(`harness: page --CONTROL-H is ${controlH}, source predicts 36px`);
    const docs = page.locator('[data-testid="upload-documents"]');
    const docZone = docs.getByRole("button", { name: "Incident attachments Drop files here or browse", exact: true });
    if ((await docZone.count()) !== 1) fail.push(`harness: ${await docZone.count()} documents zones by name`);
    const docInput = docs.locator('input[type="file"]');
    const rowNames = (scope) =>
      scope.getByRole("list", { name: "Files" }).evaluate((list) => [...list.children].map((li) => li.querySelector("[title]")?.textContent));

    // ── 2: files in, refusals out ─────────────────────────────────────────
    const avatar = page.locator('[data-testid="upload-avatar"]');
    const avatarZone = avatar.locator(".r-form-upload-zone");
    // A single-file input takes one file per pick: each refusal on its own.
    const refusalAfter = async (pick) => {
      await avatar.locator('input[type="file"]').setInputFiles([pick]);
      return avatarZone.evaluate((zone) => ({
        invalid: zone.getAttribute("aria-invalid"),
        described: (zone.getAttribute("aria-describedby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" | "),
        fieldInvalid: zone.closest('[data-testid="upload-avatar"]').hasAttribute("data-invalid"),
        rows: zone.parentElement.querySelectorAll("li").length,
      }));
    };
    for (const [pick, message] of [
      [file("contract.pdf", "application/pdf", 2000), "“contract.pdf” is not a file type"],
      [file("holiday.png", "image/png", 3 * 1024 * 1024), "“holiday.png” is larger than 2 MB"],
    ]) {
      const refusal = await refusalAfter(pick);
      if (refusal.invalid !== "true" || !refusal.fieldInvalid) fail.push(`refusal ${pick.name}: zone/Field not invalid ${JSON.stringify(refusal)}`);
      if (!refusal.described.includes(message)) fail.push(`refusal ${pick.name}: message not in the zone's description: ${refusal.described}`);
      if (refusal.rows !== 0) fail.push(`refusal ${pick.name}: ${refusal.rows} refused file(s) were listed`);
    }
    // A real PNG, so the thumbnail decodes.
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 8;
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await avatar.locator('input[type="file"]').setInputFiles([{ name: "me.png", mimeType: "image/png", buffer: NodeBuffer.from(png, "base64") }]);
    if (!(await until(async () => (await rowNames(avatar)).join() === "me.png"))) fail.push("files: me.png was not listed");
    if ((await avatarZone.getAttribute("aria-invalid")) !== null) fail.push("files: a good pick did not clear the refusal");

    // ── 3: upload, cancel, retry, fail, remove ────────────────────────────
    await docInput.setInputFiles([file("site-survey.pdf", "application/pdf", 2_400_000)]);
    const bar = docs.getByRole("progressbar", { name: "Uploading site-survey.pdf" });
    if (!(await until(async () => (await bar.count()) === 1))) fail.push("upload: no progressbar for site-survey.pdf");
    const now = async () => Number((await bar.getAttribute("aria-valuenow")) ?? -1);
    await page.waitForTimeout(300);
    const first = await now();
    await page.waitForTimeout(600);
    const second = await now();
    if (!(second > first && first >= 0)) fail.push(`upload: progress did not advance (${first} → ${second})`);
    await docs.getByRole("button", { name: "Cancel upload of site-survey.pdf" }).click();
    const surveyRow = docs.getByRole("listitem").filter({ hasText: "site-survey.pdf" });
    if (!(await until(async () => (await surveyRow.getByText("Cancelled").count()) === 1))) fail.push("cancel: no Cancelled state");
    if ((await bar.count()) !== 0) fail.push("cancel: the progressbar is still there");
    const retry = docs.getByRole("button", { name: "Retry upload of site-survey.pdf" });
    if (!(await isFocused(retry))) fail.push("cancel: focus did not stay in the row (Retry)");
    await page.waitForTimeout(3200);
    if ((await surveyRow.getByText("Cancelled").count()) !== 1) fail.push("cancel: a cancelled upload finished anyway");
    await retry.click();
    if (!(await until(async () => (await surveyRow.getByText("Uploaded").count()) === 1, 9000))) fail.push("retry: site-survey.pdf never finished");
    const hidden = await docs.locator('input[type="hidden"][name="documents"]').count();
    if (hidden !== 2) fail.push(`submission: ${hidden} hidden documents inputs, expected 2 (runbook + survey)`);

    await docInput.setInputFiles([file("q3-budget-corrupt.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 1_900_000)]);
    const budgetRow = docs.getByRole("listitem").filter({ hasText: "q3-budget-corrupt.xlsx" });
    if (!(await until(async () => (await budgetRow.getByText(/^Upload failed: /).count()) === 1, 9000))) fail.push("failure: no failure message");

    await docs.getByRole("button", { name: "Remove checkout-runbook-v3.pdf" }).click();
    const left = await rowNames(docs);
    if (left.includes("checkout-runbook-v3.pdf")) fail.push(`remove: the runbook is still listed ${left}`);
    if (!(await isFocused(docZone))) fail.push("remove: focus did not return to the zone");
    if ((await docs.locator('input[type="hidden"][name="documents"]').count()) !== 1) fail.push("remove: the runbook is still submitted");

    // ── 4: OTP ────────────────────────────────────────────────────────────
    await setView({ theme: "default", density: "comfortable", input: "fine" }, "form-otpinput");
    const card = page.locator('[data-testid="otp-verify"]');
    const textboxes = card.getByRole("textbox");
    const code = card.getByRole("textbox", { name: "Verification code , 6 digits", exact: true });
    if ((await textboxes.count()) !== 1 || (await code.count()) !== 1)
      fail.push(`otp: ${await textboxes.count()} textboxes in the card, ${await code.count()} named "Verification code , 6 digits"`);
    const boxes = () => card.locator("[data-otp-box]").evaluateAll((all) => all.map((b) => b.textContent).join(""));
    const active = () =>
      card.locator("[data-otp-box]").evaluateAll((all) => all.flatMap((b, i) => (b.hasAttribute("data-active") ? [i] : [])).join());
    await code.click();
    await code.evaluate((input) => {
      const data = new DataTransfer();
      data.setData("text/plain", "123-456");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    if ((await boxes()) !== "123456") fail.push(`otp paste: boxes read "${await boxes()}", expected 123456`);
    const wrong = card.getByText(/^That code is not right\./);
    if (!(await until(async () => (await wrong.count()) === 1))) fail.push("otp paste: no completion (no wrong-code message)");
    else if ((await wrong.textContent()) !== "That code is not right. 4 attempts left.")
      fail.push(`otp paste: completed more than once: "${await wrong.textContent()}"`);

    await code.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    if ((await code.inputValue()) !== "1234" || (await active()) !== "4")
      fail.push(`otp backspace: value ${await code.inputValue()}, active box ${await active()} (expected 1234, 4)`);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    if ((await active()) !== "2") fail.push(`otp arrows: active box ${await active()}, expected 2`);
    await page.keyboard.type("9");
    if ((await code.inputValue()) !== "1294" || (await active()) !== "3")
      fail.push(`otp replace: value ${await code.inputValue()}, active ${await active()} (expected 1294, 3)`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("246810");
    if (!(await until(async () => (await card.getByText("Verified. Signing you in…").count()) === 1)))
      fail.push(`otp: the right code did not verify (value ${await code.inputValue().catch(() => "gone")})`);

    // ── 5: coarse, 375 ────────────────────────────────────────────────────
    await page.setViewportSize({ width: 375, height: 800 });
    for (const anchor of ["form-fileupload", "form-otpinput"]) {
      await setView({ theme: "default", density: "compact", input: "coarse" }, anchor);
      const sizes = await page.locator(`#${anchor}`).evaluate((section) => {
        const zones = [...section.querySelectorAll(".r-form-upload-zone")].map((z) => z.getBoundingClientRect().height);
        const otp = [...section.querySelectorAll("[data-otp-box]")].map((b) => b.getBoundingClientRect().height);
        const spill = [section, ...section.querySelectorAll("*")]
          .filter((el) => {
            const cs = getComputedStyle(el);
            // A truncated file name is designed to clip (its full name is in `title`).
            return el.scrollWidth > el.clientWidth + 1 && ["auto", "scroll", "hidden"].includes(cs.overflowX) && cs.textOverflow !== "ellipsis";
          })
          .map((el) => el.className || el.tagName);
        return {
          zones,
          otp,
          spill,
          page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
          right: Math.max(...[...section.querySelectorAll(".r-form-upload-zone, .r-form-otp")].map((el) => el.getBoundingClientRect().right)),
          width: document.documentElement.clientWidth,
        };
      });
      if (sizes.zones.some((h) => h < 44) || sizes.otp.some((h) => h < 44))
        fail.push(`${anchor} coarse: a target under 44px ${JSON.stringify({ zones: sizes.zones, otp: sizes.otp })}`);
      if (anchor === "form-fileupload" && sizes.zones.length === 0) fail.push("coarse: no zones measured");
      if (anchor === "form-otpinput" && sizes.otp.length === 0) fail.push("coarse: no OTP boxes measured");
      if (sizes.page > 0 || sizes.spill.length > 0 || sizes.right > sizes.width)
        fail.push(`${anchor} 375: sideways overflow ${JSON.stringify({ page: sizes.page, spill: sizes.spill.slice(0, 3), right: sizes.right })}`);
    }
    // A row's remove button answers a press just outside its visible box.
    await setView({ theme: "default", density: "compact", input: "coarse" }, "form-fileupload");
    const remove = page.locator('[data-testid="upload-documents"]').getByRole("button", { name: "Remove checkout-runbook-v3.pdf" });
    const probe = await remove.evaluate((button) => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom + 4);
      return { visible: r.height, hit: hit === button || button.contains(hit) };
    });
    if (probe.visible >= 44 || !probe.hit) fail.push(`coarse: the remove button's hit area ${JSON.stringify(probe)}`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  }

  if (fail.length) throw new Error(`uploads-file-otp:\n  ${fail.join("\n  ")}`);
  return "one named zone; refusals describe the zone + Field invalid; progress advances, cancel aborts + keeps focus, retry uploads, failure shown, remove refocuses; OTP one textbox, paste fills 6 + completes once, Backspace/arrows/replace, verifies; coarse ≥44px, hit area, no spill at 375";
}
