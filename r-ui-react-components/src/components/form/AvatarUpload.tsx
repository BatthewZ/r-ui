"use client";
import { ImageUp, Trash2, UserRound } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type Ref,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ErrorLine } from "../../util/error-line";
import { formatBytes, formatPercent } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { ProgressRing } from "../feedback";
import { Avatar, Button } from "../primitives";

import { type AvatarImageType, cropToSquare } from "./avatar-crop";
import { Field, useFieldControl, useFieldMessage, useFieldValue } from "./Field";
import { type FileUploadContext, matchesAccept } from "./FileUpload";
import { useAnnouncer } from "./selection-field";
import { Slider } from "./Slider";

/** Every string the control says, for localisation. */
export interface AvatarUploadLabels {
  choose: string;
  replace: string;
  remove: string;
  /** Names the zoom slider while cropping. */
  zoom: string;
  /** Under the zoom slider. `null` shows nothing. */
  cropHint: string | null;
  /** Crops and uploads (or keeps) the photo. */
  apply: string;
  /** Leaves the crop without changing the photo. */
  cancel: string;
  cancelUpload: string;
  retry: string;
  /** Names the progress ring. */
  uploading: string;
  /** Beside the ring before the first progress report. */
  waiting: string;
  wrongType: (name: string) => string;
  tooLarge: (name: string, maxSize: number) => string;
  /** The picked file is not an image the browser can read. */
  unreadable: (name: string) => string;
  /** `reason` is the rejected upload's `Error` message, when it has one. */
  failed: (reason: string | null) => string;
  /** Announced. */
  updated: string;
  removed: string;
  canceled: string;
}

export const DEFAULT_AVATAR_UPLOAD_LABELS: AvatarUploadLabels = {
  choose: "Choose photo",
  replace: "Replace photo",
  remove: "Remove photo",
  zoom: "Zoom",
  cropHint: "The centre of the photo is kept. Zoom in to frame it closer.",
  apply: "Use photo",
  cancel: "Cancel",
  cancelUpload: "Cancel upload",
  retry: "Try again",
  uploading: "Uploading photo",
  waiting: "Waiting…",
  wrongType: (name) => `“${name}” is not an image this field takes.`,
  tooLarge: (name, maxSize) => `“${name}” is larger than ${formatBytes(maxSize)}.`,
  unreadable: (name) => `“${name}” could not be read as an image.`,
  failed: (reason) => (reason ? `Upload failed: ${reason}` : "Upload failed."),
  updated: "Photo updated.",
  removed: "Photo removed.",
  canceled: "Upload cancelled.",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    AvatarUpload: AvatarUploadLabels;
  }
}

interface AvatarUploadOwnProps {
  /** Whose photo: the initials while there is none. */
  personName?: string;
  /** The native `accept` grammar. @default "image/*" */
  accept?: string;
  /** Largest file picked, in bytes (checked before the crop). */
  maxSize?: number;
  /** A refusal message for a picked file, or nothing to accept it. */
  validate?: (file: File) => string | null | undefined;
  /** The cropped image's side, in pixels. @default 512 */
  outputSize?: number;
  /** The cropped image's encoding. @default "image/png" */
  outputType?: AvatarImageType;
  /** The closest zoom the crop allows (1 = the largest centred square). @default 3 */
  maxZoom?: number;
  /** Submits the value: a string or number from a hidden input, a `File` from a hidden file input. */
  name?: string;
  form?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  labels?: LabelsProp<AvatarUploadLabels>;
  /** The choose / replace button: the control, which takes the Field's id and focus. */
  ref?: Ref<HTMLButtonElement>;
  /** `className` styles the root. */
  classNames?: SlotClassNames<"stage" | "image" | "actions" | "message">;
}

type AvatarUploadValueProps<T> =
  | {
      /** Without `onUpload`, choosing a photo makes the value the cropped `File`; a string is an image URL. */
      onUpload?: undefined;
      value?: File | string | null;
      defaultValue?: File | string | null;
      onValueChange?: (value: File | string | null) => void;
      getSrc?: undefined;
    }
  | {
      /**
       * Uploads the cropped photo: report progress, honour the signal, resolve
       * with the value (a URL, an id), reject to fail it (Try again calls it again).
       * The same contract as `FileUpload`'s.
       */
      onUpload: (file: File, context: FileUploadContext) => Promise<T>;
      value?: T | null;
      defaultValue?: T | null;
      onValueChange?: (value: T | null) => void;
      /** The image URL for a value. Default: a string value is its own URL. */
      getSrc?: (value: T) => string | null | undefined;
    };

export type AvatarUploadProps<T = string> = Omit<
  ComponentPropsWithoutRef<"div">,
  keyof AvatarUploadOwnProps | "defaultValue" | "onChange" | "children"
> &
  AvatarUploadOwnProps &
  AvatarUploadValueProps<T>;

type Phase =
  | { kind: "idle" }
  | { kind: "crop"; file: File; url: string; loaded: boolean; zoom: number }
  | { kind: "uploading"; file: File; url: string; progress: number | null; controller: AbortController }
  | { kind: "failed"; file: File; url: string; reason: string | null };

/** A photo this control holds as an object URL (the Avatar refuses `blob:` sources, rightly, for a caller's URL). */
const PHOTO = "size-(--r-form-avatar-size) overflow-hidden rounded-full border";

/** Where focus goes after the phase changes, if it was in the control. */
type FocusTarget = "choose" | "zoom" | "cancelUpload" | "retry";

/** An object URL for a `File` value, minted in an effect and revoked when it goes. */
function useFileUrl(file: File | null): string | null {
  const [entry, setEntry] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEntry({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file && entry?.file === file ? entry.url : null;
}

/**
 * A profile photo: the current avatar (or the person's initials), Choose /
 * Replace and Remove. A picked image is checked (`accept`, `maxSize`,
 * `validate`; a refusal is the Field's error), then cropped: the preview is
 * the avatar itself, a centred square that a zoom `Slider` tightens, and "Use
 * photo" draws it to a square canvas (`outputSize`, no dependency). With
 * `onUpload` (the `FileUpload` contract: progress and an `AbortSignal`) the
 * crop uploads under a `ProgressRing` around the avatar, can be cancelled and
 * retried, and the value is what the upload resolved with; without it, the
 * value is the cropped `File`. Binds to a `Form` through `Field name`.
 */
export function AvatarUpload<T = string>(props: AvatarUploadProps<T>) {
  const {
    personName,
    accept = "image/*",
    maxSize,
    validate,
    outputSize = 512,
    outputType = "image/png",
    maxZoom = 3,
    name,
    form,
    id: idProp,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
    labels: labelsProp,
    ref,
    className,
    classNames,
    onUpload: onUploadProp,
    value: valueProp,
    defaultValue,
    onValueChange,
    getSrc,
    ...rest
  } = props as AvatarUploadProps<unknown> & {
    onUpload?: (file: File, context: FileUploadContext) => Promise<unknown>;
    value?: unknown;
    defaultValue?: unknown;
    onValueChange?: (value: unknown) => void;
    getSrc?: (value: unknown) => string | null | undefined;
  };
  const labels = useLabels("AvatarUpload", DEFAULT_AVATAR_UPLOAD_LABELS, labelsProp);
  const locale = useLocale();

  const baseId = useId();
  const textId = `${baseId}-text`;
  const messageId = `${baseId}-message`;
  const [refusal, setRefusal] = useState<string | null>(null);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp ?? (refusal !== null || undefined),
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": [describedByProp, refusal ? messageId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-invalid": ariaInvalidProp,
  });
  useFieldMessage("error", messageId, refusal !== null);
  const locked = field.disabled === true || field.readOnly === true;

  const [value, setValue, fieldName] = useFieldValue<unknown>({
    value: valueProp,
    defaultValue: defaultValue ?? null,
    onChange: onValueChange,
    fromForm: (raw) => raw ?? null,
  });
  const submitName = name ?? fieldName;

  const [phase, setPhaseState] = useState<Phase>({ kind: "idle" });
  // Read synchronously by async work (an upload finishing after a cancel).
  const phaseRef = useRef(phase);
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = phaseRef.current;
      if (current.kind === "uploading") current.controller.abort();
    };
  }, []);
  // The picked source and the cropped file each own an object URL, revoked when the phase lets go of it.
  const phaseUrl = phase.kind === "idle" ? null : phase.url;
  useEffect(() => {
    if (!phaseUrl) return;
    return () => URL.revokeObjectURL(phaseUrl);
  }, [phaseUrl]);

  const valueFile = value instanceof File ? value : null;
  const valueFileUrl = useFileUrl(valueFile);
  // A caller's image URL for the value (a File shows through its own object URL).
  const valueSrc =
    value === null || value === undefined || valueFile
      ? null
      : getSrc
        ? (getSrc(value) ?? null)
        : typeof value === "string"
          ? value
          : null;

  const [region, announce] = useAnnouncer();
  const rootRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const setChooseRef = useMemo(() => mergeRefs(ref, chooseRef), [ref]);
  const pickerRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);

  const focusNext = useRef<FocusTarget | null>(null);
  useLayoutEffect(() => {
    const target = focusNext.current;
    const root = rootRef.current;
    if (!target || !root) return;
    focusNext.current = null;
    const active = root.ownerDocument.activeElement;
    // Only when focus was in the control (or dropped with a button that went): never steal it.
    if (active && active !== root.ownerDocument.body && !root.contains(active)) return;
    const element =
      target === "zoom"
        ? root.querySelector<HTMLElement>('[role="slider"]')
        : root.querySelector<HTMLElement>(`[data-avatar-focus="${target}"]`);
    element?.focus();
  });
  const moveFocus = (target: FocusTarget) => {
    focusNext.current = target;
  };

  const startUpload = (file: File, url: string) => {
    const upload = onUploadProp;
    if (!upload) return;
    const controller = new AbortController();
    const live = () => {
      const current = phaseRef.current;
      return current.kind === "uploading" && current.controller === controller;
    };
    setPhase({ kind: "uploading", file, url, progress: null, controller });
    let shown = -1;
    const onProgress = (fraction: number) => {
      if (!mounted.current || !live() || !Number.isFinite(fraction)) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      // Whole percents only: a byte-by-byte report would re-render per chunk.
      if (Math.round(clamped * 100) === shown) return;
      shown = Math.round(clamped * 100);
      const current = phaseRef.current;
      if (current.kind === "uploading") setPhase({ ...current, progress: clamped });
    };
    let promise: Promise<unknown>;
    try {
      promise = Promise.resolve(upload(file, { onProgress, signal: controller.signal }));
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(
      (result) => {
        if (controller.signal.aborted || !mounted.current || !live()) return;
        setValue(result);
        setPhase({ kind: "idle" });
        moveFocus("choose");
        announce(labels.updated);
      },
      (error: unknown) => {
        if (controller.signal.aborted || !mounted.current || !live()) return;
        const reason = error instanceof Error && error.message ? error.message : null;
        setPhase({ kind: "failed", file, url, reason });
        moveFocus("retry");
        announce(labels.failed(reason));
      },
    );
  };

  const handlePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || locked) return;
    const reason = !matchesAccept(file, accept)
      ? labels.wrongType(file.name)
      : maxSize !== undefined && file.size > maxSize
        ? labels.tooLarge(file.name, maxSize)
        : validate?.(file) || null;
    setRefusal(reason);
    if (reason) {
      announce(reason);
      return;
    }
    setPhase({ kind: "crop", file, url: URL.createObjectURL(file), loaded: false, zoom: 1 });
    moveFocus("zoom");
  };

  const apply = async () => {
    const current = phaseRef.current;
    const image = cropImageRef.current;
    if (current.kind !== "crop" || !current.loaded || !image) return;
    let cropped: File;
    try {
      cropped = await cropToSquare(image, { zoom: current.zoom, size: outputSize, type: outputType, name: current.file.name });
    } catch {
      if (!mounted.current) return;
      setRefusal(labels.unreadable(current.file.name));
      setPhase({ kind: "idle" });
      moveFocus("choose");
      return;
    }
    if (!mounted.current || phaseRef.current !== current) return;
    if (onUploadProp) {
      startUpload(cropped, URL.createObjectURL(cropped));
      moveFocus("cancelUpload");
    } else {
      setValue(cropped);
      setPhase({ kind: "idle" });
      moveFocus("choose");
      announce(labels.updated);
    }
  };

  const discard = (announcement?: string) => {
    const current = phaseRef.current;
    if (current.kind === "uploading") current.controller.abort();
    setPhase({ kind: "idle" });
    moveFocus("choose");
    if (announcement) announce(announcement);
  };

  const remove = () => {
    if (locked) return;
    setValue(null);
    setRefusal(null);
    moveFocus("choose");
    announce(labels.removed);
  };

  // A File value submits through a file input of its own (the picker's holds nothing).
  const fileSubmitRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = fileSubmitRef.current;
    if (!input || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    if (valueFile) transfer.items.add(valueFile);
    input.files = transfer.files;
  }, [valueFile, submitName]);

  // Object URLs this control minted show as they are; a caller's URL goes through the Avatar's `safeUrl`.
  const ownUrl = phase.kind === "idle" ? valueFileUrl : phase.url;
  const labelledBy = [field.labelId, textId].filter(Boolean).join(" ");
  const progress = phase.kind === "uploading" ? phase.progress : null;

  return (
    <div
      ref={rootRef}
      className={cn("grid min-w-0 gap-r4", className)}
      data-phase={phase.kind}
      aria-busy={phase.kind === "uploading" || undefined}
      {...rest}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-r3">
        <div className={cn("r-form-avatar-stage", classNames?.stage)} data-print="avoid-break">
          {phase.kind === "crop" ? (
            <span className={cn(PHOTO, classNames?.image)}>
              <img
                ref={cropImageRef}
                src={phase.url}
                alt=""
                className="size-full object-cover transition-transform duration-fast ease-standard"
                style={{ transform: `scale(${phase.zoom})` }}
                onLoad={() => {
                  const current = phaseRef.current;
                  if (current.kind === "crop" && current.url === phase.url) setPhase({ ...current, loaded: true });
                }}
                onError={() => {
                  if (phaseRef.current !== phase) return;
                  setRefusal(labels.unreadable(phase.file.name));
                  setPhase({ kind: "idle" });
                  moveFocus("choose");
                }}
              />
            </span>
          ) : ownUrl ? (
            <span className={cn(PHOTO, phase.kind !== "idle" && "opacity-disabled", classNames?.image)}>
              <img src={ownUrl} alt="" className="size-full object-cover" />
            </span>
          ) : valueSrc || personName ? (
            <Avatar src={valueSrc} name={personName} alt="" className={cn("size-(--r-form-avatar-size)", classNames?.image)} />
          ) : (
            <span
              aria-hidden
              className={cn(
                "grid size-(--r-form-avatar-size) place-items-center rounded-full border border-dashed border-border-strong bg-surface-1 text-fg-muted",
                classNames?.image,
              )}
            >
              <UserRound className="size-1/2" />
            </span>
          )}
          {phase.kind === "uploading" && (
            <ProgressRing size="large" className="size-full" value={progress === null ? null : progress * 100} label={labels.uploading} />
          )}
        </div>

        <div className={cn("grid min-w-0 flex-[1_1_var(--COLUMN-SM)] gap-r4", classNames?.actions)} data-print="hide">
          {phase.kind === "crop" ? (
            <>
              <Field className="min-w-0" disabled={field.disabled}>
                <Field.Label>{labels.zoom}</Field.Label>
                <Slider
                  min={1}
                  max={Math.max(1, maxZoom)}
                  step={0.01}
                  value={phase.zoom}
                  onValueChange={(zoom) => {
                    const current = phaseRef.current;
                    if (current.kind === "crop") setPhase({ ...current, zoom });
                  }}
                  formatValue={(zoom) => formatPercent(zoom, { locale, maximumFractionDigits: 0 })}
                />
                {labels.cropHint && <Field.Description>{labels.cropHint}</Field.Description>}
              </Field>
              <div className="flex flex-wrap items-center gap-r4">
                <Button onClick={() => void apply()} aria-disabled={!phase.loaded || undefined} disabled={field.disabled}>
                  {labels.apply}
                </Button>
                <Button variant="ghost" onClick={() => discard()}>
                  {labels.cancel}
                </Button>
              </div>
            </>
          ) : phase.kind === "uploading" ? (
            <div className="flex flex-wrap items-center gap-r4">
              <span aria-hidden className="text-body-2 tabular-nums text-fg-secondary">
                {progress === null ? labels.waiting : formatPercent(progress, { locale, maximumFractionDigits: 0 })}
              </span>
              <Button variant="secondary" data-avatar-focus="cancelUpload" onClick={() => discard(labels.canceled)}>
                {labels.cancelUpload}
              </Button>
            </div>
          ) : phase.kind === "failed" ? (
            <>
              <ErrorLine>{labels.failed(phase.reason)}</ErrorLine>
              <div className="flex flex-wrap items-center gap-r4">
                <Button variant="secondary" data-avatar-focus="retry" onClick={() => startUpload(phase.file, phase.url)}>
                  {labels.retry}
                </Button>
                <Button variant="ghost" onClick={() => discard()}>
                  {labels.cancel}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-r4">
              <Button
                ref={setChooseRef}
                variant="secondary"
                id={field.id}
                data-avatar-focus="choose"
                iconStart={<ImageUp />}
                disabled={field.disabled}
                aria-disabled={field.readOnly || undefined}
                aria-labelledby={labelledBy}
                {...field.ariaProps}
                onClick={() => {
                  if (!locked) pickerRef.current?.click();
                }}
              >
                <span id={textId}>{value === null || value === undefined ? labels.choose : labels.replace}</span>
              </Button>
              {value !== null && value !== undefined && (
                <Button variant="ghost" iconStart={<Trash2 />} disabled={field.disabled || field.readOnly} onClick={remove}>
                  {labels.remove}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {refusal && (
        <div id={messageId} className={classNames?.message}>
          <ErrorLine>{refusal}</ErrorLine>
        </div>
      )}
      <input ref={pickerRef} type="file" hidden tabIndex={-1} accept={accept} disabled={field.disabled} onChange={handlePicked} />
      {submitName &&
        (value instanceof File ? (
          <input ref={fileSubmitRef} type="file" hidden tabIndex={-1} name={submitName} form={form} />
        ) : typeof value === "string" || typeof value === "number" ? (
          <input type="hidden" name={submitName} value={String(value)} form={form} />
        ) : null)}
      {region}
    </div>
  );
}
