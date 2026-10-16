import { render, renderHook, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { NumberInput } from "../components/form";
import { DEFAULT_PAGINATION_LABELS, Pagination } from "../components/navigation";
import { Alert } from "../components/primitives";
import { LocaleProvider, type LocaleProviderProps, mergeLabels, useLabels, useLocale } from "./locale";

// The registry keys this file names exist only where their declaring modules
// (each adds itself to LabelsRegistry) are in the type program: import them here,
// so the file type-checks on its own, whatever else the program holds.
import type {} from "../components/navigation/Pagination";
import type {} from "../components/overlays/Dialog";
import type {} from "../components/primitives/Alert";

const DEFAULTS = {
  close: "Close",
  count: (n: number) => `${n} items`,
  tones: { error: "Error", success: "Success" },
};

describe("mergeLabels", () => {
  it("returns the base untouched when nothing is given", () => {
    expect(mergeLabels(DEFAULTS, undefined)).toBe(DEFAULTS);
  });

  it("overrides strings and functions, and merges a map key by key", () => {
    const count = (n: number) => `${n} Einträge`;
    const merged = mergeLabels(DEFAULTS, { close: "Schließen", count, tones: { error: "Fehler" } });
    expect(merged).toEqual({ close: "Schließen", count, tones: { error: "Fehler", success: "Success" } });
    expect(DEFAULTS.tones.error).toBe("Error");
  });

  it("keeps the base for an explicit undefined, but honours an empty string", () => {
    const merged = mergeLabels(DEFAULTS, { close: undefined, tones: { error: "" } });
    expect(merged.close).toBe("Close");
    expect(merged.tones.error).toBe("");
  });
});

describe("useLabels", () => {
  it("is the defaults themselves, same object, with no provider and no prop", () => {
    const { result } = renderHook(() => useLabels("Pagination", DEFAULT_PAGINATION_LABELS));
    expect(result.current).toBe(DEFAULT_PAGINATION_LABELS);
  });

  it("layers defaults < provider < the instance's labels", () => {
    render(
      <LocaleProvider labels={{ Pagination: { nav: "Seiten", previous: "Zurück" } }}>
        <Pagination pageCount={3} defaultPage={2} labels={{ previous: "Vorherige Seite" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Seiten" })).toBeInTheDocument();
    // The instance beats the provider; the provider beats the default.
    expect(screen.getByRole("button", { name: "Vorherige Seite" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zurück" })).toBeNull();
    // Untouched by either: the default.
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("merges nested providers key by key, the inner one winning", () => {
    render(
      <LocaleProvider labels={{ Pagination: { nav: "Seiten", next: "Weiter" }, Alert: { tones: { error: "Fehler" } } }}>
        <LocaleProvider labels={{ Pagination: { nav: "Blättern" }, Alert: { tones: { warning: "Warnung" } } }}>
          <Pagination pageCount={3} defaultPage={2} />
          <Alert tone="error">Disk full</Alert>
          <Alert tone="warning">Disk filling</Alert>
          <Alert tone="success">Disk freed</Alert>
        </LocaleProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Blättern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
    // A map-valued label merges across providers too: each tone word from where it was set.
    expect(screen.getByText("Disk full").closest("[role]")).toHaveTextContent(/^Fehler/);
    expect(screen.getByText("Disk filling").closest("[role]")).toHaveTextContent(/^Warnung/);
    expect(screen.getByText("Disk freed").closest("[role]")).toHaveTextContent(/^Success/);
  });

  it("leaves a sibling outside the provider on its defaults", () => {
    render(
      <>
        <LocaleProvider labels={{ Pagination: { nav: "Seiten" } }}>
          <Pagination pageCount={2} />
        </LocaleProvider>
        <Pagination pageCount={2} />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Seiten" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });
});

describe("useLocale", () => {
  const wrap = (props: Omit<LocaleProviderProps, "children">) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <LocaleProvider {...props}>{children}</LocaleProvider>;
    };

  it("is undefined (Intl's runtime default) with no provider", () => {
    expect(renderHook(() => useLocale()).result.current).toBeUndefined();
  });

  it("takes the nearest provider's locale, an inner provider without one inheriting it, and a component's own prop over both", () => {
    expect(renderHook(() => useLocale(), { wrapper: wrap({ locale: "de-DE" }) }).result.current).toBe("de-DE");
    expect(renderHook(() => useLocale("en-GB"), { wrapper: wrap({ locale: "de-DE" }) }).result.current).toBe("en-GB");
    const nested = ({ children }: { children: ReactNode }) => (
      <LocaleProvider locale="de-DE">
        <LocaleProvider labels={{ Pagination: { nav: "Seiten" } }}>{children}</LocaleProvider>
      </LocaleProvider>
    );
    expect(renderHook(() => useLocale(), { wrapper: nested }).result.current).toBe("de-DE");
  });

  it("formats a component's numbers in the provider's locale unless its own `locale` says otherwise", () => {
    render(
      <LocaleProvider locale="de-DE">
        <Pagination pageCount={1200} defaultPage={1000} />
        <NumberInput aria-label="From the provider" defaultValue={1234.5} />
        <NumberInput aria-label="Its own" locale="en-US" defaultValue={1234.5} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Page 1.000" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("spinbutton", { name: "From the provider" })).toHaveValue("1.234,5");
    expect(screen.getByRole("spinbutton", { name: "Its own" })).toHaveValue("1,234.5");
  });
});

describe("LocaleProvider dir", () => {
  it("renders no element without `dir`", () => {
    const { container } = render(
      <LocaleProvider locale="de-DE">
        <p>Inhalt</p>
      </LocaleProvider>,
    );
    expect(container.firstElementChild?.tagName).toBe("P");
  });

  it("wraps the subtree in a display-contents element carrying `dir` and `lang`", () => {
    const { container } = render(
      <LocaleProvider locale="ar-EG" dir="rtl">
        <p>محتوى</p>
      </LocaleProvider>,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveAttribute("dir", "rtl");
    expect(wrapper).toHaveAttribute("lang", "ar-EG");
    expect(wrapper).toHaveClass("contents");
    expect(wrapper?.firstElementChild?.tagName).toBe("P");
  });
});

// Type-level contract, checked by `tsc` (`bun run typecheck`): each line under a
// `@ts-expect-error` must fail to compile, or the directive itself is an error.
// Never rendered: the claims are about the types.
export function TypeContract() {
  return (
    <>
      <LocaleProvider labels={{ Dialog: { close: "Schließen" }, Alert: { tones: { error: "Fehler" } } }} />
      <LocaleProvider
        labels={{
          // @ts-expect-error: no component registers the key "Dialgo"
          Dialgo: { close: "Schließen" },
        }}
      />
      <LocaleProvider
        labels={{
          Dialog: {
            // @ts-expect-error: Dialog's labels have no "clsoe"
            clsoe: "Schließen",
          },
        }}
      />
      <LocaleProvider
        labels={{
          Pagination: {
            // @ts-expect-error: a function label takes a function, not a string
            page: "Seite",
          },
        }}
      />
      <LocaleProvider
        labels={{
          Alert: {
            tones: {
              // @ts-expect-error: Alert's tone map has no "fatal"
              fatal: "Fatal",
            },
          },
        }}
      />
    </>
  );
}

export function useTypeContract() {
  useLabels("Pagination", DEFAULT_PAGINATION_LABELS, { nav: "Seiten" });
  // @ts-expect-error: the defaults must be the key's own labels
  useLabels("Dialog", DEFAULT_PAGINATION_LABELS);
  // @ts-expect-error: the instance labels must be the key's own labels
  useLabels("Pagination", DEFAULT_PAGINATION_LABELS, { close: "Schließen" });
}
