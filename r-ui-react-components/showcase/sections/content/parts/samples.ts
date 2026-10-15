/** Sample sources for the content demos. Kept in a subfolder, which the section registry does not glob. */
export const SNIPPETS = {
  ts: `import { type Request } from "./http";

/** Allow \`limit\` requests per window, per key. */
export function rateLimit(limit: number, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  return (req: Request): boolean => {
    const now = Date.now();
    const recent = (hits.get(req.key) ?? []).filter((t) => now - t < windowMs);
    hits.set(req.key, [...recent, now]);
    return recent.length < limit; // true: let it through
  };
}
`,
  json: `{
  "name": "@acme/dashboard",
  "version": "2.4.0",
  "private": true,
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "lowlight": "^3.3.0" }
}`,
  python: `@dataclass
class Invoice:
    total: float = 0.0

def overdue(invoices: list[Invoice], days=30) -> int:
    """Count invoices past due."""
    return sum(1 for i in invoices if i.total > 0 and days > 14)`,
  sql: `-- Top customers this quarter
SELECT c.name, SUM(o.total) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= '2026-07-01'
GROUP BY c.name
ORDER BY revenue DESC
LIMIT 10;`,
  diff: `--- a/rate-limit.ts
+++ b/rate-limit.ts
@@ -4,3 +4,3 @@
-export function rateLimit(limit: number) {
+export function rateLimit(limit: number, windowMs = 60_000) {
   const hits = new Map<string, number[]>();`,
  shell: `$ npm install @batthewz/r-ui-react-components lowlight
$ export API_URL="https://api.example.com"
$ curl -s "$API_URL/health" | jq .status`,
  html: `<!-- Embed the status widget -->
<script src="https://status.example.com/widget.js" defer></script>
<div class="status" data-theme="auto">Loading…</div>`,
};

export const LONG_LINE = `const url = "https://api.example.com/v2/organisations/acme-industries-international/projects/q4-revenue-forecast/reports/export?format=csv&include=line-items,taxes,discounts,refunds&timezone=Australia%2FSydney&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const short = 1;`;

/** One unbroken 2 500-character line: past the highlight budget, so it renders plain. */
export const OVER_BUDGET = `!function(){${"var a=1;".repeat(320)}}();`;

export const RELEASE_NOTES = `# Release 2.4

The **rate limiter** now takes a window, and the dashboard reads _live_ quotas. See the [upgrade guide](#/overview/content-codeblock) or the [changelog on GitHub](https://github.com/example/acme/releases).

## What changed

1. Limits are per key, not per IP.
2. Bursts are smoothed over \`windowMs\`.
   - Default: one minute
   - Minimum: one second
3. ~~Legacy tokens~~ are refused.

### Checklist

- [x] Migrate the gateway
- [x] Update the SDK
- [ ] Remove the legacy header

> Quotas reset at midnight UTC. A request that arrives during the reset is
> counted against the new day.

\`\`\`ts
const limit = rateLimit(100, 60_000);
if (!limit(req)) return tooManyRequests();
\`\`\`

| Plan | Requests / min | Price |
| :-- | --: | --: |
| Free | 60 | $0 |
| Team | 1,000 | $49 |
| Enterprise | Unlimited | Contact us |

---

![Quota chart](/assets/quota.png) An allowed image would load from \`/assets/\`; this one is not on the list.`;

const deepQuote = `${">".repeat(40)} Forty levels of quote, kept readable.`;
const deepList = Array.from({ length: 40 }, (_, k) => `${"  ".repeat(k)}- level ${k + 1}`).join("\n");
const hugeTable = [
  `| ${Array.from({ length: 24 }, (_, k) => `Column ${k + 1}`).join(" | ")} |`,
  `|${" --- |".repeat(24)}`,
  ...Array.from({ length: 40 }, (_, r) => `| ${Array.from({ length: 24 }, (_, k) => `r${r + 1}c${k + 1}`).join(" | ")} |`),
].join("\n");

export const HOSTILE = `## <script>alert("heading")</script>

<script>alert(1)</script>

<img src=x onerror="alert(2)"> <iframe src="https://evil.example"></iframe>

[a javascript: link](javascript:alert(3)) · [shouty](JAVASCRIPT:alert(4)) · [tabbed](java	script:alert(5)) · [data](data:text/html,<script>alert(6)</script>) · <javascript:alert(7)> · [ok](https://example.com)

![tracking pixel](https://evil.example/pixel.gif?user=42)

Unbroken: Supercalifragilisticexpialidocious_and_then_some_more_text_without_any_break_opportunity_whatsoever_${"x".repeat(80)}

${deepQuote}

${deepList}

${hugeTable}

<!-- a comment that must not show -->
\`\`\`
${"y".repeat(400)}
\`\`\``;
