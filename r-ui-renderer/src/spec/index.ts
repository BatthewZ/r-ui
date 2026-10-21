// @batthewz/r-ui-renderer/spec: the format, its policy and its validator.
// React-free and free of the component library (verify:react-free), so a
// server, a worker or the CLI can import it.

export * from "./types";
export {
  DATA_ATTRIBUTE_PATTERN,
  DROPPED_DATA_ATTRIBUTES,
  FORBIDDEN_PROPS,
  ID_REFERENCE_PROPS,
  IMAGE_URL_PROPS,
  isForbiddenProp,
  LIMITS,
  URL_PROPS,
} from "./policy";
export { defaultAllowImageUrl, defaultAllowUrl, resolveUrl, safeUrl } from "./url-policy";
export { CLASS_VOCABULARY, ICON_NAMES } from "./vocabulary";
export { THEME_TOKENS, type ThemeToken } from "./theme";
export { contractFor, defaultContracts, extendContracts, NOT_ADDRESSABLE } from "../contracts";
export { stripCodeFence } from "../stream/fence";
export { type ValidateOptions, validateViewSpec } from "./validate";
export { type FormatIssuesOptions, formatIssuesForModel } from "./format-issues";
export { createValidationHandler, type ValidationHandlerOptions, type ValidationResponseBody } from "./handler";
