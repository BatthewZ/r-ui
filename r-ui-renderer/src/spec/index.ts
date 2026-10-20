// @batthewz/r-ui-renderer/spec: the format, its policy and its validator.
// React-free and free of the component library (verify:react-free), so a
// server, a worker or the CLI can import it.

export * from "./types";
export {
  CONSTRAINED_DATA_ATTRIBUTES,
  DATA_ATTRIBUTE_PATTERN,
  DROPPED_DATA_ATTRIBUTES,
  FORBIDDEN_PROPS,
  ID_REFERENCE_PROPS,
  IMAGE_URL_PROPS,
  isForbiddenProp,
  isIdReferenceProp,
  LIMITS,
  lowerCaseProp,
  URL_PROPS,
} from "./policy";
export {
  isAction,
  isActionName,
  isComponentNode,
  isCondNode,
  isEachNode,
  isFormatMarker,
  isHandler,
  isNodeMarker,
  isPlainObject,
  isRefMarker,
  type NodeKind,
  nodeKind,
} from "./guards";
export { parseRefPath, readRef, type RefPath, walkSegments } from "./ref-path";
export { appendPointer, parsePointer, toPointer } from "./pointer";
export { defaultAllowImageUrl, defaultAllowUrl, NO_LOCATION_BASE, resolveUrl, safeUrl } from "./url-policy";
export { BUILTIN_CONTRACTS } from "./builtins";
export { contractFor, defaultContracts, extendContracts } from "./contracts";
export { listComponentNames } from "./names";
export { type ValidateOptions, validateViewSpec } from "./validate";
export { type FormatIssuesOptions, formatIssuesForModel } from "./format-issues";
export { createValidationHandler, type ValidationHandlerOptions, type ValidationResponseBody } from "./handler";
