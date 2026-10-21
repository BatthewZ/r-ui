import { appendPointer } from "../spec/pointer";

/**
 * The pointers of the open values: the document and each open value below it,
 * one chain. `has` compares against the deepest pointer, spelled once on first
 * use: a caller asking about every sibling pays a string prefix test each,
 * never a parse. Iterating spells every pointer out.
 */
export class OpenPointers implements ReadonlySet<string> {
  private deepest: string | undefined;
  private spelled: Set<string> | undefined;

  /** `tokens[i]` is the key or index of the open value at depth `i + 1`. */
  constructor(private readonly tokens: readonly (string | number)[]) {}

  get size(): number {
    return this.tokens.length + 1;
  }

  /** `pointer` as `appendPointer` spells it. */
  has(pointer: string): boolean {
    if (pointer === "") return true;
    const deepest = (this.deepest ??= this.tokens.reduce<string>(appendPointer, ""));
    return deepest.startsWith(pointer) && (deepest.length === pointer.length || deepest.charCodeAt(pointer.length) === 0x2f);
  }

  forEach(callback: (value: string, key: string, set: ReadonlySet<string>) => void, thisArg?: unknown): void {
    for (const pointer of this.spell()) callback.call(thisArg, pointer, pointer, this);
  }

  entries(): SetIterator<[string, string]> {
    return this.spell().entries();
  }

  keys(): SetIterator<string> {
    return this.spell().keys();
  }

  values(): SetIterator<string> {
    return this.spell().values();
  }

  [Symbol.iterator](): SetIterator<string> {
    return this.spell().values();
  }

  private spell(): Set<string> {
    if (this.spelled === undefined) {
      let pointer = "";
      this.spelled = new Set([pointer]);
      for (const token of this.tokens) {
        pointer = appendPointer(pointer, token);
        this.spelled.add(pointer);
      }
    }
    return this.spelled;
  }
}
