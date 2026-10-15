import { describe, expect, it } from "vitest";

import {
  composite,
  contrastRatio,
  formatHex,
  formatOklch,
  hueMaxChroma,
  inGamut,
  maxChroma,
  oklchToRgb,
  paintPlane,
  parseColorInput,
  parseCssColor,
  parseHex,
  parseOklch,
  rgbToOklch,
  toGamut,
  wcagLevels,
} from "./color-core";

const hexOf = (text: string) => {
  const parsed = parseColorInput(text);
  if (!parsed) throw new Error(`unparsed: ${text}`);
  return formatHex(oklchToRgb(parsed.color), parsed.alpha);
};
const rgb = (hex: string) => {
  const parsed = parseHex(hex);
  if (!parsed) throw new Error(hex);
  return parsed.rgb;
};

describe("OKLCH ↔ sRGB", () => {
  it("matches published OKLCH values for the sRGB primaries", () => {
    // Reference values from Björn Ottosson's OKLab definition.
    const red = rgbToOklch(rgb("#ff0000"));
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const blue = rgbToOklch(rgb("#0000ff"));
    expect(blue.l).toBeCloseTo(0.452, 3);
    expect(blue.h).toBeCloseTo(264.05, 1);
    expect(rgbToOklch(rgb("#ffffff"))).toEqual({ l: expect.closeTo(1, 5), c: 0, h: 0 });
    expect(rgbToOklch(rgb("#000000"))).toEqual({ l: 0, c: 0, h: 0 });
  });

  it("round-trips every 8-bit hex it is given exactly", () => {
    const samples = ["#0f766e", "#fefefe", "#010101", "#ff00ff", "#00ffff", "#7f7f80", "#123456", "#c0ffee"];
    for (let i = 0; i < 400; i += 1) samples.push(`#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}`);
    for (const hex of samples) expect(hexOf(hex)).toBe(hex);
  });

  it("knows the sRGB gamut and lowers chroma at constant lightness and hue to enter it", () => {
    const ceiling = maxChroma(0.7, 150);
    expect(inGamut({ l: 0.7, c: ceiling, h: 150 })).toBe(true);
    expect(inGamut({ l: 0.7, c: ceiling + 0.005, h: 150 })).toBe(false);
    const mapped = toGamut({ l: 0.7, c: 0.3, h: 150 });
    expect(mapped).toEqual({ l: 0.7, c: ceiling, h: 150 });
    expect(maxChroma(1, 150)).toBe(0);
    expect(maxChroma(0, 150)).toBe(0);
    // Cyan is narrow, magenta wide: the area's axis follows the hue.
    expect(hueMaxChroma(195)).toBeLessThan(0.17);
    expect(hueMaxChroma(328)).toBeGreaterThan(0.32);
  });
});

describe("parsing what a person types", () => {
  it.each([
    ["#abc", "#aabbcc"],
    ["#ABCD", "#aabbccdd"],
    ["#0F766E", "#0f766e"],
    ["0f766e", "#0f766e"],
    ["#0f766e80", "#0f766e80"],
    ["oklch(0.628 0.2577 29.23)", "#ff0000"],
    ["oklch(62.8% 0.2577 29.23deg)", "#ff0000"],
    ["oklch(0.628 64.4% 0.0812turn)", "#ff0000"],
    ["OKLCH( 1 0 none )", "#ffffff"],
    ["oklch(0.5 0 0 / 50%)", "#63636380"],
  ])("%s reads as %s", (text, hex) => {
    expect(hexOf(text)).toBe(hex);
  });

  it.each(["", "#ggg", "#12345", "blue", "rgb(1 2 3)", "oklch(1.5 0.1 20)", "oklch(0.5 -0.1 20)", "oklch(0.5 0.1)", "oklch(0.5 0.1 20 / 2)", "oklch(0.5 0.1 20 / 0.5 / 1)"])(
    "refuses %j",
    (text) => {
      expect(parseColorInput(text)).toBeNull();
    },
  );

  it("keeps chroma as written, even outside sRGB", () => {
    expect(parseOklch("oklch(0.7 0.3 150)")?.color.c).toBe(0.3);
  });
});

describe("parsing what a browser serialises", () => {
  it.each([
    ["rgb(255, 255, 255)", "#ffffff"],
    ["rgba(0, 0, 0, 0.5)", "#00000080"],
    ["rgb(15 118 110)", "#0f766e"],
    ["rgb(0 0 0 / 50%)", "#00000080"],
    ["color(srgb 1 0 0)", "#ff0000"],
    ["oklch(0.985 0.002 90)", hexOf("oklch(0.985 0.002 90)")],
  ])("%s", (text, hex) => {
    const parsed = parseCssColor(text);
    expect(parsed && formatHex(oklchToRgb(parsed.color), parsed.alpha)).toBe(hex);
  });

  it("refuses a colour name", () => {
    expect(parseCssColor("rebeccapurple")).toBeNull();
  });
});

describe("formatting", () => {
  it("writes oklch() with chroma rounded down, so an edge colour stays inside sRGB", () => {
    const red = rgbToOklch(rgb("#ff0000"));
    expect(formatOklch(red)).toBe("oklch(0.628 0.257 29.2)");
    const edge = { l: 0.7, c: maxChroma(0.7, 150), h: 150 };
    const parsed = parseOklch(formatOklch(edge));
    expect(parsed && inGamut(parsed.color)).toBe(true);
    expect(formatOklch({ l: 0.5, c: 0.1, h: 370 }, 0.5)).toBe("oklch(0.5 0.1 10 / 0.5)");
    expect(formatOklch({ l: 1, c: 0, h: 0 })).toBe("oklch(1 0 0)");
  });

  it("writes hex alpha only below 1", () => {
    expect(formatHex(rgb("#0f766e"), 1)).toBe("#0f766e");
    expect(formatHex(rgb("#0f766e"), 0.5)).toBe("#0f766e80");
  });
});

describe("WCAG contrast", () => {
  it("gives the published ratios", () => {
    expect(contrastRatio(rgb("#000000"), rgb("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(rgb("#767676"), rgb("#ffffff"))).toBeCloseTo(4.54, 2);
    expect(contrastRatio(rgb("#ffffff"), rgb("#767676"))).toBeCloseTo(4.54, 2);
    expect(contrastRatio(rgb("#595959"), rgb("#ffffff"))).toBeCloseTo(7.0, 1);
    // Coloured pairs weigh the channels (greys alone cannot tell the weights apart).
    expect(contrastRatio(rgb("#0000ff"), rgb("#ffffff"))).toBeCloseTo(8.59, 2);
    expect(contrastRatio(rgb("#ff0000"), rgb("#ffffff"))).toBeCloseTo(4.0, 2);
    expect(contrastRatio(rgb("#008000"), rgb("#ffffff"))).toBeCloseTo(5.14, 2);
  });

  it("rates AA at 4.5:1 and AAA at 7:1", () => {
    expect(wcagLevels(4.49)).toEqual({ aa: false, aaa: false });
    expect(wcagLevels(4.5)).toEqual({ aa: true, aaa: false });
    expect(wcagLevels(7)).toEqual({ aa: true, aaa: true });
  });

  it("composites a translucent colour over its background first", () => {
    const half = composite(rgb("#000000"), 0.5, rgb("#ffffff"));
    expect(formatHex(half)).toBe("#808080");
  });
});

describe("paintPlane", () => {
  it("paints white at the top-left, black at the bottom, and leaves out-of-gamut pixels clear", () => {
    const w = 20;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    paintPlane(data, w, h, 150, 0.4);
    const px = (x: number, y: number) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
    expect(px(0, 0)).toEqual([255, 255, 255, 255]);
    expect(px(0, h - 1)).toEqual([0, 0, 0, 255]);
    // Lightness 1 cannot hold chroma 0.4: transparent.
    expect(px(w - 1, 0)[3]).toBe(0);
    // A mid grey column is opaque everywhere.
    expect(px(0, 5)[3]).toBe(255);
  });
});
