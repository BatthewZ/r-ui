// @covers data, corpus
// @cost   10
//
// Browser check: a DataTable a document declares sorts when its header is
// pressed, through the column's `format` without sorting by the formatted text.
//
// On `?view=ops-dashboard`, in the "Production services" table (rows from the
// `/fixtures/ops-services.json` binding, sorted by error rate as the document
// asks):
//   1. the document's own sort holds: the header "Errors" carries
//      aria-sort="descending" and the rows follow error rate, highest first;
//   2. a real click on the "p95" header (firstDirection "desc") sorts by p95,
//      highest first, the service with no p95 last, and moves aria-sort there;
//   3. a second click reverses it.
async (page) => {
  const problems = [];
  await openView(page, "ops-dashboard");
  const table = page.getByRole("table", { name: "Production services" });
  await table.waitFor({ timeout: 5_000 });

  // The fixture's services and their p95, in milliseconds (null: no data).
  const P95 = {
    "Checkout API": 182,
    "Search indexer (catalogue, availability and price re-ranking pipeline)": 2340,
    Ledger: null,
    Notifications: 64,
    "Image resizer": 410,
    "Feature flags": 9,
  };
  const ERRORS_DESC = ["Ledger", "Search indexer (catalogue, availability and price re-ranking pipeline)", "Checkout API", "Feature flags"];
  const services = () =>
    table.evaluate((element) => [...element.querySelectorAll("tbody tr")].map((row) => (row.cells[0]?.textContent ?? "").trim()));
  const sortedBy = () => table.evaluate((element) => element.querySelector("th[aria-sort]")?.textContent?.trim() ?? null);
  const expectOrder = (label, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${label}: rows are ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  };

  // 1. the document's defaultSort (errorRate, desc); rows without an error rate follow
  const initial = await services();
  if (initial.length !== Object.keys(P95).length) problems.push(`harness: ${initial.length} rows, expected ${Object.keys(P95).length}`);
  expectOrder("by error rate", initial.slice(0, ERRORS_DESC.length), ERRORS_DESC);
  if (!(await sortedBy())?.startsWith("Errors")) problems.push(`aria-sort is on ${JSON.stringify(await sortedBy())}, not "Errors"`);

  // 2. p95, highest first, missing last
  const byP95 = (direction) => {
    const known = Object.keys(P95)
      .filter((name) => P95[name] !== null)
      .sort((a, b) => (direction === "desc" ? P95[b] - P95[a] : P95[a] - P95[b]));
    return [...known, "Ledger"];
  };
  const header = table.getByRole("button", { name: "p95" });
  await header.click();
  await frames(page);
  expectOrder("p95, first press", await services(), byP95("desc"));
  if (!(await sortedBy())?.startsWith("p95")) problems.push(`after a press on p95, aria-sort is on ${JSON.stringify(await sortedBy())}`);

  // 3. reversed
  await header.click();
  await frames(page);
  expectOrder("p95, second press", await services(), byP95("asc"));

  return report(problems, "the document's sort holds; p95 sorts down, then up, missing last");
};
