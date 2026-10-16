/** A column of a board. Cards name it by `id`; `limit` is its work-in-progress limit. */
export interface KanbanColumn {
  id: string;
  /** Shown in the header and spoken in every announcement. */
  title: string;
  /** Work-in-progress limit: above it the column is marked and a move into it is announced. */
  limit?: number;
}

/** A card: anything with an `id` and the `columnId` it sits in. Order within a column is the order in the array. */
export interface KanbanItem {
  id: string;
  columnId: string;
}

/** A place on the board: a column and a zero-based index among that column's cards. */
export interface KanbanPosition {
  column: string;
  index: number;
}

/**
 * What a drop did. `to.index` is the card's index in its column after the move
 * (counted without the card itself before it, so a card moved down one place
 * in its own column goes from `index: 1` to `index: 2`).
 */
export interface KanbanMove {
  id: string;
  from: KanbanPosition;
  to: KanbanPosition;
}

/** Each column's cards, in array order. A card naming no listed column is left out. */
export function cardsByColumn<T extends KanbanItem>(columns: readonly KanbanColumn[], items: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>(columns.map((c) => [c.id, []]));
  for (const item of items) out.get(item.columnId)?.push(item);
  return out;
}

/** Where a card sits now, or `null` when it is not on the board. */
export function positionOf(byColumn: ReadonlyMap<string, readonly KanbanItem[]>, id: string): KanbanPosition | null {
  for (const [column, cards] of byColumn) {
    const index = cards.findIndex((c) => c.id === id);
    if (index >= 0) return { column, index };
  }
  return null;
}

/**
 * The places a card can land in `column`: the other cards there, plus one. A
 * card moving within its own column does not count itself.
 */
export function slotsIn(byColumn: ReadonlyMap<string, readonly KanbanItem[]>, column: string, id: string): number {
  const cards = byColumn.get(column) ?? [];
  return cards.filter((c) => c.id !== id).length + 1;
}

/**
 * `items` with card `id` moved to `to`: out of its place, its `columnId` set,
 * and in before the card that holds `to.index` in that column (after the
 * column's last card, past its end). Every other card keeps its order.
 */
export function moveItem<T extends KanbanItem>(items: readonly T[], id: string, to: KanbanPosition): T[] {
  const item = items.find((i) => i.id === id);
  if (!item) return [...items];
  const rest = items.filter((i) => i.id !== id);
  const moved = item.columnId === to.column ? item : { ...item, columnId: to.column };
  const inColumn: number[] = [];
  rest.forEach((i, at) => {
    if (i.columnId === to.column) inColumn.push(at);
  });
  const before = inColumn[Math.max(0, to.index)];
  const last = inColumn.at(-1);
  const at = before ?? (last === undefined ? rest.length : last + 1);
  rest.splice(at, 0, moved);
  return rest;
}

/** The index a pointer at `y` picks among cards whose vertical midpoints are `mids` (top to bottom). */
export function indexAt(mids: readonly number[], y: number): number {
  let index = 0;
  for (const mid of mids) if (y > mid) index++;
  return index;
}

/**
 * The column a pointer at `x` is over: the one whose box spans it, else the
 * nearest by its edge (a pointer in a gap or past the last column).
 */
export function columnAt(boxes: readonly { id: string; left: number; right: number }[], x: number): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const box of boxes) {
    const distance = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;
    if (distance < bestDistance) {
      best = box.id;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * How fast to scroll toward an edge the pointer is within `edge` px of: 0
 * outside, rising linearly to `max` at the edge (and past it). Negative toward
 * the start.
 */
export function edgeSpeed(pointer: number, start: number, end: number, edge: number, max: number): number {
  const zone = Math.min(edge, (end - start) / 3);
  if (zone <= 0) return 0;
  if (pointer < start + zone) return -max * Math.min(1, (start + zone - pointer) / zone);
  if (pointer > end - zone) return max * Math.min(1, (pointer - (end - zone)) / zone);
  return 0;
}
