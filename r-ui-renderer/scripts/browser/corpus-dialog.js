// @covers overlays, forms, actions
// @cost   15
//
// Browser check: a dialog a document opens with `openDialog` is a real modal,
// interactive, and closes on Escape (jsdom has no top layer, no inert and no
// hit testing, so only a browser can show this).
//
// On `?view=settings-form`, the "Delete workspace…" button (a Button whose
// onClick is `openDialog`) opens the `deleteWorkspace` alert dialog:
//   1. it is open, modal (`:modal`, so in the top layer), and the point at the
//      centre of its checkbox hits the dialog, while the page behind is inert:
//      the point at the opening button hits something else;
//   2. a real click on the checkbox ticks it (Playwright's click fails on an
//      element something else covers);
//   3. Escape closes it, and focus returns to the button that opened it;
//   4. reopened, its form refuses to submit unticked (the field's error shows
//      in the dialog and nothing is requested), then, ticked, submits: the
//      DELETE goes out, the dialog closes and the view navigates (the
//      playground's navigate adapter writes the hash).
async (page) => {
  const problems = [];
  await openView(page, "settings-form");
  const opener = page.getByRole("button", { name: "Delete workspace…" });
  const dialog = page.getByRole("alertdialog", { name: "Delete this workspace?" });
  const checkbox = dialog.getByRole("checkbox", { name: /I understand/ });
  const state = () =>
    dialog.evaluate((element) => ({ open: element.hasAttribute("open"), modal: element.matches(":modal") }));
  const hits = async (locator, target) => {
    const box = await locator.boundingBox();
    if (!box) return null;
    return target.evaluate((element, [x, y]) => element.contains(document.elementFromPoint(x, y)), [box.x + box.width / 2, box.y + box.height / 2]);
  };

  // 1. open, modal, hit-testable; the page behind inert
  const openerBox = await opener.boundingBox();
  await opener.click();
  await dialog.waitFor({ state: "visible", timeout: 5_000 });
  const opened = await state();
  if (!opened.open || !opened.modal) problems.push(`the dialog is ${opened.open ? "open but not modal" : "not open"}`);
  if ((await hits(checkbox, dialog)) !== true) problems.push("the point at the checkbox's centre does not hit the dialog");
  if (openerBox) {
    const behind = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null, [
      openerBox.x + openerBox.width / 2,
      openerBox.y + openerBox.height / 2,
    ]);
    if (behind === "Delete workspace…") problems.push("the page behind the modal still takes the pointer at the opening button");
  }

  // 2. a real click ticks the checkbox
  await checkbox.click({ timeout: 5_000 });
  if (!(await checkbox.isChecked())) problems.push("a click on the checkbox did not tick it");

  // 3. Escape closes it and returns focus
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => problems.push("Escape did not close the dialog"));
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? null);
  if (focused !== "Delete workspace…") problems.push(`after Escape, focus is on ${JSON.stringify(focused)}, not the opening button`);

  // 4. the dialog's form: refused unticked, submitted ticked
  const deletes = [];
  const onRequest = (request) => {
    if (request.url().includes("/fixtures/settings-save.json")) deletes.push(request.url());
  };
  page.on("request", onRequest);
  try {
    await opener.click();
    await dialog.waitFor({ state: "visible", timeout: 5_000 });
    if (await checkbox.isChecked()) await checkbox.click();
    const submit = dialog.getByRole("button", { name: "Delete workspace", exact: true });
    await submit.click();
    await dialog
      .getByText("Confirm that you understand this cannot be undone.")
      .waitFor({ timeout: 5_000 })
      .catch(() => problems.push("submitting unticked showed no error in the dialog"));
    if (deletes.length > 0) problems.push("submitting unticked sent a request");
    if (!(await state()).open) problems.push("submitting unticked closed the dialog");

    await checkbox.click();
    await submit.click();
    await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => problems.push("a valid submit did not close the dialog"));
    await page.waitForFunction(() => location.hash === "#/workspaces", null, { timeout: 5_000 }).catch(() => problems.push("a valid submit did not navigate"));
    if (deletes.length !== 1) problems.push(`a valid submit sent ${deletes.length} requests, expected the one DELETE`);
  } finally {
    page.off("request", onRequest);
  }

  for (const d of unledgered("settings-form", await diagnostics(page))) problems.push(`diagnostic ${d.code} at ${d.path}: ${d.text}`);
  return report(problems, "modal in the top layer, the page behind inert, a real click, Escape closes, the form inside validates and submits");
};
