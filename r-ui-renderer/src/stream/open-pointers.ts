import { appendPointer, parsePointer } from "../spec/pointer";

/**
 * The pointers of the open values: the document and each open value below it,
 * one chain. `has` walks the chain's tokens, so a hostile nesting depth costs
 * nothing until someone iterates (which spells every pointer out).
 */
export class OpenPointers implements ReadonlySet<string> {
  private spelled: Set<string> | undefined;

  /** `tokens[i]` is the key or index of the open value at depth `i + 1`. */
  constructor(private readonly tokens: readonly (string | number)[]) {}

  get size(): number {
    return this.tokens.length + 1;
  }

  has(pointer: string): boolean {
    const tokens = parsePointer(pointer);
    if (tokens === null || tokens.length > this.tokens.length) return false;
    return tokens.every((token, index) => token === String(this.tokens[index]));
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
