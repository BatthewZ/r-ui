/**
 * `./examples` (React-free): the corpus, documents authored to model the
 * advice VIEWSPEC.md gives, since they are what a model learns the format from
 * (few-shot prompts take them from here). Product documents are pages a
 * real product could ship (realistic data: long names, negative, huge and
 * missing numbers, empty lists); coverage documents, one per component family,
 * together name every addressable component and part. Each name is its file's
 * stem. Data bindings whose endpoint starts with `/fixtures/` read
 * `playground/fixtures/`, and images come from `/fixtures/img/`.
 *
 * The documents are JSON as written, unchecked by the type system;
 * `exampleSpec` validates one on the way out.
 */

import { validateViewSpec } from "../spec/validate";
import type { ViewSpec } from "../spec/types";
import analyticsOverview from "./analytics-overview.json";
import coverageBuiltin from "./coverage/builtin.json";
import coverageCharts from "./coverage/charts.json";
import coverageContent from "./coverage/content.json";
import coverageData from "./coverage/data.json";
import coverageDates from "./coverage/dates.json";
import coverageDisclosure from "./coverage/disclosure.json";
import coverageFeedback from "./coverage/feedback.json";
import coverageFilters from "./coverage/filters.json";
import coverageForm from "./coverage/form.json";
import coverageLayout from "./coverage/layout.json";
import coverageMarketing from "./coverage/marketing.json";
import coverageMedia from "./coverage/media.json";
import coverageMotion from "./coverage/motion.json";
import coverageNavigation from "./coverage/navigation.json";
import coverageOverlays from "./coverage/overlays.json";
import coveragePrimitives from "./coverage/primitives.json";
import coverageSteps from "./coverage/steps.json";
import coverageToolbar from "./coverage/toolbar.json";
import incidentReport from "./incident-report.json";
import marketingPage from "./marketing-page.json";
import opsDashboard from "./ops-dashboard.json";
import releaseNotes from "./release-notes.json";
import settingsForm from "./settings-form.json";
import statusPage from "./status-page.json";
import teamDirectory from "./team-directory.json";

// The names are spelled out rather than inferred from the imports, so the
// published declarations stay a list of names instead of every document's
// inferred type.
export type ProductExampleName =
  | "analytics-overview"
  | "incident-report"
  | "marketing-page"
  | "ops-dashboard"
  | "release-notes"
  | "settings-form"
  | "status-page"
  | "team-directory";
export type CoverageExampleName =
  | "builtin"
  | "charts"
  | "content"
  | "data"
  | "dates"
  | "disclosure"
  | "feedback"
  | "filters"
  | "form"
  | "layout"
  | "marketing"
  | "media"
  | "motion"
  | "navigation"
  | "overlays"
  | "primitives"
  | "steps"
  | "toolbar";
export type ExampleName = ProductExampleName | CoverageExampleName;

/** Pages a real product could ship. */
export const PRODUCT_EXAMPLES: { readonly [name in ProductExampleName]: unknown } = {
  "analytics-overview": analyticsOverview,
  "incident-report": incidentReport,
  "marketing-page": marketingPage,
  "ops-dashboard": opsDashboard,
  "release-notes": releaseNotes,
  "settings-form": settingsForm,
  "status-page": statusPage,
  "team-directory": teamDirectory,
};

/** One document per component family; together they name every addressable component and part. */
export const COVERAGE_EXAMPLES: { readonly [name in CoverageExampleName]: unknown } = {
  builtin: coverageBuiltin,
  charts: coverageCharts,
  content: coverageContent,
  data: coverageData,
  dates: coverageDates,
  disclosure: coverageDisclosure,
  feedback: coverageFeedback,
  filters: coverageFilters,
  form: coverageForm,
  layout: coverageLayout,
  marketing: coverageMarketing,
  media: coverageMedia,
  motion: coverageMotion,
  navigation: coverageNavigation,
  overlays: coverageOverlays,
  primitives: coveragePrimitives,
  steps: coverageSteps,
  toolbar: coverageToolbar,
};

export const EXAMPLES: { readonly [name in ExampleName]: unknown } = { ...PRODUCT_EXAMPLES, ...COVERAGE_EXAMPLES };

export function isExampleName(name: string): name is ExampleName {
  return Object.hasOwn(EXAMPLES, name);
}

/** The document `name`, validated. Throws if it does not conform, which the corpus tests rule out. */
export function exampleSpec(name: ExampleName): ViewSpec {
  const result = validateViewSpec(EXAMPLES[name]);
  if (!result.ok) throw new Error(`The corpus document "${name}" does not conform: ${result.issues[0]?.message ?? ""}`);
  return result.spec;
}

/** The document `name` as the JSON text a model would write. */
export function exampleText(name: ExampleName): string {
  return `${JSON.stringify(EXAMPLES[name], null, 2)}\n`;
}
