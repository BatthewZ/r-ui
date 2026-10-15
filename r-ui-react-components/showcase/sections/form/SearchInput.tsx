import { useEffect, useMemo, useState } from "react";

import { Field, SearchInput } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "SearchInput",
  group: "form",
  order: 50,
  description:
    "Magnifier, a clear button while there is text, Escape clears (and an Escape on an empty field passes through). Loading swaps the magnifier for a spinner.",
};

const SERVICES = ["checkout-api", "payments-worker", "search-indexer", "auth-gateway", "notifications", "billing-cron"];

export default function SearchInputSection() {
  const [query, setQuery] = useState("pay");
  const [loading, setLoading] = useState(false);
  const results = useMemo(() => SERVICES.filter((s) => s.includes(query.trim().toLowerCase())), [query]);

  useEffect(() => {
    // A clear mid-search cancels the pending timer, so it must settle here.
    if (!query) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <Stack>
      <Row label="Controlled, filtering a list (simulated latency shows the loading state)">
        <div className="grid max-w-measure gap-r4">
          <Field>
            <Field.Label>Find a service</Field.Label>
            <SearchInput value={query} onValueChange={setQuery} loading={loading} placeholder="Service name" />
            <Field.Description>
              {results.length === 0 ? "No services match." : `${results.length} of ${SERVICES.length} services`}
            </Field.Description>
          </Field>
          <ul className="grid gap-r6 text-body-2 text-fg-secondary">
            {results.map((r) => (
              <li key={r} className="font-mono">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </Row>
      <Row label="Default name 'Search' · disabled · read-only · compact · RTL">
        <Grid>
          <SearchInput />
          <SearchInput disabled defaultValue="incidents" />
          <SearchInput readOnly defaultValue="status:open" aria-label="Saved filter" />
          <div data-density="compact">
            <SearchInput defaultValue="compact" />
          </div>
          <div dir="rtl">
            <SearchInput aria-label="بحث" placeholder="بحث" defaultValue="الدفع" labels={{ clear: "مسح" }} />
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
