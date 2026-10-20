"use client";

import { type ReactNode, useEffect, useId, useMemo, useRef } from "react";

import { DIAGNOSTIC_CLASSES } from "./diagnostics";
import { FormsRoot } from "./forms/FormsRoot";
import type { IconSet } from "./icons/types";
import { type ComponentRegistry, defaultRegistry, listRegistryNames } from "./registry/registry";
import { IconSetContext } from "./render/icon-context";
import { IssueLog } from "./render/IssueLog";
import { renderNode } from "./render/render-node";
import { createRootScope } from "./render/scope";
import type { RendererAdapters } from "./runtime/adapters";
import type { StreamingFallback, StreamingState } from "./runtime/context";
import { useViewRuntime } from "./runtime/use-view-runtime";
import { defaultContracts } from "./spec/contracts";
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

function isDensity(value: unknown): value is Density {
  return DENSITIES.some((density) => density === value);
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
  const snapshot = specSnapshot ?? props.stream ?? textSnapshot;
  const document: PartialDocument | undefined = snapshot.spec;

  const streaming = useMemo<StreamingState>(
    () => ({
      complete: snapshot.complete,
      pending: snapshot.complete ? NOTHING_PENDING : snapshot.pending,
      fallback: streamingFallback,
    }),
    [snapshot.complete, snapshot.pending, streamingFallback],
  );

  const runtime = useViewRuntime({ document, streaming, adapters, onIssue });
  const { report } = runtime.issues;
  const namespace = useId();

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
    callback(validateViewSpec(document, { contracts, components: listRegistryNames(registry), allowSensitive }));
  }, [snapshot.complete, document, contracts, registry, allowSensitive]);

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
          roots={runtime.roots}
          dispatch={runtime.dispatch}
          registry={runtime.forms}
          report={report}
        >
          {(forms) =>
            renderNode(
              document?.root,
              createRootScope({
                registry,
                contracts,
                icons,
                adapters,
                allowSensitive,
                roots: { ...runtime.roots, forms: forms.values },
                forms: forms.handles,
                dialogs: runtime.dialogs,
                dispatch: runtime.dispatch,
                report,
                streaming,
                namespace,
              }),
            )
          }
        </FormsRoot>
        <IssueLog channel={runtime.issues} />
      </IconSetContext>
    </div>
  );
}
