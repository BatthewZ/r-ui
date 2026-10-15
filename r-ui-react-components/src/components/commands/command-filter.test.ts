import { describe, expect, it } from "vitest";

import { matchCommand } from "./command-filter";

const score = (label: string, query: string, keywords?: string[]) => matchCommand(label, keywords, query)?.score ?? null;

describe("matchCommand", () => {
  it("an empty query matches everything with no highlight", () => {
    expect(matchCommand("Anything", undefined, "  ")).toEqual({ score: 0, ranges: [] });
  });

  it("ranks a label prefix over a word start over a match inside a word", () => {
    expect(score("Theme settings", "the")).toBeGreaterThan(score("Change theme", "the") ?? 0);
    expect(score("Change theme", "the")).toBeGreaterThan(score("Mathematics", "the") ?? 0);
    expect(matchCommand("Change theme", undefined, "THE")?.ranges).toEqual([[7, 10]]);
  });

  it("matches every word of a multi-word query, in any order, highlighting each", () => {
    const match = matchCommand("Change colour theme", undefined, "theme change");
    expect(match?.ranges).toEqual([
      [0, 6],
      [14, 19],
    ]);
    expect(score("Change colour theme", "theme nope")).toBeNull();
  });

  it("finds a command by its keywords, below any label match", () => {
    expect(score("Toggle dark mode", "appearance", ["appearance", "colour scheme"])).not.toBeNull();
    expect(matchCommand("Toggle dark mode", ["appearance"], "appear")?.ranges).toEqual([]);
    expect(score("Appearance", "appear")).toBeGreaterThan(score("Toggle dark mode", "appear", ["appearance"]) ?? 0);
    // A word from the label plus a word from the keywords.
    expect(score("Toggle dark mode", "dark appearance", ["appearance"])).not.toBeNull();
  });

  it("matches scattered letters, acronyms above other scatters, and never letters out of order", () => {
    const acronym = matchCommand("Change theme", undefined, "cht");
    expect(acronym?.ranges).toEqual([
      [0, 2],
      [7, 8],
    ]);
    expect(score("Go to dashboard", "gtd")).toBeGreaterThan(score("Gather data", "gtd") ?? 0);
    expect(score("Change theme", "tc")).toBeNull();
  });

  it("ignores case and diacritics and highlights the original characters", () => {
    expect(matchCommand("Café menu", undefined, "cafe")?.ranges).toEqual([[0, 4]]);
    // Decomposed "é" (e + combining acute): the range takes the mark with it.
    const decomposed = "Café menu";
    expect(matchCommand(decomposed, undefined, "cafe")?.ranges).toEqual([[0, 5]]);
    expect(matchCommand("Résumé", undefined, "rsm")?.ranges).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("a label match outranks a keyword match outranks a scattered match", () => {
    const label = score("Open settings", "set") ?? 0;
    const keyword = score("Preferences", "set", ["settings"]) ?? 0;
    const scattered = score("Sort by date", "sbd") ?? 0;
    expect(label).toBeGreaterThan(keyword);
    expect(keyword).toBeGreaterThan(scattered);
  });
});
