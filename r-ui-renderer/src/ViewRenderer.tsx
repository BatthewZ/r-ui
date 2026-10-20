"use client";

import { useLocale } from "@batthewz/r-ui-react-components";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import { DIAGNOSTIC_CLASSES } from "./diagnostics";
import { FormsRoot } from "./forms/FormsRoot";
import type { IconSet } from "./icons/types";
import { type ComponentRegistry, defaultRegistry, listRegistryNames } from "./registry/registry";
import { formatWith } from "./render/format";
import { IconSetContext } from "./render/icon-context";
import { IssueLog } from "./render/IssueLog";
import { renderNode } from "./render/render-node";
import { createRootScope, type ViewEnv } from "./render/scope";
import type { RendererAdapters } from "./runtime/adapters";
import type { StreamingFallback, StreamingState } from "./runtime/context";
import type { FormatValue } from "./runtime/resolve";
import { useViewRuntime } from "./runtime/use-view-runtime";
import { defaultContracts } from "./contracts";
import { isPlainObject } from "./spec/guards";
import {
  type ComponentContracts,
  DENSITIES,
  type Density,
  type Issue,
  ISSUE_CODE_INFO,
  type ValidationResult,
  type ViewSpec,
} from "./spec/types";
import { validateViewSpec } from "./spec/validate";
import type { PartialDocument, StreamSnapshot } from "./stream/snapshot";
import { useTextStream } from "./stream/use-view-spec-stream";

/** One of three inputs, fixed for the life of the element. */
export type ViewRendererInput =
  /** A whole document (parsed JSON). */
  | { readonly spec: ViewSpec; readonly text?: undefined; readonly complete?: undefined; readonly stream?: undefined }
  /** A growing string; `complete` once it has all arrived. */
  | { readonly text: string; readonly complete?: boolean; readonly spec?: undefined; readonly stream?: undefined }
  /** Snapshots from `useViewSpecStream`. */
  | { readonly stream: StreamSnapshot; readonly spec?: undefined; readonly text?: undefined; readonly complete?: undefined };

export interface ViewRendererOptions {
  /** Navigation, toasts, network, named sources and the URL policies. No network without `fetch`. */
  readonly adapters?: RendererAdapters;
  /** The library's components and the built-ins when absent. Extend it with `extendRegistry`. */
  readonly registry?: ComponentRegistry;
  /** What each name means beyond constructing it. Extend it with `extendContracts` beside the registry. */
  readonly contracts?: ComponentContracts;
  /** Icon name → component, for `Icon` nodes and icon-name props (`@batthewz/r-ui-renderer/icons` is one). */
  readonly icons?: IconSet;
  /** Wins over the document's `density`. */
  readonly density?: Density;
  /** Allows sensitive components (`PasswordInput`, `OTPInput`): all, or the listed names. */
  readonly allowSensitive?: boolean | readonly string[];
  /**
   * Where Markdown may load images from: absolute URL prefixes
   * (`https://cdn.example.com/img/`) or root-relative path prefixes
   * (`/assets/`). None by default, so Markdown images show their alt text.
   */
  readonly markdownImageAllowlist?: readonly string[];
  /** What a node still streaming renders: nothing, or a Skeleton. */
  readonly streamingFallback?: StreamingFallback;
  /** Every issue found while rendering and running the view. */
  readonly onIssue?: (issue: Issue) => void;
  /** With it, the completed document is validated once and the result passed here. */
  readonly onValidation?: (result: ValidationResult) => void;
  /** On the view root element. */
  readonly className?: string;
}

export type ViewRendererProps = ViewRendererInput & ViewRendererOptions;

const NO_ADAPTERS: RendererAdapters = Object.freeze({});
const NOTHING_PENDING: ReadonlySet<string> = new Set();
const NONE: readonly never[] = Object.freeze([]);

function isDensity(value: unknown): value is Density {
  return DENSITIES.some((density) => density === value);
}

function requestFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const handle = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(callback, 16);
  return () => clearTimeout(handle);
}

/**
 * `snapshot` as of the last animation frame while `coalesce` holds and the
 * document is still arriving: a host that re-renders per chunk gets at most
 * one view render per frame. A complete or failed snapshot shows at once.
 */
function useFrameSnapshot(snapshot: StreamSnapshot, coalesce: boolean): StreamSnapshot {
  const [shown, setShown] = useState(snapshot);
  const latest = useRef(snapshot);
  const cancel = useRef<(() => void) | undefined>(undefined);
  const immediate = !coalesce || snapshot.complete || snapshot.error !== undefined;
  useEffect(() => {
    latest.current = snapshot;
    if (immediate || snapshot === shown || cancel.current !== undefined) return;
    cancel.current = requestFrame(() => {
      cancel.current = undefined;
      setShown(latest.current);
    });
  });
  useEffect(() => () => cancel.current?.(), []);
  return immediate ? snapshot : shown;
}

/** A list's identity kept while its items are the same, so a host's inline array does not defeat memoised rendering. */
function useStableList<T>(list: readonly T[]): readonly T[] {
  const kept = useRef(list);
  const same = kept.current.length === list.length && kept.current.every((item, index) => Object.is(item, list[index]));
  if (!same) kept.current = list;
  return kept.current;
}

function sameEntries(a: { readonly [key: string]: unknown }, b: { readonly [key: string]: unknown }): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]));
}

/**
 * The runtime's roots, kept as the same objects while every binding's value
 * and status is: a streaming snapshot rebuilds them each time, and rendering
 * memoises on their identity.
 */
function useStableRoots<R extends { readonly [K in keyof R]: { readonly [key: string]: unknown } }>(roots: R): R {
  const kept = useRef(roots);
  const previous = kept.current;
  const same = (Object.keys(roots) as (keyof R)[]).every((key) => sameEntries(previous[key], roots[key]));
  if (!same) kept.current = roots;
  return kept.current;
}

/** The names the document's `forms` declares, as one stable set per distinct list. */
function useFormNames(document: PartialDocument | undefined): ReadonlySet<string> {
  const forms = document?.forms;
  const names = useStableList(isPlainObject(forms) ? Object.keys(forms) : NONE);
  return useMemo(() => new Set(names), [names]);
}

/**
 * Renders a ViewSpec document as r-ui components, whole or while it streams.
 * It needs no router, toast provider or server: those arrive through
 * `adapters`, or are absent.
 */
export function ViewRenderer(props: ViewRendererProps): ReactNode {
  const {
    adapters = NO_ADAPTERS,
    registry = defaultRegistry,
    contracts = defaultContracts,
    icons,
    density,
    allowSensitive = false,
    markdownImageAllowlist = NONE,
    streamingFallback = "none",
    onIssue,
    onValidation,
    className,
  } = props;

  const textSnapshot = useTextStream(props.text, props.complete ?? false);
  const specSnapshot = useMemo<StreamSnapshot | undefined>(
    () =>
      props.spec === undefined
        ? undefined
        : { spec: isPlainObject(props.spec) ? props.spec : undefined, complete: true, pending: NOTHING_PENDING },
    [props.spec],
  );
  const snapshot = useFrameSnapshot(specSnapshot ?? props.stream ?? textSnapshot, props.text !== undefined);
  const document: PartialDocument | undefined = snapshot.spec;

  const streaming = useMemo<StreamingState>(
    () => ({
      complete: snapshot.complete,
      pending: snapshot.complete ? NOTHING_PENDING : snapshot.pending,
      fallback: streamingFallback,
    }),
    [snapshot.complete, snapshot.pending, streamingFallback],
  );

  const locale = useLocale();
  const format = useMemo<FormatValue>(() => (value, options) => formatWith(value, options, locale), [locale]);
  const runtime = useViewRuntime({ document, streaming, adapters, onIssue, format });
  const roots = useStableRoots(runtime.roots);
  const { report } = runtime.issues;
  const namespace = useId();

  const images = useStableList(markdownImageAllowlist);
  const formNames = useFormNames(document);
  const env = useMemo<ViewEnv>(
    () => ({ locale, markdownImageAllowlist: images, formNames }),
    [locale, images, formNames],
  );
  const sensitive = useStableList(typeof allowSensitive === "boolean" ? NONE : allowSensitive);
  const allowed = typeof allowSensitive === "boolean" ? allowSensitive : sensitive;

  useEffect(() => {
    const error = snapshot.error;
    if (error === undefined) return;
    report({ code: error.code, path: "", severity: ISSUE_CODE_INFO[error.code].severity, message: error.message });
  }, [snapshot.error, report]);

  // Once per completed document, not once per new callback identity.
  const onValidationRef = useRef(onValidation);
  useEffect(() => {
    onValidationRef.current = onValidation;
  });
  useEffect(() => {
    const callback = onValidationRef.current;
    if (callback === undefined || !snapshot.complete || document === undefined) return;
    callback(validateViewSpec(document, { contracts, components: listRegistryNames(registry), allowSensitive: allowed }));
  }, [snapshot.complete, document, contracts, registry, allowed]);

  const viewDensity = density ?? (isDensity(document?.density) ? document.density : undefined);

  return (
    <div
      className={className === undefined ? DIAGNOSTIC_CLASSES.view : `${DIAGNOSTIC_CLASSES.view} ${className}`}
      data-density={viewDensity}
    >
      <IconSetContext value={icons}>
        <FormsRoot
          defs={document?.forms}
          streaming={streaming}
          roots={roots}
          dispatch={runtime.dispatch}
          registry={runtime.forms}
          report={report}
        >
          {(forms) =>
            renderNode(
              document?.root,
              createRootScope(
                {
                  registry,
                  contracts,
                  icons,
                  adapters,
                  allowSensitive: allowed,
                  roots: { ...roots, forms: forms.values },
                  forms: forms.handles,
                  dialogs: runtime.dialogs,
                  dispatch: runtime.dispatch,
                  report,
                  streaming,
                  namespace,
                },
                env,
              ),
            )
          }
        </FormsRoot>
        <IssueLog channel={runtime.issues} />
      </IconSetContext>
    </div>
  );
}
