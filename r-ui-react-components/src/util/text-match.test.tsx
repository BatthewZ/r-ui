import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { defaultFilter, findMatch, MatchText } from "./text-match";

describe("selection matching", () => {
  it("matches ignoring case and diacritics, either side", () => {
    expect(defaultFilter({ label: "São Paulo edge" }, "sao")).toBe(true);
    expect(defaultFilter({ label: "Sao Paulo" }, "SÃO")).toBe(true);
    expect(defaultFilter({ label: "Zürich" }, "zurick")).toBe(false);
  });

  it("maps the match back onto the original text, whatever folding did to lengths", () => {
    // "é" written decomposed is two code units; the range must cover both.
    const decomposed = "Café Noir";
    expect(findMatch(decomposed, "café")).toEqual([0, 5]);
    expect(decomposed.slice(...findMatch(decomposed, "noir")!)).toBe("Noir");
    // An astral character before the match shifts indices by two.
    const astral = "🚀 Launch pad";
    expect(astral.slice(...findMatch(astral, "launch")!)).toBe("Launch");
    // A match ending on an astral character includes all of it.
    expect(astral.slice(...findMatch(astral, "🚀")!)).toBe("🚀");
    expect(findMatch("Zürich edge", "ZUR")).toEqual([0, 3]);
    expect(findMatch("anything", "  ")).toBeNull();
    expect(findMatch("abc", "x")).toBeNull();
  });
});

describe("MatchText", () => {
  it("bolds each range of the original text and keeps the rest as text", () => {
    const { container } = render(<MatchText text="Change theme" ranges={[[0, 1], [7, 9]]} />);
    expect(container.textContent).toBe("Change theme");
    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["C", "th"]);
  });

  it("renders plain text when nothing matched", () => {
    const { container } = render(<MatchText text="Open" ranges={[]} />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("Open");
  });
});
