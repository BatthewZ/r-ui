// @covers forms, actions, corpus
// @cost   12
//
// Browser check: a document's form validates on submit, shows its error
// summary and moves focus to the first problem, then submits through the
// host's fetch once it is valid.
//
// On `?view=settings-form` (its values loaded from `/fixtures/workspace.json`):
//   1. the fields hold the loaded values (the form waited for its binding);
//   2. with the name emptied and the address invalid, a real click on "Save
//      settings" shows the ErrorSummary listing both problems by label, marks
//      both fields invalid, focuses the first invalid field, and requests nothing;
//   3. fixed, the same click sends one request to the save endpoint, the
//      document's `onSuccess` toast appears, and the summary is gone.
async (page) => {
  const problems = [];
  await openView(page, "settings-form");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save settings" }) });
  const name = form.getByLabel("Workspace name");
  const slug = form.getByLabel("Address");
  const save = form.getByRole("button", { name: "Save settings" });
  const summary = form.getByRole("alert").filter({ hasText: "Some settings need fixing" });

  // 1. loaded values
  if ((await name.inputValue()) !== "Northwind Logistics — EMEA Operations") problems.push(`the name field holds ${JSON.stringify(await name.inputValue())}`);
  if ((await slug.inputValue()) !== "northwind-emea") problems.push(`the address field holds ${JSON.stringify(await slug.inputValue())}`);

  const saves = [];
  const onRequest = (request) => {
    if (request.url().includes("/fixtures/settings-save.json")) saves.push(request.url());
  };
  page.on("request", onRequest);
  try {
    // 2. invalid: the summary, the marks, the focus, no request
    await name.fill("");
    await slug.fill("Northwind EMEA!");
    await save.click();
    await summary.waitFor({ timeout: 5_000 }).catch(() => problems.push("no error summary after an invalid submit"));
    const listed = (await summary.textContent().catch(() => "")) ?? "";
    for (const expected of ["Give the workspace a name.", "Use lowercase letters, digits and single hyphens."]) {
      if (!listed.includes(expected)) problems.push(`the summary does not list "${expected}"`);
    }
    for (const [label, field] of [["name", name], ["address", slug]]) {
      if ((await field.getAttribute("aria-invalid")) !== "true") problems.push(`the ${label} field is not marked invalid`);
    }
    if (!(await name.evaluate((element) => element === document.activeElement))) problems.push("focus did not move to the first invalid field");
    if (saves.length > 0) problems.push(`an invalid submit sent ${saves.length} request(s)`);

    // 3. valid: one request, the toast, no summary
    await name.fill("Northwind EMEA Operations");
    await slug.fill("northwind-emea-ops");
    await save.click();
    // The toast's text carries its tone for screen readers ("Success: Settings saved").
    await page
      .locator('[data-toast-id][data-tone="success"]')
      .filter({ hasText: /^Success: Settings saved$/ })
      .waitFor({ timeout: 5_000 })
      .catch(() => problems.push("no 'Settings saved' toast after a valid submit"));
    if (saves.length !== 1) problems.push(`a valid submit sent ${saves.length} requests, expected 1`);
    if (await summary.isVisible()) problems.push("the error summary is still showing after a valid submit");
  } finally {
    page.off("request", onRequest);
  }

  for (const d of await diagnostics(page)) problems.push(`diagnostic ${d.code} at ${d.path}: ${d.text}`);
  return report(problems, "invalid: summary, marks, focus, no request; valid: one request and the toast");
};
