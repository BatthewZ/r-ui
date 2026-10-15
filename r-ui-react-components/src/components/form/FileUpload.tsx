"use client";
import {
  ArrowDownToLine,
  File as FileGlyph,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
  RotateCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type DragEvent,
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
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";
import { IconButton, StatusLabel } from "../primitives";

import { useFieldControl, useFieldMessage, useFieldValue } from "./Field";
import { HiddenValues, useAnnouncer } from "./selection-field";
import { type LabelsProp, mergeLabels } from "../../util/labels";

/** How a value that was not picked in this session is shown (a file uploaded last week). */
export interface FileUploadItemInfo {
  name: string;
  /** Bytes. */
  size?: number;
  /** MIME type; picks the icon, and an `image/*` with a `previewUrl` shows a thumbnail. */
  type?: string;
  previewUrl?: string;
}

/** What `onUpload` gets beside the file. */
export interface FileUploadContext {
  /** Report progress as a fraction, 0 to 1. Until the first call the bar is waiting. */
  onProgress: (fraction: number) => void;
  /** Aborted when the user cancels or removes the file, or the control unmounts. */
  signal: AbortSignal;
}

/** The limits the hint describes. */
export interface FileUploadRules {
  accept: string | undefined;
  maxSize: number | undefined;
  maxFiles: number | undefined;
  multiple: boolean;
}

/** Every string the control says, for localisation. */
export interface FileUploadLabels {
  prompt: (multiple: boolean) => string;
  /** The prompt while files are dragged over the drop zone. */
  dropping: (multiple: boolean) => string;
  /** The line under the prompt; `null` shows none. */
  hint: (rules: FileUploadRules) => string | null;
  wrongType: (name: string) => string;
  tooLarge: (name: string, maxSize: number) => string;
  tooMany: (maxFiles: number, refused: number) => string;
  /** Names the file list. */
  files: string;
  remove: (name: string) => string;
  cancel: (name: string) => string;
  retry: (name: string) => string;
  /** Names a file's progress bar. */
  progress: (name: string) => string;
  /** Before the first progress report. */
  waiting: string;
  uploaded: string;
  canceled: string;
  /** `reason` is the rejected upload's `Error` message, when it has one. */
  failed: (reason: string | null) => string;
  /** Announced. */
  added: (names: string[]) => string;
  uploadedFile: (name: string) => string;
  failedFile: (name: string) => string;
  canceledFile: (name: string) => string;
  removedFile: (name: string) => string;
}

const GROUPS: Record<string, string> = { image: "images", video: "videos", audio: "audio", text: "text files" };

/** The `accept` attribute's entries, trimmed and lowercased. */
const acceptEntries = (accept: string | undefined) =>
  (accept ?? "")
    .split(",")
    .map((raw) => raw.trim().toLowerCase())
    .filter(Boolean);

/** "image/*,.pdf" → "images or PDF". */
function describeAccept(accept: string): string {
  const labels = acceptEntries(accept).map((entry) => {
    if (entry.startsWith(".")) return entry.slice(1).toUpperCase();
    const [type = "", sub = ""] = entry.split("/");
    if (sub === "*") return GROUPS[type] ?? `${type} files`;
    return (sub.split(/[.+-]/).pop() ?? sub).toUpperCase();
  });
  return new Intl.ListFormat("en", { type: "disjunction" }).format([...new Set(labels)]);
}

export const DEFAULT_FILE_UPLOAD_LABELS: FileUploadLabels = {
  prompt: (multiple) => (multiple ? "Drop files here or browse" : "Drop a file here or browse"),
  dropping: (multiple) => (multiple ? "Drop to add the files" : "Drop to add the file"),
  hint: ({ accept, maxSize, maxFiles, multiple }) => {
    const parts = [
      accept ? describeAccept(accept) : null,
      maxSize === undefined ? null : `up to ${formatBytes(maxSize)}${multiple ? " each" : ""}`,
      multiple && maxFiles !== undefined ? `${maxFiles} files at most` : null,
    ].filter((p): p is string => p !== null);
    if (parts.length === 0) return null;
    const text = parts.join(", ");
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  },
  wrongType: (name) => `“${name}” is not a file type this field takes.`,
  tooLarge: (name, maxSize) => `“${name}” is larger than ${formatBytes(maxSize)}.`,
  tooMany: (maxFiles, refused) => `Up to ${maxFiles} ${maxFiles === 1 ? "file" : "files"}: ${refused} not added.`,
  files: "Files",
  remove: (name) => `Remove ${name}`,
  cancel: (name) => `Cancel upload of ${name}`,
  retry: (name) => `Retry upload of ${name}`,
  progress: (name) => `Uploading ${name}`,
  waiting: "Waiting…",
  uploaded: "Uploaded",
  canceled: "Cancelled",
  failed: (reason) => (reason ? `Upload failed: ${reason}` : "Upload failed."),
  added: (names) => `Added ${names.join(", ")}.`,
  uploadedFile: (name) => `${name} uploaded.`,
  failedFile: (name) => `${name} failed to upload.`,
  canceledFile: (name) => `Upload of ${name} cancelled.`,
  removedFile: (name) => `Removed ${name}.`,
};

/** The `accept` attribute's grammar: `.pdf`, `image/*`, `image/png`. A file with no MIME type matches only an extension. */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  const entries = acceptEntries(accept);
  if (entries.length === 0) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return entries.some((entry) => {
    if (entry.startsWith(".")) return name.endsWith(entry);
    if (entry === "*/*") return true;
    if (type === "") return false;
    if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1));
    return type === entry;
  });
}

function glyphFor(type: string | undefined, name: string): LucideIcon {
  const t = type ?? "";
  if (t.startsWith("image/")) return FileImage;
  if (t.startsWith("video/")) return FileVideo;
  if (t.startsWith("audio/")) return FileAudio;
  if (/\.(zip|gz|tgz|rar|7z)$/i.test(name) || /zip|compressed|tar/.test(t)) return FileArchive;
  if (/\.(csv|xlsx?|ods)$/i.test(name) || /spreadsheet|csv|excel/.test(t)) return FileSpreadsheet;
  if (/\.(pdf|docx?|odt|rtf|txt|md)$/i.test(name) || t.startsWith("text/") || /pdf|word|document/.test(t)) return FileText;
  return FileGlyph;
}

const isImage = (file: File) => file.type.startsWith("image/");

const fileInfo = (file: File): FileUploadItemInfo => ({ name: file.name, size: file.size, type: file.type });

/** The `File`s among `items`, as a `FileList` a file input can hold. */
function fileListOf(items: readonly unknown[]): FileList {
  const transfer = new DataTransfer();
  for (const item of items) if (item instanceof File) transfer.items.add(item);
  return transfer.files;
}

type PendingStatus = "uploading" | "error" | "canceled";

interface Pending {
  key: string;
  file: File;
  status: PendingStatus;
  /** 0–1, or `null` before the first report. */
  progress: number | null;
  error: string | null;
  controller: AbortController | null;
}

interface FileUploadOwnProps {
  /** The native `accept` grammar (`"image/*,.pdf"`); also checked on drop and paste. */
  accept?: string;
  /** Several files; without it, a new file replaces the current one. @default false */
  multiple?: boolean;
  /** Largest file, in bytes. */
  maxSize?: number;
  /** Most files at once (uploading and failed ones count). Only with `multiple`. */
  maxFiles?: number;
  /** A refusal message for a file, or nothing to accept it. */
  validate?: (file: File) => string | null | undefined;
  /** Take files pasted while focus is in the control. @default false */
  paste?: boolean;
  /**
   * Native submission: without `onUpload`, the hidden `<input type="file">` carries
   * the files; with it, one hidden input per uploaded value (strings and numbers).
   */
  name?: string;
  form?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  labels?: LabelsProp<FileUploadLabels>;
  /** The drop zone's button (the control: it takes the Field's id and the focus). */
  ref?: Ref<HTMLButtonElement>;
  /** `className` styles the root. */
  classNames?: SlotClassNames<"zone" | "list" | "item" | "message">;
}

type FileUploadValueProps<T> =
  | {
      /** Without `onUpload`, the value is the files themselves. */
      onUpload?: undefined;
      value?: readonly File[];
      defaultValue?: readonly File[];
      onValueChange?: (files: File[]) => void;
      describe?: undefined;
    }
  | {
      /**
       * Uploads one file: report progress, honour the signal, resolve with what the
       * value should hold for it (an id, a URL, a record), reject to fail it (Retry
       * calls it again). The value holds only finished uploads.
       */
      onUpload: (file: File, context: FileUploadContext) => Promise<T>;
      value?: readonly T[];
      defaultValue?: readonly T[];
      onValueChange?: (values: T[]) => void;
      /** Shows a value this session did not upload. Default: a string is its own name. */
      describe?: (value: T) => FileUploadItemInfo;
    };

export type FileUploadProps<T = File> = Omit<
  ComponentPropsWithoutRef<"div">,
  keyof FileUploadOwnProps | "defaultValue" | "onChange" | "children"
> &
  FileUploadOwnProps &
  FileUploadValueProps<T>;

const NO_ITEMS: readonly unknown[] = [];

function describeDefault(item: unknown): FileUploadItemInfo {
  if (item instanceof File) return fileInfo(item);
  if (typeof item === "object" && item !== null && typeof (item as { name?: unknown }).name === "string") {
    return item as FileUploadItemInfo;
  }
  return { name: String(item) };
}

/**
 * Files, picked or dropped. The drop zone is a real button that opens the
 * native picker (keyboard and screen readers get the same thing as a drop), and
 * a drag over it says so in words and an icon, not colour alone. Each file is
 * checked against `accept`, `maxSize`, `maxFiles` and `validate`; a refusal is a
 * message under the zone that the surrounding Field counts as its error.
 *
 * Accepted files are listed with an icon or an image thumbnail, name and size.
 * With `onUpload`, each one uploads with a progress bar, can be cancelled
 * (its `AbortSignal`), retried after a failure and removed; the value is what the
 * finished uploads resolved with. Without it, the value is the files. Binds to a
 * `Form` through `Field name`.
 */
export function FileUpload<T = File>(props: FileUploadProps<T>) {
  const {
    accept,
    multiple = false,
    maxSize,
    maxFiles,
    validate,
    paste = false,
    name,
    form,
    id: idProp,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    labels: labelsProp,
    ref,
    className,
    classNames,
    onUpload: onUploadProp,
    value: valueProp,
    defaultValue,
    onValueChange,
    describe: describeProp,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onPaste,
    ...rest
  } = props as FileUploadProps<unknown> & {
    onUpload?: (file: File, context: FileUploadContext) => Promise<unknown>;
    value?: readonly unknown[];
    defaultValue?: readonly unknown[];
    onValueChange?: (values: unknown[]) => void;
    describe?: (value: unknown) => FileUploadItemInfo;
  };
  const labels = mergeLabels(DEFAULT_FILE_UPLOAD_LABELS, labelsProp);
  const uploads = onUploadProp !== undefined;

  const [refusals, setRefusals] = useState<string[]>([]);
  const baseId = useId();
  const promptId = `${baseId}-prompt`;
  const hintId = `${baseId}-hint`;
  const messageId = `${baseId}-message`;
  const hint = labels.hint({ accept, maxSize, maxFiles: multiple ? maxFiles : undefined, multiple });
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp ?? (refusals.length > 0 || undefined),
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby":
      [describedByProp, hint ? hintId : undefined, refusals.length > 0 ? messageId : undefined].filter(Boolean).join(" ") ||
      undefined,
    "aria-invalid": ariaInvalidProp,
  });
  // A refusal is the Field's error too (it marks the Field invalid and describes the zone).
  useFieldMessage("error", messageId, refusals.length > 0);
  const locked = field.disabled === true || field.readOnly === true;

  const [stored, setValue, fieldName] = useFieldValue<readonly unknown[]>({
    value: valueProp,
    defaultValue: defaultValue ?? NO_ITEMS,
    onChange: onValueChange as ((values: readonly unknown[]) => void) | undefined,
    fromForm: (raw) => (Array.isArray(raw) ? raw : NO_ITEMS),
  });
  const submitName = name ?? fieldName;

  // The latest value and pending list, read and written synchronously: two uploads
  // can finish before React re-renders, and each must add to what the other left.
  const valueRef = useRef(stored);
  valueRef.current = stored;
  const update = (next: (prev: readonly unknown[]) => readonly unknown[]) => {
    const resolved = next(valueRef.current);
    valueRef.current = resolved;
    setValue(resolved);
  };
  const [pending, setPending] = useState<readonly Pending[]>([]);
  const pendingRef = useRef(pending);
  const changePending = (next: (prev: readonly Pending[]) => readonly Pending[]) => {
    pendingRef.current = next(pendingRef.current);
    setPending(pendingRef.current);
  };
  // Files behind values uploaded in this session, for their name, size and thumbnail.
  const [sessionFiles, setSessionFiles] = useState<ReadonlyMap<unknown, File>>(() => new Map());

  const latestUpload = useRef(onUploadProp);
  latestUpload.current = onUploadProp;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const entry of pendingRef.current) entry.controller?.abort();
    };
  }, []);

  const [region, announce] = useAnnouncer();
  const [dragging, setDragging] = useState(false);
  const zoneRef = useRef<HTMLButtonElement>(null);
  const setZoneRef = useMemo(() => mergeRefs(ref, zoneRef), [ref]);
  const inputRef = useRef<HTMLInputElement>(null);
  const keys = useRef({ next: 0, objects: new WeakMap<object, string>() });
  const newKey = () => `f${keys.current.next++}`;
  const keyOf = (item: unknown, index: number) => {
    if ((typeof item === "object" && item !== null) || typeof item === "function") {
      const objects = keys.current.objects;
      let key = objects.get(item);
      if (key === undefined) {
        key = newKey();
        objects.set(item, key);
      }
      return key;
    }
    return `v${index}:${String(item)}`;
  };

  const fileOf = (item: unknown): File | undefined => (item instanceof File ? item : sessionFiles.get(item));
  const infoOf = (item: unknown): FileUploadItemInfo => {
    const file = fileOf(item);
    if (file) return fileInfo(file);
    return describeProp ? describeProp(item) : describeDefault(item);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  /** The row of a finished upload whose pending row held focus: its first button takes it. */
  const refocusRow = useRef<string | null>(null);
  const rowElement = (key: string) =>
    [...(rootRef.current?.querySelectorAll<HTMLElement>("li[data-key]") ?? [])].find((li) => li.dataset.key === key);
  useLayoutEffect(() => {
    const key = refocusRow.current;
    if (key === null) return;
    refocusRow.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    rowElement(key)?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  });

  const startUpload = (key: string, file: File) => {
    const upload = latestUpload.current;
    if (!upload) return;
    const controller = new AbortController();
    const live = () => pendingRef.current.some((entry) => entry.controller === controller);
    changePending((list) =>
      list.map((entry) => (entry.key === key ? { ...entry, status: "uploading", progress: null, error: null, controller } : entry)),
    );
    let shown = -1;
    const onProgress = (fraction: number) => {
      if (controller.signal.aborted || !mounted.current || !Number.isFinite(fraction)) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      // Whole percents only: a byte-by-byte report would re-render per chunk.
      if (Math.round(clamped * 100) === shown) return;
      shown = Math.round(clamped * 100);
      changePending((list) => list.map((entry) => (entry.controller === controller ? { ...entry, progress: clamped } : entry)));
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
        // The pending row goes and a value row comes: focus in the one moves to the other.
        const focused = document.activeElement !== null && rowElement(key)?.contains(document.activeElement) === true;
        changePending((list) => list.filter((entry) => entry.controller !== controller));
        setSessionFiles((map) => new Map(map).set(result, file));
        update((prev) => (multiple ? [...prev, result] : [result]));
        if (focused) refocusRow.current = keyOf(result, valueRef.current.lastIndexOf(result));
        announce(labels.uploadedFile(file.name));
      },
      (error: unknown) => {
        if (controller.signal.aborted || !mounted.current || !live()) return;
        const reason = error instanceof Error && error.message ? error.message : null;
        changePending((list) =>
          list.map((entry) => (entry.controller === controller ? { ...entry, status: "error", error: reason, controller: null } : entry)),
        );
        announce(labels.failedFile(file.name));
      },
    );
  };

  /** A refusal for one file, or `null`. */
  const check = (file: File): string | null => {
    if (!matchesAccept(file, accept)) return labels.wrongType(file.name);
    if (maxSize !== undefined && file.size > maxSize) return labels.tooLarge(file.name, maxSize);
    return validate?.(file) || null;
  };

  const addFiles = (files: readonly File[]) => {
    if (locked || files.length === 0) return;
    const refused: string[] = [];
    let accepted = files.filter((file) => {
      const reason = check(file);
      if (reason) refused.push(reason);
      return reason === null;
    });
    // One file: a new one replaces the current one, and only one of a dropped set is taken.
    const room = multiple
      ? maxFiles === undefined
        ? Infinity
        : Math.max(0, maxFiles - valueRef.current.length - pendingRef.current.length)
      : 1;
    if (accepted.length > room) {
      refused.push(labels.tooMany(multiple ? (maxFiles ?? room) : 1, accepted.length - room));
      accepted = accepted.slice(0, room);
    }
    setRefusals(refused);
    if (accepted.length > 0 && uploads) {
      // Taking one file, a new upload supersedes one still running; the current value
      // stays until the new one finishes (or for good, if it fails or is cancelled).
      if (!multiple) {
        for (const entry of pendingRef.current) entry.controller?.abort();
        changePending(() => []);
      }
      const entries = accepted.map<Pending>((file) => ({
        key: newKey(),
        file,
        status: "uploading",
        progress: null,
        error: null,
        controller: null,
      }));
      changePending((list) => [...list, ...entries]);
      for (const entry of entries) startUpload(entry.key, entry.file);
    } else if (accepted.length > 0) {
      update((prev) => (multiple ? [...prev, ...accepted] : accepted));
    }
    const spoken = [accepted.length > 0 ? labels.added(accepted.map((f) => f.name)) : "", ...refused].filter(Boolean).join(" ");
    if (spoken) announce(spoken);
  };

  const cancel = (key: string) => {
    const entry = pendingRef.current.find((e) => e.key === key);
    if (!entry || entry.status !== "uploading") return;
    entry.controller?.abort();
    changePending((list) => list.map((e) => (e.key === key ? { ...e, status: "canceled", controller: null } : e)));
    announce(labels.canceledFile(entry.file.name));
  };

  const removeRow = (row: Row) => {
    if (row.kind === "pending") {
      row.entry.controller?.abort();
      changePending((list) => list.filter((e) => e.key !== row.key));
    } else {
      update((prev) => prev.filter((item) => item !== row.item));
    }
    setRefusals([]);
    announce(labels.removedFile(row.info.name));
    // The row's buttons are gone: focus the zone rather than drop to the page.
    zoneRef.current?.focus();
  };

  const rows: Row[] = [
    ...stored.map<Row>((item, index) => ({
      kind: "value",
      key: keyOf(item, index),
      item,
      info: infoOf(item),
      file: fileOf(item),
      uploaded: uploads && sessionFiles.has(item),
    })),
    ...pending.map<Row>((entry) => ({
      kind: "pending",
      key: entry.key,
      entry,
      info: fileInfo(entry.file),
      file: entry.file,
    })),
  ];

  const shownImages = rows.flatMap((row) => (row.file && isImage(row.file) ? [row.file] : []));
  const previews = useObjectUrls(shownImages, shownImages.map((file) => keyOf(file, 0)).join(" "));

  // Without `onUpload`, the hidden file input carries the value for a native submit.
  const fileInputName = uploads ? undefined : submitName;
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !fileInputName || typeof DataTransfer === "undefined") return;
    input.files = fileListOf(stored);
  }, [stored, fileInputName]);

  const handlePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    // The input shows the value again (or nothing), never a refused pick.
    if (fileInputName && typeof DataTransfer !== "undefined") {
      event.target.files = fileListOf(valueRef.current);
    } else {
      event.target.value = "";
    }
    addFiles(picked);
  };

  const carriesFiles = (event: DragEvent) => [...event.dataTransfer.types].includes("Files");
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = locked ? "none" : "copy";
    if (!locked) setDragging(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    addFiles([...event.dataTransfer.files]);
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!paste || locked) return;
    const files = [...event.clipboardData.files];
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  };

  const labelledBy = ariaLabelledBy ?? (ariaLabel === undefined ? [field.labelId, promptId].filter(Boolean).join(" ") : undefined);

  return (
    <div
      ref={rootRef}
      className={cn("grid min-w-0 gap-r4", className)}
      data-dragging={dragging ? "" : undefined}
      {...rest}
      onDragEnter={composeEventHandlers(onDragEnter, handleDragOver)}
      onDragOver={composeEventHandlers(onDragOver, handleDragOver)}
      onDragLeave={composeEventHandlers(onDragLeave, handleDragLeave)}
      onDrop={composeEventHandlers(onDrop, handleDrop)}
      onPaste={composeEventHandlers(onPaste, handlePaste)}
    >
      <button
        ref={setZoneRef}
        type="button"
        id={field.id}
        disabled={field.disabled}
        aria-disabled={field.readOnly || undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        {...field.ariaProps}
        data-dragging={dragging ? "" : undefined}
        data-invalid={field.invalid ? "" : undefined}
        data-readonly={field.readOnly ? "" : undefined}
        className={cn(
          "r-form-upload-zone flex w-full min-w-0 flex-col items-center justify-center gap-r5 px-r3 py-r3 text-center",
          classNames?.zone,
        )}
        onClick={() => {
          if (!locked) inputRef.current?.click();
        }}
      >
        <span className="r-form-upload-zone-icon" aria-hidden>
          {dragging ? <ArrowDownToLine className="size-icon" /> : <Upload className="size-icon" />}
        </span>
        <span id={promptId} className="max-w-full break-words text-body-1 font-medium text-fg-primary">
          {dragging ? labels.dropping(multiple) : labels.prompt(multiple)}
        </span>
        {hint && (
          <span id={hintId} className="max-w-full break-words text-body-2 text-fg-muted">
            {hint}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        name={fileInputName}
        form={form}
        disabled={field.disabled}
        onChange={handlePicked}
      />
      {refusals.length > 0 && (
        <div id={messageId} className={cn("grid gap-r6", classNames?.message)}>
          {refusals.map((message, index) => (
            <ErrorLine key={index}>{message}</ErrorLine>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <ul aria-label={labels.files} className={cn("min-w-0 divide-y rounded-lg border", classNames?.list)}>
          {rows.map((row) => (
            <FileRow
              key={row.key}
              row={row}
              preview={row.file ? previews.get(row.file) : row.info.previewUrl ? safeUrl(row.info.previewUrl) : undefined}
              labels={labels}
              disabled={locked}
              className={classNames?.item}
              onCancel={() => cancel(row.key)}
              onRetry={() => {
                if (row.kind === "pending") startUpload(row.key, row.entry.file);
              }}
              onRemove={() => removeRow(row)}
            />
          ))}
        </ul>
      )}
      {uploads && <HiddenValues name={submitName} values={stored.filter(isSubmittable).map(String)} form={form} />}
      {region}
    </div>
  );
}

/**
 * An object URL per file (the thumbnails), minted in an effect (a render may
 * run twice) and revoked once the file leaves `files` or the control unmounts.
 * `filesKey` changes exactly when `files` does.
 */
function useObjectUrls(files: readonly File[], filesKey: string): ReadonlyMap<File, string> {
  const [urls, setUrls] = useState<ReadonlyMap<File, string>>(() => new Map());
  const liveUrls = useRef(new Map<File, string>());
  useEffect(() => {
    const live = liveUrls.current;
    const wanted = new Set(files);
    let changed = false;
    for (const file of wanted) {
      if (!live.has(file)) {
        live.set(file, URL.createObjectURL(file));
        changed = true;
      }
    }
    for (const [file, url] of live) {
      if (!wanted.has(file)) {
        URL.revokeObjectURL(url);
        live.delete(file);
        changed = true;
      }
    }
    if (changed) setUrls(new Map(live));
    // `filesKey` names exactly the files in `files`.
  }, [filesKey]);
  useEffect(() => {
    const live = liveUrls.current;
    return () => {
      for (const url of live.values()) URL.revokeObjectURL(url);
      live.clear();
    };
  }, []);
  return urls;
}

const isSubmittable = (item: unknown): item is string | number => typeof item === "string" || typeof item === "number";

type Row =
  | { kind: "value"; key: string; item: unknown; info: FileUploadItemInfo; file: File | undefined; uploaded: boolean }
  | { kind: "pending"; key: string; entry: Pending; info: FileUploadItemInfo; file: File };

function FileRow({
  row,
  preview,
  labels,
  disabled,
  className,
  onCancel,
  onRetry,
  onRemove,
}: {
  row: Row;
  preview: string | undefined;
  labels: FileUploadLabels;
  disabled: boolean;
  className: string | undefined;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { name, size, type } = row.info;
  const Glyph = glyphFor(type, name);
  const status = row.kind === "pending" ? row.entry.status : row.uploaded ? "uploaded" : "attached";
  const progress = row.kind === "pending" ? row.entry.progress : null;
  const showThumb = preview !== undefined && preview !== "" && (type ?? "").startsWith("image/");

  // A status change swaps the row's buttons (Cancel becomes Retry and Remove). If
  // the focused one went with it, focus stays in the row instead of dropping to the page.
  const itemRef = useRef<HTMLLIElement>(null);
  const hadFocus = useRef(false);
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!hadFocus.current || (active !== null && active !== document.body)) return;
    itemRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [status]);

  return (
    <li
      ref={itemRef}
      data-key={row.key}
      className={cn("flex min-w-0 items-center gap-r4 px-r4 py-r5", className)}
      data-status={status}
      onFocus={() => {
        hadFocus.current = true;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node) {
          if (!event.currentTarget.contains(next)) hadFocus.current = false;
          return;
        }
        // Nowhere (a press on the page, the window losing focus) or a focused
        // button unmounting with a status change. Decide once the commit has
        // settled: the layout effect above has refocused the row by then if it
        // was the latter.
        const row = event.currentTarget;
        queueMicrotask(() => {
          if (!row.contains(document.activeElement)) hadFocus.current = false;
        });
      }}
    >
      <span className="r-form-upload-thumb" aria-hidden>
        {showThumb ? <img src={preview} alt="" className="size-full object-cover" /> : <Glyph className="size-icon" />}
      </span>
      <div className="grid min-w-0 flex-1 gap-r6">
        <div className="flex min-w-0 items-baseline gap-r4">
          <span className="min-w-0 flex-1 truncate text-body-1 text-fg-primary" title={name}>
            {name}
          </span>
          {size !== undefined && <span className="shrink-0 text-body-2 tabular-nums text-fg-muted">{formatBytes(size)}</span>}
        </div>
        {status === "uploading" && (
          <div className="flex min-w-0 items-center gap-r4">
            <div
              role="progressbar"
              aria-label={labels.progress(name)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress === null ? undefined : Math.round(progress * 100)}
              aria-valuetext={progress === null ? labels.waiting : undefined}
              className="h-r5 min-w-0 flex-1 overflow-hidden rounded-full bg-fg-primary/10"
            >
              <div
                className="h-full rounded-full bg-accent transition-[inline-size] duration-normal ease-standard"
                style={{ inlineSize: `${(progress ?? 0) * 100}%` }}
              />
            </div>
            <span aria-hidden className="shrink-0 text-body-2 tabular-nums text-fg-secondary">
              {progress === null ? labels.waiting : formatPercent(progress, { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
        {status === "uploaded" && <StatusLabel tone="success">{labels.uploaded}</StatusLabel>}
        {status === "canceled" && <StatusLabel tone="neutral">{labels.canceled}</StatusLabel>}
        {status === "error" && row.kind === "pending" && <ErrorLine>{labels.failed(row.entry.error)}</ErrorLine>}
      </div>
      <div data-print="hide" className="flex shrink-0 items-center gap-r6">
        {status === "uploading" && <IconButton label={labels.cancel(name)} icon={<X />} onClick={onCancel} disabled={disabled} />}
        {(status === "error" || status === "canceled") && (
          <IconButton label={labels.retry(name)} icon={<RotateCw />} onClick={onRetry} disabled={disabled} />
        )}
        {status !== "uploading" && <IconButton label={labels.remove(name)} icon={<Trash2 />} onClick={onRemove} disabled={disabled} />}
      </div>
    </li>
  );
}
