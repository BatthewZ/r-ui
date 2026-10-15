import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Combobox } from "./Combobox";
import { Field } from "./Field";
import { MultiSelect } from "./MultiSelect";
import { TagInput } from "./TagInput";
import { Form, useForm } from "./use-form";

const SERVICES = [
  { value: "api", label: "Payments API" },
  { value: "web", label: "Web frontend" },
];
const REGIONS = [
  { value: "eu", label: "Europe" },
  { value: "us", label: "US East" },
];

interface Filters {
  service: string;
  regions: string[];
  labels: string[];
}

function Filters({ onSubmit }: { onSubmit: (values: Filters) => void }) {
  const form = useForm<Filters>({ defaultValues: { service: "api", regions: ["eu"], labels: ["p1"] }, onSubmit });
  return (
    <Form form={form}>
      <Field name="service">
        <Field.Label>Service</Field.Label>
        <Combobox options={SERVICES} />
      </Field>
      <Field name="regions">
        <Field.Label>Regions</Field.Label>
        <MultiSelect options={REGIONS} />
      </Field>
      <Field name="labels">
        <Field.Label>Labels</Field.Label>
        <TagInput />
      </Field>
      <button type="submit">Apply</button>
    </Form>
  );
}

describe("selection inputs in a Form", () => {
  it("take their values from the form by Field name and write changes back", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container } = render(<Filters onSubmit={onSubmit} />);
    expect(screen.getByRole("combobox", { name: "Service" })).toHaveValue("Payments API");
    expect(screen.getByRole("button", { name: "Remove Europe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove p1" })).toBeInTheDocument();
    // The Field's name reaches the hidden inputs a native post reads.
    expect([...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((i) => [i.name, i.value])).toEqual([
      ["service", "api"],
      ["regions", "eu"],
      ["labels", "p1"],
    ]);

    await user.type(screen.getByRole("combobox", { name: "Service" }), "{Control>}a{/Control}web{Enter}");
    await user.type(screen.getByRole("combobox", { name: "Regions" }), "us{Enter}{Escape}");
    await user.type(screen.getByRole("textbox", { name: "Labels" }), "sev2{Enter}");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ service: "web", regions: ["eu", "us"], labels: ["p1", "sev2"] });
  });
});
