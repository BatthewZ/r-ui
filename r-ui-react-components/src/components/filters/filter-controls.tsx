"use client";
import { type DateRange, DateRangePicker } from "../dates";
import { Combobox, Field, MultiSelect, RangeSlider, SearchInput, Select, TagInput, useField } from "../form";
import { ToggleGroup } from "../toolbar";
import { formatNumber } from "../../util/format";
import { cn } from "../../util/style";

import { clampRange, type CustomFilterDefinition, type FilterControlProps, type FilterDefinition, type FilterKind } from "./filter-model";

/** How wide a control starts in the bar's wrapping row before the row shares out what is left. */
const BASIS: Record<FilterKind, string> = {
  select: "basis-column-sm",
  search: "basis-column-md",
  multi: "basis-column-md",
  range: "basis-column-md",
  dateRange: "basis-column-md",
  toggle: "basis-column-lg",
  custom: "basis-column-md",
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export interface FilterFieldProps {
  def: FilterDefinition;
  /** The filter's value as the bar holds it (`undefined` while not applied). */
  value: unknown;
  onValueChange: (value: unknown) => void;
  disabled: boolean;
  /** The "no filter" choice of a select. */
  anyLabel: string;
  locale: string | undefined;
  className?: string;
}

/**
 * One filter as a labelled control: a `Field` whose label names the control
 * inside, so every kind is named the same way. Every control is controlled
 * from its first render (an empty value is `""`, `[]`, `null` or the whole
 * scale, never `undefined`), so a chip's removal reaches it.
 */
export function FilterField({ def, value, onValueChange, disabled, anyLabel, locale, className }: FilterFieldProps) {
  return (
    <Field disabled={disabled || def.disabled === true} data-filter={def.id} className={cn("min-w-0 grow", BASIS[def.kind], className)}>
      <Field.Label>{def.label}</Field.Label>
      <FilterInput def={def} value={value} onValueChange={onValueChange} disabled={disabled} anyLabel={anyLabel} locale={locale} />
    </Field>
  );
}

function FilterInput({ def, value, onValueChange, disabled, anyLabel, locale }: Omit<FilterFieldProps, "className">) {
  switch (def.kind) {
    case "select":
      return def.searchable ? (
        <Combobox
          options={def.options}
          value={asString(value) || null}
          onValueChange={(next) => onValueChange(next ?? undefined)}
          placeholder={def.placeholder ?? anyLabel}
          loading={def.loading}
          loadError={def.loadError}
        />
      ) : (
        <Select value={asString(value)} onValueChange={onValueChange}>
          <option value="">{def.placeholder ?? anyLabel}</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case "multi":
      return def.creatable ? (
        <TagInput value={asList(value)} onValueChange={onValueChange} suggestions={def.options} placeholder={def.placeholder} />
      ) : (
        <MultiSelect
          options={def.options}
          value={asList(value)}
          onValueChange={onValueChange}
          placeholder={def.placeholder ?? anyLabel}
          selectAll={def.selectAll}
          loading={def.loading}
          loadError={def.loadError}
        />
      );
    case "range": {
      const write = (n: number) => formatNumber(n, { locale, ...def.formatOptions });
      return (
        <RangeSlider
          min={def.min}
          max={def.max}
          step={def.step}
          value={clampRange(def, value) ?? [def.min, def.max]}
          onValueChange={onValueChange}
          locale={locale}
          formatOptions={def.formatOptions}
          showValue
          marks={[
            { value: def.min, label: write(def.min) },
            { value: def.max, label: write(def.max) },
          ]}
        />
      );
    }
    case "dateRange":
      return (
        <DateRangePicker
          value={(value as DateRange<Date> | undefined) ?? null}
          onValueChange={(next) => onValueChange(next ?? undefined)}
          withTime={def.withTime}
          presets={def.presets}
          min={def.min}
          max={def.max}
          locale={locale}
          className="flex"
        />
      );
    case "toggle": {
      const list = asList(value);
      const items = def.options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </ToggleGroup.Item>
      ));
      return def.exclusive ? (
        <ToggleGroup type="single" value={list[0] ?? ""} onValueChange={(next) => onValueChange([next])}>
          {items}
        </ToggleGroup>
      ) : (
        <ToggleGroup type="multiple" value={list} onValueChange={onValueChange}>
          {items}
        </ToggleGroup>
      );
    }
    case "search":
      return <SearchInput value={asString(value)} onValueChange={onValueChange} placeholder={def.placeholder} />;
    case "custom":
      return <CustomInput def={def} value={value} onValueChange={onValueChange} disabled={disabled || def.disabled === true} />;
  }
}

/** A caller's control, given the Field's control id so a plain element is named by the label too. */
function CustomInput({
  def,
  ...control
}: { def: CustomFilterDefinition } & Omit<FilterControlProps, "label" | "id">) {
  const field = useField();
  return def.render({ ...control, label: def.label, id: field?.controlId ?? def.id });
}
