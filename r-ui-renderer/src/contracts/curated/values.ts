/**
 * Values a document writes as JSON that the library takes in another shape:
 * dates, icons, Sets, formatters, row templates, coerced props, the props the
 * renderer adds, and what each callback reports as `event.value`.
 */

import type { PropDoc } from "../../spec/types";
import type { CuratedTable } from "./table";

/** ISO text that becomes a `Date` (or a `{ start, end }` range of them). */
export const DATE_PROPS: CuratedTable<"dateProps"> = {
  Calendar: { value: "date", defaultValue: "date", month: "date", defaultMonth: "date", min: "date", max: "date" },
  RangeCalendar: {
    value: "dateRange",
    defaultValue: "dateRange",
    month: "date",
    defaultMonth: "date",
    min: "date",
    max: "date",
  },
  DatePicker: { value: "date", defaultValue: "date", min: "date", max: "date" },
  DateRangePicker: { value: "dateRange", defaultValue: "dateRange", min: "date", max: "date", now: "datetime" },
  // A picked range keeps its `allDay`; its ends are dates or date-times as written.
  EventCalendar: { date: "date", defaultDate: "date", now: "datetime", selection: "dateRange", defaultSelection: "dateRange" },
  // A dateRange filter's value is a range of Dates; other kinds' values are not ISO ranges and pass as they are.
  FilterBar: {
    now: "datetime",
    "filters[].min": "date",
    "filters[].max": "date",
    "value.*": "dateRange",
    "defaultValue.*": "dateRange",
  },
  Timeline: { now: "datetime" },
  ActivityFeed: { now: "datetime" },
  // ISO-shaped x values only; the library would read a bare date as UTC midnight.
  LineChart: { "x[]": "datetime" },
  BarChart: { "x[]": "datetime" },
};

/**
 * Paths typed to take a Date that the library already reads from ISO text
 * (a bare date as a local calendar date), so the renderer leaves them alone.
 */
export const DATES_READ_AS_TEXT: { readonly [name: string]: readonly string[] } = {
  // An instant, or `YYYY-MM-DD` for an all-day event (its `end` the last day).
  EventCalendar: ["events[].start", "events[].end"],
  Timeline: ["events[].time"],
  ActivityFeed: ["items[].time"],
};

const TRIGGER_ICONS = ["iconStart", "iconEnd"];

/** Props where an icon name string becomes the icon (a `$node` still works). Top-level props only. */
export const ICON_PROPS: CuratedTable<"iconProps"> = {
  Alert: ["icon"],
  Badge: ["icon"],
  Banner: ["icon"],
  Button: TRIGGER_ICONS,
  "Collapsible.Trigger": TRIGGER_ICONS,
  "Dialog.Trigger": TRIGGER_ICONS,
  "Dialog.Close": TRIGGER_ICONS,
  "Drawer.Trigger": TRIGGER_ICONS,
  "Drawer.Close": TRIGGER_ICONS,
  "Popover.Trigger": TRIGGER_ICONS,
  "Popover.Close": TRIGGER_ICONS,
  "DropdownMenu.Trigger": TRIGGER_ICONS,
  "DropdownMenu.Item": ["icon"],
  EmptyState: ["icon"],
  "FeatureGrid.Item": ["icon"],
  "Field.Error": ["icon"],
  "FormActions.Submit": TRIGGER_ICONS,
  "HoverCard.Toggle": ["icon"],
  IconButton: ["icon"],
  "NavList.Item": ["icon"],
  Rating: ["icon"],
  "SegmentedControl.Item": ["icon"],
  StatusLabel: ["icon"],
  "Tabs.Tab": ["icon"],
  "ToggleGroup.Item": ["icon"],
};

/** Arrays that become Sets. */
export const SET_PROPS: CuratedTable<"setProps"> = {
  DataTable: [
    "selectedKeys",
    "defaultSelectedKeys",
    "expandedKeys",
    "defaultExpandedKeys",
    "visibleColumns",
    "defaultVisibleColumns",
  ],
  VirtualizedTable: ["selectedKeys", "defaultSelectedKeys", "visibleColumns", "defaultVisibleColumns"],
};

/** Formatter functions a FormatSpec replaces. */
export const FORMAT_PROPS: CuratedTable<"formatProps"> = {
  StatCard: ["formatDelta"],
  Sparkline: ["format"],
  LineChart: ["format", "formatTick", "formatX"],
  BarChart: ["format", "formatTick"],
  Heatmap: ["format"],
  CountUp: ["format"],
};

const ROW = ["row", "rowIndex"];
const CELL = ["row", "rowIndex", "value"];

/** Row templates: a `$node` the renderer turns into the function the component calls, with these names in scope. */
export const TEMPLATE_PROPS: CuratedTable<"templateProps"> = {
  DataTable: { rowActions: ROW, renderDetail: ROW, bulkActions: ["selectedKeys"], "columns[].cell": CELL },
  VirtualizedTable: { rowActions: ROW, bulkActions: ["selectedKeys"], "columns[].cell": CELL },
};

/** Document props the library takes in another shape (or under another name). */
export const COERCIONS: CuratedTable<"coercions"> = {
  DataTable: {
    columns: { kind: "columns" },
    rowKey: { kind: "accessor", to: "getRowKey" },
    rowLabel: { kind: "accessor", to: "getRowLabel" },
  },
  VirtualizedTable: {
    columns: { kind: "columns" },
    rowKey: { kind: "accessor", to: "getRowKey" },
    rowLabel: { kind: "accessor", to: "getRowLabel" },
  },
  TagInput: { delimiter: { kind: "delimiter" } },
  Select: { options: { kind: "options" } },
};

/** Callbacks whose first argument is not plain JSON; every other callback reports `value`. */
export const EVENT_VALUES: CuratedTable<"eventValue"> = {
  Calendar: { onValueChange: "date", onMonthChange: "date" },
  RangeCalendar: { onValueChange: "dateRange", onMonthChange: "date" },
  DatePicker: { onValueChange: "date" },
  DateRangePicker: { onValueChange: "dateRange" },
  // The pressed event as the document wrote it (its times are text); a Date in one would be an
  // instant. A pick or a change says its ends as instants (a timed range keeps its times; an
  // all-day one, with `allDay`, is local midnights, which the calendar reads back as those days).
  EventCalendar: { onDateChange: "date", onEventClick: "datetime", onSelectionChange: "datetime", onEventChange: "datetime" },
  DataTable: { onSelectedKeysChange: "set", onExpandedKeysChange: "set", onVisibleColumnsChange: "set" },
  VirtualizedTable: { onSelectedKeysChange: "set", onVisibleColumnsChange: "set" },
};

const ROW_KEY: PropDoc = {
  name: "rowKey",
  type: "string",
  required: false,
  description: "A field path whose value identifies a row (`\"id\"`); the row's position when absent.",
};
const ROW_LABEL: PropDoc = {
  name: "rowLabel",
  type: "string",
  required: false,
  description: "A field path whose value names a row for assistive tech; the first column's text when absent.",
};
const COLUMNS: PropDoc = {
  name: "columns",
  type: "readonly DataTableColumnSpec[]",
  required: true,
  description: "The columns, as data (see DataTable columns).",
};
const DIALOG_ID: PropDoc = {
  name: "dialogId",
  type: "string",
  required: false,
  description: "The name `openDialog` and `closeDialog` address.",
};

/**
 * Props the document writes that the library does not declare (the renderer
 * turns them into the library's), and document shapes that replace a
 * declared prop's type under the same name.
 */
export const DOCUMENT_PROPS: { readonly [name: string]: readonly PropDoc[] } = {
  DataTable: [COLUMNS, ROW_KEY, ROW_LABEL],
  VirtualizedTable: [COLUMNS, ROW_KEY, ROW_LABEL],
  Select: [
    {
      name: "options",
      type: "readonly { value: string; label: string; disabled?: boolean }[]",
      required: false,
      description: "The choices, rendered as the select's options.",
    },
  ],
  TagInput: [
    {
      name: "delimiter",
      type: "string",
      required: false,
      description: "Characters that end a tag as it is typed (`\",;\"`).",
    },
  ],
  Dialog: [DIALOG_ID],
  Drawer: [DIALOG_ID],
};
