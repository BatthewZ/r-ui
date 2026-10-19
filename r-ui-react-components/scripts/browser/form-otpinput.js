// @covers   form/OTPInput
// @sections form-otpinput
// @tier     component
//
// Browser check: OTPInput's painted boxes and real layout, on the OTPInput section opened
// alone. Paste, Backspace, the arrows, replacing a box and completing once are
// `OTPInput.test.tsx`'s.
//
//   1. harness: the verify card holds exactly one textbox, named "Verification code ,
//      6 digits";
//   2. the masked PIN and a plain recovery code, focused with a box selected, paint no ink
//      they lack with the input at opacity 0 (each box one glyph; no pixel more than 16/255
//      apart), plain and forced colours, with an inked-text positive control;
//   3. at coarse input and 375px: every OTP box is at least 44px, and neither the section
//      nor the page scrolls sideways.
//
// Run it through `bun run browser:check form-otpinput`.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (view, width) => {
    const section = await openSection(page, "form-otpinput", { width, height: width === 375 ? 800 : undefined, view });
    await section.scrollIntoViewIfNeeded();
    await settle(page);
  };
  // run-code has no Buffer global; a response body is one, and its class decodes the shots.
  const NodeBuffer = (await (await page.request.get(base)).body()).constructor;

  try {
    // ── 1: harness ────────────────────────────────────────────────────────
    await load({ theme: "default", density: "comfortable", input: "fine" }, 1280);
    const card = page.locator('[data-testid="otp-verify"]');
    const textboxes = card.getByRole("textbox");
    const code = card.getByRole("textbox", { name: "Verification code , 6 digits", exact: true });
    if ((await textboxes.count()) !== 1 || (await code.count()) !== 1)
      fail.push(`otp: ${await textboxes.count()} textboxes in the card, ${await code.count()} named "Verification code , 6 digits"`);

    // ── 2: the boxes are the only ink, masked or not ─────────────────────
    // The real input lies over the boxes. A filled box is a one-character
    // selection, and the contract's ::selection once inked the input's own
    // character over the boxes (the masked PIN showed "••" in its first box).
    // The row as painted must show no ink the row with the input at opacity 0
    // (focus and selection kept) lacks, plain and forced. Pixels are compared
    // decoded: two PNG encodings of the same pixels differ in bytes.
    // Decoded here, not by drawing to a canvas: a canvas readback is not
    // bit-stable between two draws of the same pixels. 8-bit RGB / RGBA only,
    // which is what a screenshot is.
    const pixels = (png) =>
      page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(window.atob(b64), (c) => c.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        let width = 0;
        let height = 0;
        let channels = 0;
        const idat = [];
        for (let at = 8; at < bytes.length; ) {
          const length = view.getUint32(at);
          const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
          const body = bytes.subarray(at + 8, at + 8 + length);
          if (type === "IHDR") {
            width = view.getUint32(at + 8);
            height = view.getUint32(at + 12);
            if (body[8] !== 8 || (body[9] !== 2 && body[9] !== 6) || body[12] !== 0) throw new Error(`unsupported PNG ${[...body]}`);
            channels = body[9] === 6 ? 4 : 3;
          } else if (type === "IDAT") idat.push(body);
          at += 12 + length;
        }
        const inflated = new Uint8Array(await new window.Response(new window.Blob(idat).stream().pipeThrough(new window.DecompressionStream("deflate"))).arrayBuffer());
        const stride = width * channels;
        const out = new Uint8Array(stride * height);
        for (let y = 0; y < height; y += 1) {
          const filter = inflated[y * (stride + 1)];
          const src = y * (stride + 1) + 1;
          for (let x = 0; x < stride; x += 1) {
            const raw = inflated[src + x];
            const a = x >= channels ? out[y * stride + x - channels] : 0;
            const b = y > 0 ? out[(y - 1) * stride + x] : 0;
            const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
            const p = a + b - c;
            const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
            const predictor = [0, a, b, (a + b) >> 1, paeth][filter];
            if (predictor === undefined) throw new Error(`PNG filter ${filter}`);
            out[y * stride + x] = (raw + predictor) & 255;
          }
        }
        return { width, height, channels, data: Array.from(out) };
      }, NodeBuffer.from(png).toString("base64"));
    // Pixels where two shots differ by more than INK in some channel; -1 when they
    // are not the same size or empty. Toggling the input's opacity changes how the
    // layers blend, which moves anti-aliased box edges by a level or two (seen: at
    // most 2 of 255); a glyph's ink differs by far more.
    const INK = 16;
    const differing = (a, b) => {
      if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels || a.data.length === 0) return -1;
      let n = 0;
      for (let i = 0; i < a.data.length; i += a.channels)
        if (a.data.slice(i, i + a.channels).some((v, k) => Math.abs(v - b.data[i + k]) > INK)) n += 1;
      return n;
    };
    await page.mouse.move(0, 0);
    for (const { id, type, typed, glyphs } of [
      { id: "otp-pin", type: "password", typed: "4821", glyphs: ["•", "•", "•", "•"] },
      { id: "otp-recovery", type: "text", typed: "K7QD9X2M", glyphs: [..."K7QD9X2M"] },
    ]) {
      const field = page.locator(`[data-testid="${id}"]`);
      const input = field.locator("input");
      const row = field.locator(".r-form-otp");
      await row.scrollIntoViewIfNeeded();
      const setInputStyle = (style) =>
        input.evaluate((el, s) => {
          for (const [name, value] of Object.entries(s)) {
            if (value === null) el.style.removeProperty(name);
            else el.style.setProperty(name, value);
          }
        }, style);
      for (const forced of ["none", "active"]) {
        const what = `otp ${id} ${forced}`;
        await setView(page, { forced: forced === "active" });
        await input.fill("");
        await input.focus();
        await page.keyboard.type(typed);
        // Border-colour transitions settle before anything is compared.
        await settle(page);
        const state = await input.evaluate((el) => ({
          focused: document.activeElement === el,
          type: el.type,
          value: el.value,
          selected: (el.selectionEnd ?? 0) - (el.selectionStart ?? 0),
        }));
        if (!state.focused || state.type !== type || state.value !== typed || state.selected !== 1)
          fail.push(`${what}: harness: expected a focused ${type} field holding ${typed} with one character selected ${JSON.stringify(state)}`);
        const texts = await field.locator("[data-otp-box]").evaluateAll((all) => all.map((b) => b.textContent));
        if (JSON.stringify(texts) !== JSON.stringify(glyphs)) fail.push(`${what}: boxes read ${JSON.stringify(texts)}, expected one glyph each ${JSON.stringify(glyphs)}`);
        // The comparison is only fair if the row holds still between its shots: a demo above
        // that finishes (an upload row) shifts the page and the clip, which differs everywhere.
        // So the pair is taken over a box that did not move, and retaken if it did.
        const box = async () => JSON.stringify(await row.boundingBox());
        let clip;
        let asIs;
        let without;
        const shot = async () => pixels(await page.screenshot({ clip, animations: "disabled", caret: "initial" }));
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const before = await box();
          clip = JSON.parse(before);
          await setInputStyle({ opacity: null });
          asIs = await shot();
          await setInputStyle({ opacity: "0" });
          without = await shot();
          if ((await box()) === before) break;
          if (attempt === 2) fail.push(`${what}: harness: the row kept moving during the comparison`);
        }
        // Positive control: the same comparison sees the input's text once it is inked.
        await setInputStyle({ opacity: null, color: "red", "-webkit-text-fill-color": "red" });
        const inked = await shot();
        await setInputStyle({ color: null, "-webkit-text-fill-color": null });
        const controlDiff = differing(inked, without);
        const diff = differing(asIs, without);
        if (!(controlDiff > 0)) fail.push(`${what}: harness: inking the input's text changed ${controlDiff} pixels`);
        if (diff !== 0) fail.push(`${what}: the input paints over the boxes while focused (${diff} pixels: its selection, caret or text shows)`);
        if (!(await input.evaluate((el) => document.activeElement === el))) fail.push(`${what}: harness: the field lost focus during the comparison`);
      }
    }

    // ── 3: coarse, 375 ────────────────────────────────────────────────────
    await load({ theme: "default", density: "compact", input: "coarse" }, 375);
    const sizes = await page.locator("#form-otpinput").evaluate((section) => {
      const otp = [...section.querySelectorAll("[data-otp-box]")].map((b) => b.getBoundingClientRect().height);
      const spill = [section, ...section.querySelectorAll("*")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return el.scrollWidth > el.clientWidth + 1 && ["auto", "scroll", "hidden"].includes(cs.overflowX) && cs.textOverflow !== "ellipsis";
        })
        .map((el) => el.className || el.tagName);
      return {
        otp,
        spill,
        page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        right: Math.max(...[...section.querySelectorAll(".r-form-otp")].map((el) => el.getBoundingClientRect().right)),
        width: document.documentElement.clientWidth,
      };
    });
    if (sizes.otp.length === 0) fail.push("coarse: no OTP boxes measured");
    if (sizes.otp.some((h) => h < 44)) fail.push(`form-otpinput coarse: a target under 44px ${JSON.stringify({ otp: sizes.otp })}`);
    if (sizes.page > 0 || sizes.spill.length > 0 || sizes.right > sizes.width)
      fail.push(`form-otpinput 375: sideways overflow ${JSON.stringify({ page: sizes.page, spill: sizes.spill.slice(0, 3), right: sizes.right })}`);

    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`form-otpinput:\n  ${fail.join("\n  ")}`);
  return "form-otpinput OK one textbox; masked + plain OTP paint only their boxes (normal + forced); coarse ≥44px, no spill at 375";
}
