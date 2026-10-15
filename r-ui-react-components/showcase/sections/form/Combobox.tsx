import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Combobox, type ComboboxOption, Field } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";
import { HOSTS, SERVICES } from "./parts/selection-data";

export const meta = {
  title: "Combobox",
  group: "form",
  order: 110,
  description:
    "An editable combobox (APG): type to filter (case and accents ignored, the match in bold), arrows / Home / End, Enter or Tab to choose, Escape closes then clears. Groups, descriptions, icons, disabled options, free text, async results and a 5,000-row windowed list.",
};

const ALL_REPOS = ["r-ui", "r-ui-css", "r-ui-tw-merge", "response-dashboard", "checkout-service", "ledger", "search-indexer"];

/** Simulated server search: 500ms latency, "fail" fails. */
function AsyncRepos() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ loading: boolean; error?: string; options: ComboboxOption[] }>({
    loading: false,
    options: [],
  });
  useEffect(() => {
    if (query.trim() === "") {
      setState({ loading: false, options: [] });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: undefined }));
    const t = window.setTimeout(() => {
      if (query.includes("fail")) setState({ loading: false, error: "Could not reach the repository index.", options: [] });
      else
        setState({
          loading: false,
          options: ALL_REPOS.filter((r) => r.includes(query.trim().toLowerCase())).map((r) => ({ value: r, label: r })),
        });
    }, 500);
    return () => window.clearTimeout(t);
  }, [query]);
  return (
    <Field>
      <Field.Label>Repository</Field.Label>
      <Combobox
        filter={false}
        options={state.options}
        loading={state.loading}
        loadError={state.error}
        onInputChange={(text, reason) => {
          if (reason === "input") setQuery(text);
        }}
        start={<Search aria-hidden />}
        placeholder="Search repositories"
        messages={{ empty: query.trim() === "" ? "Type to search" : "No repositories match" }}
      />
      <Field.Description>Results arrive after 500ms; type “fail” to see the error state.</Field.Description>
    </Field>
  );
}

export default function ComboboxSection() {
  const [service, setService] = useState<string | null>("checkout-api");
  return (
    <Stack>
      <Row label="Groups, descriptions, icons, a disabled option · controlled · free text">
        <Grid>
          <Field required>
            <Field.Label>Service</Field.Label>
            <Combobox options={SERVICES} value={service} onValueChange={(v) => setService(v)} name="service" />
            <Field.Description>Value: {service ?? "—"}</Field.Description>
          </Field>
          <Field>
            <Field.Label>Owner team</Field.Label>
            <Combobox
              allowCustomValue
              placeholder="Pick or type a team"
              options={["Payments", "Discovery", "Edge", "Platform"].map((t) => ({ value: t.toLowerCase(), label: t }))}
            />
            <Field.Description>Type a new name to get “Use …”.</Field.Description>
          </Field>
          <AsyncRepos />
        </Grid>
      </Row>
      <Row label="5,000 options, windowed (only the visible rows are mounted)">
        <Grid>
          <Field>
            <Field.Label>Host</Field.Label>
            <Combobox options={HOSTS} placeholder="ip-10-…" />
          </Field>
        </Grid>
      </Row>
      <Row label="States: invalid · disabled · read-only">
        <Grid>
          <Field>
            <Field.Label>Failover service</Field.Label>
            <Combobox options={SERVICES} defaultValue="checkout-api" />
            <Field.Error>Must differ from the primary service.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Service</Field.Label>
            <Combobox options={SERVICES} defaultValue="ledger-db" />
          </Field>
          <Field readOnly>
            <Field.Label>Service</Field.Label>
            <Combobox options={SERVICES} defaultValue="search-api" />
            <Field.Description>Set when the incident opened.</Field.Description>
          </Field>
        </Grid>
      </Row>
      <Row label="Compact subtree · RTL">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Service</Field.Label>
              <Combobox options={SERVICES} defaultValue="edge-zurich" />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>خدمة</Field.Label>
              <Combobox
                options={[
                  { value: "a", label: "واجهة الدفع", description: "HTTP" },
                  { value: "b", label: "قاعدة البيانات", description: "أساسية" },
                  { value: "c", label: "محرك البحث" },
                ]}
                defaultValue="a"
              />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
