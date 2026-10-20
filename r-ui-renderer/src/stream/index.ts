// @batthewz/r-ui-renderer/stream: the incremental parser. React-free
// (verify:react-free); the React hook is exported from the package root.

export { PENDING, type Pending, isPending } from "./pending";
export type { PartialDocument, StreamError, StreamSnapshot } from "./snapshot";
export { createViewSpecParser, parsePartialViewSpec, type ViewSpecParser } from "./parser";
export { stripCodeFence } from "./fence";
