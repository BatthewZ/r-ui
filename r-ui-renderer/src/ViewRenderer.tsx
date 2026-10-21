"use client";

import { useLocale } from "@batthewz/r-ui-react-components";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { RENDERER_CLASSES } from "./diagnostics";
import { FormsRoot } from "./forms/FormsRoot";
import type { IconSet } from "./icons/types";
import { type ComponentRegistry, defaultRegistry, listRegistryNames } from "./registry/registry";
import { formatWith } from "./render/format";
import { IconSetContext } from "./render/icon-context";
import { IssueLog } from "./render/IssueLog";
import { sameList } from "./render/memo";
import { NodeBoundary } from "./render/NodeBoundary";
import { renderNode } from "./render/render-node";
import { createRootScope, type ViewEnv } from "./render/scope";
import { useViewTheme } from "./render/view-theme";
import type { RendererAdapters } from "./runtime/adapters";
import type { IssueReporter, ResolvedPolicy, StreamingFallback, StreamingState } from "./runtime/context";
import { resolvePolicy, samePolicy } from "./runtime/policy";
import type { FormatValue } from "./runtime/resolve";
import { useViewRuntime } from "./runtime/use-view-runtime";
import { defaultContracts } from "./contracts";
import { isOneOf, isPlainObject } from "./spec/guards";
import { makeIssue } from "./spec/issue";
import {
  type ComponentContracts,
  DENSITIES,
  type Density,
  type HostPolicy,
  type Issue,
  type ValidationResult,
  type ViewSpec,
} from "./spec/types";
import { findNonJson } from "./spec/validate-json";
import { NOTHING_PENDING, type PartialDocument, runOf, stampRun, type StreamRun, type StreamSnapshot } from "./stream/snapshot";
import { requestFrame, useTextStream, useViewSpecStream, type ViewSpecSource } from "./stream/use-view-spec-stream";

/**
 * One of four inputs, fixed for the life of the element. A new document (a
 * new `spec` object, text that starts over rather than grows, a new `source`,
 * or snapshots from a new or reset parser) starts the view afresh: state,
 * data, forms, dialogs and issues all belong to one document.
 */
export type ViewRendererInput =
  /** A whole document (parsed JSON). Keep its identity while it is the same document. */
  | { readonly spec: ViewSpec; readonly text?: undefined; readonly complete?: undefined; readonly snapshot?: undefined; readonly source?: undefined }
  /** A growing string; `complete` once it has all arrived. */
  | { readonly text: string; readonly complete?: boolean; readonly spec?: undefined; readonly snapshot?: undefined; readonly source?: undefined }
  /** Snapshots from `useViewSpecStream` or a parser. */
  | { readonly snapshot: StreamSnapshot; readonly spec?: undefined; readonly text?: undefined; readonly complete?: undefined; readonly source?: undefined }
  /** A stream the view reads itself: a `Response`, a `ReadableStream` or an async iterable of text (or UTF-8 bytes). */
  | { readonly source: ViewSpecSource; readonly spec?: undefined; readonly text?: undefined; readonly complete?: undefined; readonly snapshot?: undefined };

export interface ViewRendererOptions {
  /** The effects the view may cause: navigation, toasts, network, named sources. Each is absent until given. */
  readonly adapters?: RendererAdapters;
  /** What the document may reach: request and image origins, Markdown images, sensitive components and values. */
  readonly policy?: HostPolicy;
  /** The library's components and the built-ins when absent. Extend it with `extendRegistry`. */
  readonly registry?: ComponentRegistry;
  /** What each name means beyond constructing it. Extend it with `extendContracts` beside the registry. */
  readonly contracts?: ComponentContracts;
  /** Icon name → component, for `Icon` nodes and icon-name props (`@batthewz/r-ui-renderer/icons` is one). */
  readonly icons?: IconSet;
  /** Wins over the document's `density`. */
  readonly density?: Density;
  /** What a node still streaming renders: nothing, or a Skeleton. */
  readonly streamingFallback?: StreamingFallback;
  /**
   * `hidden` keeps every diagnostic element in the DOM (so `findDiagnostics`
   * still finds them) but out of sight. `show` by default.
   */
  readonly diagnostics?: "show" | "hidden";
  /** Every issue found while rendering and running the view. */
  readonly onIssue?: (issue: Issue) => void;
  /**
   * With it, each completed document is validated once, as the view sees it
   * (its registry, contracts, icon set, origin and policy), and the result
   * passed here. The validator loads only when this is set.
   */
  readonly onValidation?: (result: ValidationResult) => void;
  /** On the view root element. */
  readonly className?: string;
}

export type ViewRendererProps = ViewRendererInput & ViewRendererOptions;

const NO_ADAPTERS: RendererAdapters = Object.freeze({});
const NONE: readonly never[] = Object.freeze([]);

/** A `spec` input as a complete snapshot of its own run, and why it cannot render when it cannot. */
interface SpecInput {
  readonly snapshot: StreamSnapshot;
  readonly issue: Issue | undefined;
}

function specInput(spec: unknown): SpecInput {
  // Iterative, so a document nested past any limit is refused here rather than overflowing the stack below.
  const issue = isPlainObject(spec) ? findNonJson(spec) : makeIssue("invalid-type", "", "A document is one JSON object.");
  const snapshot: StreamSnapshot = { spec: issue === undefined && isPlainObject(spec) ? spec : undefined, complete: true, pending: NOTHING_PENDING };
  return { snapshot: stampRun(snapshot, {}), issue };
}

/**
 * `snapshot` as of the last animation frame while `coalesce` holds and the
 * document is still arriving: a host that re-renders per chunk gets at most
 * one view render per frame. A complete or failed snapshot shows at once, and
 * so does the first of a new document, never a frame of the old one.
 */
function useFrameSnapshot(snapshot: StreamSnapshot, coalesce: boolean): StreamSnapshot {
  const [shown, setShown] = useState(snapshot);
  const latest = useRef(snapshot);
  const cancel = useRef<(() => void) | undefined>(undefined);
  // A new document replaces the shown one before this render goes on.
  if (runOf(snapshot) !== runOf(shown)) setShown(snapshot);
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

/** Counts documents: a new run (one no earlier snapshot came from) is the next generation. */
function useGeneration(run: StreamRun | undefined): number {
  const [current, setCurrent] = useState<{ readonly run: StreamRun | undefined; readonly generation: number }>({ run, generation: 0 });
  if (run === undefined || run === current.run) return current.generation;
  // The first document needs no fresh start; any later one does.
  const next = { run, generation: current.run === undefined ? current.generation : current.generation + 1 };
  setCurrent(next);
  return next.generation;
}

/** A list's identity kept while its items are the same, so a host's inline array does not defeat memoised rendering. */
function useStableList<T>(list: readonly T[]): readonly T[] {
  const kept = useRef(list);
  if (!sameList(kept.current, list)) kept.current = list;
  return kept.current;
}

/** The host's policy resolved, its identity kept while its members are the same. */
function useStablePolicy(policy: HostPolicy | undefined): ResolvedPolicy {
  const resolved = resolvePolicy(policy);
  const kept = useRef(resolved);
  if (!samePolicy(kept.current, resolved)) kept.current = resolved;
  return kept.current;
}

/** The document's `theme` once its object has closed: never half a palette. */
function closedTheme(document: PartialDocument | undefined, pending: ReadonlySet<string>): unknown {
  return document === undefined || pending.has("/theme") ? undefined : document.theme;
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
 * `adapters`, or are absent. It never throws: whatever fails renders a
 * diagnostic and reaches `onIssue`.
 */
export function ViewRenderer(props: ViewRendererProps): ReactNode {
  const { adapters, policy, registry, contracts, icons, density, streamingFallback, diagnostics = "show", onIssue, onValidation, className } = props;
  const options = { adapters, registry, contracts, icons, streamingFallback, onIssue, onValidation };

  const textSnapshot = useTextStream(props.text, props.complete ?? false);
  const sourceSnapshot = useViewSpecStream(props.source);
  const fromSpec = useMemo(() => (props.spec === undefined ? undefined : specInput(props.spec)), [props.spec]);
  const input = fromSpec?.snapshot ?? props.snapshot ?? (props.source === undefined ? textSnapshot : sourceSnapshot);
  const snapshot = useFrameSnapshot(input, props.text !== undefined);
  const generation = useGeneration(runOf(snapshot));

  const document = snapshot.spec;
  const viewDensity = density ?? (isOneOf(DENSITIES, document?.density) ? document.density : undefined);
  const resolvedPolicy = useStablePolicy(policy);
  const root = useRef<HTMLDivElement>(null);
  const theme = useViewTheme(closedTheme(document, snapshot.pending), resolvedPolicy, generation, root);
  const classes = [RENDERER_CLASSES.view, theme.style === undefined ? undefined : RENDERER_CLASSES.themed, className];

  // Outside the document's own channel, which is what failed: straight to the host.
  const latestOnIssue = useRef(onIssue);
  useEffect(() => {
    latestOnIssue.current = onIssue;
  });
  const reportFailure = useCallback<IssueReporter>((issue) => latestOnIssue.current?.(issue), []);

  return (
    <div
      ref={root}
      className={classes.filter((name) => name !== undefined).join(" ")}
      style={theme.style}
      data-density={viewDensity}
      data-diagnostics={diagnostics === "hidden" ? "hidden" : undefined}
    >
      <NodeBoundary key={generation} path="" report={reportFailure} structural={false} pending={undefined}>
        <DocumentView {...options} policy={resolvedPolicy} snapshot={snapshot} inputIssue={fromSpec?.issue} themeIssues={theme.issues} />
      </NodeBoundary>
    </div>
  );
}

type DocumentViewProps = Omit<ViewRendererOptions, "density" | "diagnostics" | "className" | "policy"> & {
  readonly policy: ResolvedPolicy;
  /** As shown: frame-coalesced. */
  readonly snapshot: StreamSnapshot;
  /** Why a `spec` input cannot render. */
  readonly inputIssue: Issue | undefined;
  /** What the view root held back of the document's theme, and why. */
  readonly themeIssues: readonly Issue[];
};

/** One document's view: its runtime, forms, rendering and issue log, all mounted afresh for the next document. */
function DocumentView(props: DocumentViewProps): ReactNode {
  const {
    snapshot,
    inputIssue,
    themeIssues,
    policy,
    adapters = NO_ADAPTERS,
    registry = defaultRegistry,
    contracts = defaultContracts,
    icons,
    streamingFallback = "none",
    onIssue,
    onValidation,
  } = props;
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
  const runtime = useViewRuntime({ document, streaming, adapters, policy, onIssue, format });
  const { roots } = runtime;
  const { report } = runtime.issues;
  const namespace = useId();

  const formNames = useFormNames(document);
  const env = useMemo<ViewEnv>(() => ({ locale, formNames }), [locale, formNames]);
  const iconNames = useStableList(icons === undefined ? NONE : Object.keys(icons));

  useEffect(() => {
    if (inputIssue !== undefined) report(inputIssue);
  }, [inputIssue, report]);

  useEffect(() => {
    for (const issue of themeIssues) report(issue);
  }, [themeIssues, report]);

  useEffect(() => {
    const error = snapshot.error;
    if (error === undefined) return;
    report(makeIssue(error.code, "", error.message));
  }, [snapshot.error, report]);

  // Once per completed document, not once per new callback identity.
  const onValidationRef = useRef(onValidation);
  useEffect(() => {
    onValidationRef.current = onValidation;
  });
  const wantsValidation = onValidation !== undefined;
  useEffect(() => {
    if (!wantsValidation || !snapshot.complete || document === undefined) return;
    let current = true;
    const origin = typeof location === "undefined" ? undefined : location.origin;
    void import("./spec/validate").then(({ validateViewSpec }) => {
      if (!current) return;
      onValidationRef.current?.(
        validateViewSpec(document, { contracts, components: listRegistryNames(registry), iconNames, origin, policy }),
      );
    });
    return () => {
      current = false;
    };
  }, [wantsValidation, snapshot.complete, document, contracts, registry, iconNames, policy]);

  return (
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
                policy,
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
  );
}
