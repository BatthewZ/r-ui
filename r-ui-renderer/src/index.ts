"use client";

// @batthewz/r-ui-renderer: the renderer. The validator is `./spec`, the
// parser alone is `./stream` (also re-exported here), icons are `./icons`.

export {
  ViewRenderer,
  type ViewRendererInput,
  type ViewRendererOptions,
  type ViewRendererProps,
} from "./ViewRenderer";
export { useViewSpecStream, type ViewSpecSource } from "./stream/use-view-spec-stream";
export * from "./stream";
export { type ComponentRegistry, defaultRegistry, extendRegistry, type RegistryEntry } from "./registry/registry";
export { defaultContracts, extendContracts } from "./contracts";
export type { RendererAdapters, SourceRequest, ToastRequest } from "./runtime/adapters";
export type { StreamingFallback } from "./runtime/context";
export type { IconComponentProps, IconSet } from "./icons/types";
export { findDiagnostics, type FoundDiagnostic } from "./diagnostics";
export type * from "./spec/types";
