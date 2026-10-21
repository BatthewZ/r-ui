"use client";
import { Check, ChevronRight, Minus } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useRowHeight } from "../../hooks/use-row-height";
import { useVirtualRows } from "../../hooks/use-virtual-rows";
import { elementChildren } from "../../util/children";
import { isRtl } from "../../util/direction";
import { ErrorLine } from "../../util/error-line";
import { type LabelsProp, useLabels } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { useIsCurrent, useLinkElement, useRouter } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { foldText } from "../../util/text-match";
import { Skeleton, Spinner } from "../primitives";
import {
  ancestorsOf,
  type CheckState,
  checkStates,
  indexTree,
  isCurrentNode,
  needsLoad,
  nodeHref,
  sameIds,
  statusRowParent,
  type TreeLoadState,
  type TreeNode,
  type TreeRow,
  toggleChecked,
  visibleRows,
} from "./tree-model";

export type { TreeNode } from "./tree-model";

export interface TreeViewLabels {
  /** Beside a parent whose children are loading, and the whole tree's loading status. */
  loading: string;
  /** The row that stands in for children that failed to load. */
  loadError: string;
  /** After `loadError`: what pressing that row does. */
  retry: string;
  /** Announced once a parent's children arrive. */
  loaded: (count: number) => string;
  /** A tree with no items. */
  empty: string;
}

export const DEFAULT_TREE_VIEW_LABELS: TreeViewLabels = {
  loading: "Loading…",
  loadError: "Couldn’t load these items.",
  retry: "Retry",
  loaded: (count) => (count === 1 ? "1 item loaded" : `${count} items loaded`),
  empty: "Nothing here yet.",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    TreeView: TreeViewLabels;
  }
}

export type TreeViewSelectionMode = "none" | "single" | "multiple";

/** The tree's accessible name: `aria-label` or `aria-labelledby`, one of them required. */
type TreeViewName = { "aria-label": string; "aria-labelledby"?: string } | { "aria-label"?: string; "aria-labelledby": string };

export type TreeViewProps = TreeViewName & {
  /** The nodes, as data. Or write `TreeView.Item`s as children. */
  items?: readonly TreeNode[];
  /** `TreeView.Item` elements, nested as the tree is (used when `items` is not given). */
  children?: ReactNode;
  /**
   * - `none` (default): Enter or a press activates (a link follows; a parent opens or closes).
   * - `single`: one node is selected (`aria-selected`); Enter, Space or a press selects.
   * - `multiple`: a tri-state check per node (`aria-checked`); a parent checks everything
   *   under it and shows mixed when some of it is checked. Enter, Space or a press toggles.
   */
  selectionMode?: TreeViewSelectionMode;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  /** `multiple`: the fully checked ids, in tree order (a checked parent's unloaded children are implied). */
  checkedIds?: readonly string[];
  defaultCheckedIds?: readonly string[];
  onCheckedIdsChange?: (ids: readonly string[]) => void;
  expandedIds?: readonly string[];
  /** Omitted: the ancestors of the current link (a nav tree opens down to the page you are on). */
  defaultExpandedIds?: readonly string[];
  onExpandedIdsChange?: (ids: readonly string[]) => void;
  /**
   * Fetches a `hasChildren` node's children the first time it opens. While it
   * runs, a loading row stands in; a rejection shows an error row that retries.
   */
  loadChildren?: (id: string) => Promise<readonly TreeNode[]>;
  /** Enter or a press on an enabled node (after the selection changes, if it does). */
  onAction?: (id: string, node: TreeNode) => void;
  /**
   * Controls at the end of a row (rename, delete). Spread `tabIndex` onto each:
   * only the focused row's actions are in the Tab order, so Tab goes from the
   * row to its actions and then out of the tree.
   */
  renderActions?: (node: TreeNode, context: { tabIndex: 0 | -1 }) => ReactNode;
  /** The whole tree is loading: skeleton rows. */
  loading?: boolean;
  /** The whole tree failed: this message instead of rows. */
  error?: ReactNode;
  /**
   * Past this many visible rows, only the rows in view are mounted. The rows
   * are then exactly `--ROW-H` (labels truncate) and the tree scrolls in a
   * box twelve rows tall (`className` can change the height). Default 200.
   */
  virtualizeAbove?: number;
  labels?: LabelsProp<TreeViewLabels>;
  /** `className` styles the tree; these style each row's parts. */
  classNames?: SlotClassNames<"item" | "toggle" | "check" | "icon" | "label" | "actions">;
} & Omit<ComponentPropsWithRef<"div">, "children" | "aria-label" | "aria-labelledby">;

export type TreeViewItemProps = Omit<TreeNode, "children"> & {
  /** Nested `TreeView.Item`s. */
  children?: ReactNode;
};

/** A node written as JSX. Read by `TreeView`; renders nothing on its own. */
function TreeViewItem(_props: TreeViewItemProps): null {
  return null;
}

function nodesFromChildren(children: ReactNode): TreeNode[] {
  return elementChildren<TreeViewItemProps>(children, TreeViewItem).map(({ props }) => {
    const { children: nested, ...node } = props;
    const kids = nodesFromChildren(nested);
    return kids.length > 0 ? { ...node, children: kids } : node;
  });
}

const textOf = (node: TreeNode) => node.textValue ?? (typeof node.label === "string" ? node.label : "");
const domId = (base: string, key: string) => `${base}-${encodeURIComponent(key)}`;
const TYPEAHEAD_MS = 500;
const EMPTY: readonly string[] = [];

/**
 * A hierarchy (files, permissions, a docs nav) per the WAI-ARIA tree view
 * pattern: one tab stop; Up/Down move; Right opens a parent, then enters it;
 * Left closes it, then goes to the parent (both mirrored right to left); Home,
 * End; `*` opens every sibling; typing jumps to a label. Each row reports its
 * `aria-level`, `aria-setsize` and `aria-posinset`, so the rows can be one flat
 * list, windowed past `virtualizeAbove`.
 */
function TreeViewRoot(props: TreeViewProps) {
  const {
    items,
    children,
    selectionMode = "none",
    selectedId: selectedIdProp,
    defaultSelectedId = null,
    onSelectedIdChange,
    checkedIds: checkedIdsProp,
    defaultCheckedIds = EMPTY,
    onCheckedIdsChange,
    expandedIds: expandedIdsProp,
    defaultExpandedIds,
    onExpandedIdsChange,
    loadChildren,
    onAction,
    renderActions,
    loading = false,
    error,
    virtualizeAbove = 200,
    labels: labelsProp,
    className,
    classNames,
    ref,
    onKeyDown,
    onFocus,
    onBlur,
    ...rest
  } = props;
  const labels = useLabels("TreeView", DEFAULT_TREE_VIEW_LABELS, labelsProp);
  const { isCurrent } = useRouter();
  const baseId = useId();
  const nodes = useMemo(() => items ?? nodesFromChildren(children), [items, children]);
  const canLoad = loadChildren !== undefined;

  const [loads, setLoads] = useState<ReadonlyMap<string, TreeLoadState>>(() => new Map());
  const index = useMemo(() => indexTree(nodes, loads), [nodes, loads]);

  const [initialExpanded] = useState<readonly string[]>(() => {
    if (defaultExpandedIds) return defaultExpandedIds;
    const current = [...index.values()].filter(({ node }) => isCurrentNode(node, isCurrent));
    return ancestorsOf(
      index,
      current.map(({ node }) => node.id),
    );
  });
  const [expandedIds, setExpandedIds] = useControllableState<readonly string[]>({
    value: expandedIdsProp,
    defaultValue: initialExpanded,
    onChange: onExpandedIdsChange,
    isEqual: sameIds,
  });
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);

  const [selectedId, setSelectedId] = useControllableState<string | null>({
    value: selectedIdProp,
    defaultValue: defaultSelectedId,
    onChange: onSelectedIdChange,
  });
  const [checkedIds, setCheckedIds] = useControllableState<readonly string[]>({
    value: checkedIdsProp,
    defaultValue: defaultCheckedIds,
    onChange: onCheckedIdsChange,
    isEqual: sameIds,
  });
  const checked = useMemo(() => new Set(checkedIds), [checkedIds]);
  const states = useMemo(
    () => (selectionMode === "multiple" ? checkStates(nodes, loads, checked) : null),
    [selectionMode, nodes, loads, checked],
  );

  const rows = useMemo(() => visibleRows(nodes, expanded, loads, canLoad), [nodes, expanded, loads, canLoad]);
  // The rows the keyboard walks: nodes and error rows (a loading row vanishes under focus).
  const stops = useMemo(() => rows.filter((row) => row.kind !== "loading"), [rows]);

  // ── Focus: one tab stop, moved by the keyboard ───────────────────────────
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const tabKey = useMemo(() => {
    // The focused row, or the nearest ancestor still on screen once a collapse hid it.
    const visible = new Set(stops.map((row) => row.key));
    let key = focusedKey;
    if (key !== null && !visible.has(key) && !index.has(key)) key = statusRowParent(key);
    while (key !== null) {
      if (visible.has(key)) return key;
      key = index.get(key)?.parentId ?? null;
    }
    const isNode = (row: TreeRow): row is Extract<TreeRow, { kind: "node" }> => row.kind === "node";
    const nodeRows = stops.filter(isNode);
    const current = nodeRows.find(({ node }) => isCurrentNode(node, isCurrent));
    const selected = selectionMode === "single" ? nodeRows.find(({ node }) => node.id === selectedId) : undefined;
    return (current ?? selected ?? stops[0])?.key ?? null;
  }, [focusedKey, stops, index, isCurrent, selectionMode, selectedId]);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const linkRefs = useRef(new Map<string, HTMLElement>());
  const focusPending = useRef(false);
  /** The element inside the tree that last had focus, while focus is still in the tree. */
  const lastFocused = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const focusRow = useCallback((key: string) => {
    focusPending.current = true;
    setFocusedKey(key);
  }, []);
  useLayoutEffect(() => {
    if (tabKey === null) return;
    // A row that unmounted under focus (its branch closed by the owner) hands focus to the tab stop.
    const orphaned = lastFocused.current?.isConnected === false && (document.activeElement ?? document.body) === document.body;
    if (!focusPending.current && !orphaned) return;
    focusPending.current = false;
    rowRefs.current.get(tabKey)?.focus();
  });

  // ── Lazy children ────────────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("");
  const loadRef = useRef(loadChildren);
  loadRef.current = loadChildren;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const load = loadRef.current;
    if (!load) return;
    for (const id of expanded) {
      const entry = index.get(id);
      if (!entry || loads.has(id) || inFlight.current.has(id) || !needsLoad(entry.node, loads, true)) continue;
      inFlight.current.add(id);
      setLoads((prev) => new Map(prev).set(id, { status: "loading" }));
      setAnnouncement(labelsRef.current.loading);
      const settle = (state: TreeLoadState, message: string) => {
        inFlight.current.delete(id);
        if (!mounted.current) return;
        setLoads((prev) => new Map(prev).set(id, state));
        setAnnouncement(message);
      };
      load(id).then(
        (kids) => settle({ status: "loaded", children: kids }, labelsRef.current.loaded(kids.length)),
        (reason: unknown) => settle({ status: "error", error: reason }, labelsRef.current.loadError),
      );
    }
  }, [expanded, index, loads]);

  const retry = (parentId: string) => {
    // The error row leaves; the parent keeps focus while the load runs again.
    focusRow(parentId);
    setLoads((prev) => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  };

  // ── Expansion, selection, activation ────────────────────────────────────
  const setExpanded = (id: string, open: boolean) => {
    setExpandedIds((prev) => (open ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  };

  /** Selects or toggles the check, never follows a link: Space's whole job. */
  const choose = (node: TreeNode) => {
    if (node.disabled) return;
    if (selectionMode === "single") setSelectedId(node.id);
    else if (selectionMode === "multiple") setCheckedIds((prev) => toggleChecked(nodes, loads, new Set(prev), node.id));
  };

  const activate = (row: TreeRow, fromLink: boolean) => {
    if (row.kind === "error") {
      retry(row.parentId);
      return;
    }
    if (row.kind !== "node" || row.node.disabled) return;
    const { node } = row;
    const href = nodeHref(node);
    if (href !== undefined && !fromLink) {
      // The link's own click runs the router; it comes back here with fromLink.
      linkRefs.current.get(row.key)?.click();
      return;
    }
    if (selectionMode !== "none") choose(node);
    else if (row.expandable && href === undefined) setExpanded(node.id, !row.expanded);
    onAction?.(node.id, node);
  };

  // ── Typeahead ────────────────────────────────────────────────────────────
  const typed = useRef({ text: "", at: 0 });
  const typeahead = (char: string, fromIndex: number) => {
    const now = Date.now();
    const text = now - typed.current.at > TYPEAHEAD_MS ? char : typed.current.text + char;
    typed.current = { text, at: now };
    // The same letter pressed again cycles through the labels that start with it.
    const repeated = [...text].every((c) => c === text[0]);
    const query = foldText(repeated ? char : text);
    const begin = repeated || text.length === 1 ? fromIndex + 1 : fromIndex;
    for (let step = 0; step < stops.length; step++) {
      const row = stops[(begin + step) % stops.length];
      if (row?.kind === "node" && foldText(textOf(row.node)).startsWith(query)) {
        focusRow(row.key);
        return;
      }
    }
  };

  const rowOf = (target: EventTarget): { row: TreeRow; at: number; el: HTMLElement } | null => {
    const el = (target as Element).closest?.<HTMLElement>("[data-tree-key]");
    const key = el?.dataset.treeKey;
    if (!el || key === undefined) return null;
    const at = stops.findIndex((row) => row.key === key);
    const row = stops[at];
    return row ? { row, at, el } : null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as Element;
    if (target.closest("[data-tree-actions]")) return;
    const hit = rowOf(target);
    if (!hit) return;
    const { row, at, el } = hit;
    const node = row.kind === "node" ? row : null;
    let key = event.key;
    if (isRtl(el) && (key === "ArrowLeft" || key === "ArrowRight")) key = key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
    const move = (to: number) => {
      const next = stops[Math.max(0, Math.min(stops.length - 1, to))];
      if (next) focusRow(next.key);
    };
    switch (key) {
      case "ArrowDown":
        move(at + 1);
        break;
      case "ArrowUp":
        move(at - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(stops.length - 1);
        break;
      case "ArrowRight":
        if (node?.expandable && !node.expanded) setExpanded(node.node.id, true);
        else if (node?.expanded) {
          const first = stops[at + 1];
          if (first && first.parentId === node.node.id) focusRow(first.key);
        }
        break;
      case "ArrowLeft":
        if (node?.expanded) setExpanded(node.node.id, false);
        else if (row.parentId !== null) focusRow(row.parentId);
        break;
      case "Enter":
        // A press on the link itself is the link's own (it activates natively).
        if (target.closest("[data-tree-link]")) return;
        activate(row, false);
        break;
      case " ":
        if (row.kind === "error") activate(row, false);
        else if (node) choose(node.node);
        break;
      case "*": {
        const siblings = stops.filter(
          (r): r is Extract<TreeRow, { kind: "node" }> => r.kind === "node" && r.parentId === row.parentId && r.expandable,
        );
        setExpandedIds((prev) => [...prev, ...siblings.map((r) => r.node.id).filter((id) => !prev.includes(id))]);
        break;
      }
      default:
        if (event.key.length === 1 && event.key !== " ") {
          typeahead(event.key, at);
          break;
        }
        return;
    }
    event.preventDefault();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    lastFocused.current = event.target;
    const hit = rowOf(event.target);
    if (hit && hit.row.key !== focusedKey) setFocusedKey(hit.row.key);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) lastFocused.current = null;
  };

  const handleRowClick = (event: MouseEvent<HTMLElement>, row: TreeRow) => {
    const target = event.target as Element;
    if (target.closest("[data-tree-actions]")) return;
    if (row.kind === "node" && target.closest("[data-tree-toggle]")) {
      setExpanded(row.node.id, !row.expanded);
      return;
    }
    activate(row, Boolean(target.closest("[data-tree-link]")));
  };

  // ── Windowing ────────────────────────────────────────────────────────────
  const virtual = rows.length > virtualizeAbove;
  const rowHeight = useRowHeight(rootRef, 40, virtual);
  const windowed = useVirtualRows({
    rowCount: virtual ? rows.length : 0,
    rowHeight,
    scrollRef: rootRef,
    initialViewport: rowHeight * 12,
    overscan: 6,
  });

  const rootClasses = cn("r-navigation-tree", virtual && "r-navigation-tree-windowed", className);
  const setRootRef = useMemo(() => mergeRefs(ref, rootRef), [ref]);

  // The live region sits beside the tree: a tree owns only tree items and groups.
  const status = (
    <span role="status" className="sr-only">
      {loading ? labels.loading : announcement}
    </span>
  );

  if (loading) {
    return (
      <>
        <div ref={setRootRef} role="tree" aria-busy="true" {...rest} className={rootClasses}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="r-navigation-tree-item">
              <span className="r-navigation-tree-toggle" />
              <Skeleton className={i === 2 ? "w-3/5" : undefined} />
            </div>
          ))}
        </div>
        {status}
      </>
    );
  }
  if (error != null || rows.length === 0) {
    return (
      <div ref={setRootRef} role="group" {...rest} className={rootClasses}>
        {error != null ? (
          <ErrorLine className="px-r5 py-r6">{error}</ErrorLine>
        ) : (
          <p className="px-r5 py-r6 text-body-1 text-fg-muted">{labels.empty}</p>
        )}
      </div>
    );
  }

  const renderRow = (row: TreeRow, rowIndex: number) => {
    const style = {
      "--r-navigation-tree-depth": row.level - 1,
      ...(virtual ? { position: "absolute", insetInline: 0, top: rowIndex * rowHeight } : null),
    } as CSSProperties;
    if (row.kind === "loading") {
      return (
        <div key={row.key} aria-hidden data-tree-loading="" style={style} className={cn("r-navigation-tree-item", classNames?.item)}>
          <span className="r-navigation-tree-toggle" />
          <span className="r-navigation-tree-label text-fg-muted">{labels.loading}</span>
        </div>
      );
    }
    if (row.kind === "error") {
      return (
        <div
          key={row.key}
          ref={(el) => {
            if (el) rowRefs.current.set(row.key, el);
            else rowRefs.current.delete(row.key);
          }}
          role="treeitem"
          aria-level={row.level}
          aria-setsize={1}
          aria-posinset={1}
          data-tree-key={row.key}
          data-tree-error=""
          tabIndex={row.key === tabKey ? 0 : -1}
          style={style}
          onClick={(event) => handleRowClick(event, row)}
          className={cn("r-navigation-tree-item hover:bg-fg-primary/8", classNames?.item)}
        >
          <span className="r-navigation-tree-toggle" />
          <ErrorLine className="r-navigation-tree-label min-w-0">
            {labels.loadError} <span className="r-navigation-tree-retry">{labels.retry}</span>
          </ErrorLine>
        </div>
      );
    }
    return (
      <TreeItemRow
        key={row.key}
        row={row}
        itemId={domId(baseId, row.key)}
        mode={selectionMode}
        selected={selectedId === row.node.id}
        checkState={states?.get(row.node.id) ?? false}
        loading={row.expanded && loads.get(row.node.id)?.status === "loading"}
        tabStop={row.key === tabKey}
        style={style}
        classNames={classNames}
        actions={renderActions?.(row.node, { tabIndex: row.key === tabKey ? 0 : -1 })}
        rowRef={(el) => {
          if (el) rowRefs.current.set(row.key, el);
          else rowRefs.current.delete(row.key);
        }}
        linkRef={(el) => {
          if (el) linkRefs.current.set(row.key, el);
          else linkRefs.current.delete(row.key);
        }}
        onClick={(event) => handleRowClick(event, row)}
      />
    );
  };

  let body: ReactNode;
  if (virtual) {
    // Absolute rows at index × --ROW-H, so the focused row stays mounted (and
    // focusable) wherever the window is.
    const mountedRows = new Set<number>();
    for (let i = windowed.startIndex; i < windowed.endIndex; i++) mountedRows.add(i);
    const focusedIndex = rows.findIndex((row) => row.key === tabKey);
    if (focusedIndex >= 0) mountedRows.add(focusedIndex);
    body = (
      <div role="none" className="relative" style={{ blockSize: windowed.totalHeight }}>
        {[...mountedRows].sort((a, b) => a - b).map((i) => (rows[i] ? renderRow(rows[i], i) : null))}
      </div>
    );
  } else {
    body = rows.map((row, i) => renderRow(row, i));
  }

  return (
    <>
      <div
        ref={setRootRef}
        role="tree"
        aria-multiselectable={selectionMode === "multiple" || undefined}
        {...rest}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={rootClasses}
      >
        {body}
      </div>
      {status}
    </>
  );
}

interface TreeItemRowProps {
  row: Extract<TreeRow, { kind: "node" }>;
  itemId: string;
  mode: TreeViewSelectionMode;
  selected: boolean;
  checkState: CheckState;
  loading: boolean;
  tabStop: boolean;
  style: CSSProperties;
  classNames: TreeViewProps["classNames"];
  actions: ReactNode;
  rowRef: (el: HTMLElement | null) => void;
  linkRef: (el: HTMLElement | null) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

function TreeItemRow({
  row,
  itemId,
  mode,
  selected,
  checkState,
  loading,
  tabStop,
  style,
  classNames,
  actions,
  rowRef,
  linkRef,
  onClick,
}: TreeItemRowProps) {
  const { node } = row;
  const href = node.disabled ? undefined : nodeHref(node);
  const LinkElement = useLinkElement(undefined, href);
  const current = useIsCurrent(node.current, href);
  const labelId = `${itemId}-label`;
  const label =
    href !== undefined ? (
      <LinkElement
        ref={linkRef}
        id={labelId}
        href={href}
        tabIndex={-1}
        data-tree-link=""
        className={cn("r-navigation-tree-label r-navigation-tree-link", classNames?.label)}
      >
        {node.label}
      </LinkElement>
    ) : (
      <span id={labelId} className={cn("r-navigation-tree-label", classNames?.label)}>
        {node.label}
      </span>
    );

  return (
    <div
      ref={rowRef}
      id={itemId}
      role="treeitem"
      aria-labelledby={labelId}
      aria-level={row.level}
      aria-setsize={row.setSize}
      aria-posinset={row.posInSet}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={mode === "single" ? selected : undefined}
      aria-checked={mode === "multiple" ? checkState : undefined}
      aria-disabled={node.disabled || undefined}
      aria-busy={loading || undefined}
      aria-current={current ? "page" : undefined}
      data-tree-key={row.key}
      tabIndex={tabStop ? 0 : -1}
      style={style}
      onClick={onClick}
      className={cn(
        "r-navigation-tree-item",
        "not-aria-selected:hover:bg-fg-primary/8 aria-selected:bg-selection aria-selected:text-fg-on-selection",
        classNames?.item,
      )}
    >
      {row.expandable ? (
        <span aria-hidden data-tree-toggle="" className={cn("r-navigation-tree-toggle hit-area cursor-pointer", classNames?.toggle)}>
          {loading ? <Spinner /> : <ChevronRight className="r-navigation-tree-chevron" />}
        </span>
      ) : (
        <span aria-hidden className={cn("r-navigation-tree-toggle", classNames?.toggle)} />
      )}
      {mode === "multiple" && (
        <span aria-hidden className={cn("r-navigation-tree-check", classNames?.check)}>
          {checkState === "mixed" ? <Minus strokeWidth={3} /> : checkState ? <Check strokeWidth={3} /> : null}
        </span>
      )}
      {node.icon != null && (
        <span aria-hidden className={cn("r-navigation-tree-icon", classNames?.icon)}>
          {node.icon}
        </span>
      )}
      {label}
      {actions != null && (
        <span data-tree-actions="" data-print="hide" className={cn("r-navigation-tree-actions", classNames?.actions)}>
          {actions}
        </span>
      )}
    </div>
  );
}

export const TreeView = Object.assign(TreeViewRoot, { Item: TreeViewItem });
