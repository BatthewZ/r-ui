// @covers density, corpus
// @cost   10
//
// Browser check: the host's density wins over the document's, both ways, and
// compact rows are shorter than comfortable ones.
//
// Row heights are measured on rendered table rows:
//   1. analytics-overview declares no density: its "Top countries" rows with
//      the host at `density=compact` are shorter than with no host density
//      (comfortable, the default);
//   2. ops-dashboard declares `"density": "compact"`: with no host density its
//      service rows are compact (shorter than with the host at
//      `density=comfortable`) and equal to the host at `density=compact`.
async (page) => {
  const problems = [];
  const rowHeight = async (name, params, tableName) => {
    await openView(page, name, params);
    const table = page.getByRole("table", { name: tableName });
    await table.waitFor({ state: "attached", timeout: 5_000 });
    const height = await table.evaluate((element) => element.querySelector("tbody tr")?.getBoundingClientRect().height ?? 0);
    if (!(height > 0)) throw new Error(`harness: ${name} ${JSON.stringify(params)}: "${tableName}" has no rendered row`);
    return Math.round(height * 100) / 100;
  };

  // 1. a document without a density follows the host
  const countries = "Sessions and revenue by country";
  const plain = await rowHeight("analytics-overview", {}, countries);
  const hostCompact = await rowHeight("analytics-overview", { density: "compact" }, countries);
  if (!(hostCompact < plain)) problems.push(`analytics-overview: rows ${hostCompact}px with the host compact, ${plain}px without; compact is not shorter`);

  // 2. the host overrides a document's compact, and its own compact matches the document's
  const services = "Production services";
  const own = await rowHeight("ops-dashboard", {}, services);
  const comfortable = await rowHeight("ops-dashboard", { density: "comfortable" }, services);
  const compact = await rowHeight("ops-dashboard", { density: "compact" }, services);
  if (!(own < comfortable)) problems.push(`ops-dashboard: its own compact rows are ${own}px, the host's comfortable ${comfortable}px; the host did not win`);
  if (own !== compact) problems.push(`ops-dashboard: its own compact rows are ${own}px, the host's compact ${compact}px`);

  return report(problems, `rows: ${plain}px → ${hostCompact}px (host compact); ops ${own}px own, ${comfortable}px host comfortable`);
};
