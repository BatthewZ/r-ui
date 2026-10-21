// @vitest-environment node
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { type Colour, contrastRatio, parseColour, relativeLuminance } from "./color";

// The CSS package's own contrast functions, loaded from the installed copy:
// the mirror is held to them by behaviour, not by reading the two texts.
interface Upstream {
  contrast(fg: string, bg: string, backdrop?: string): { ratio: number };
  relativeLuminance(colour: string): number;
}
const HERE = dirname(fileURLToPath(import.meta.url));
const upstreamUrl = pathToFileURL(join(HERE, "..", "..", "node_modules", "@batthewz", "r-ui-css", "scripts", "lib", "color.mjs")).href;
const upstream = (await import(upstreamUrl)) as Upstream;

const read = (text: string): Colour => {
  const colour = parseColour(text);
  if (colour === undefined) throw new Error(`unparsed: ${text}`);
  return colour;
};

/** A seeded PRNG (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Colours both sides read: OKLCH (in and out of sRGB, plain, percentages, `none`, alpha) and hex of every length. */
function corpus(next: () => number, count: number): string[] {
  const fixed = (value: number, digits: number) => value.toFixed(digits);
  const hex = (digits: number) => Array.from({ length: digits }, () => "0123456789abcdef"[Math.floor(next() * 16)]).join("");
  const out: string[] = ["oklch(1 0 0)", "oklch(0 0 0)", "#fff", "#000", "oklch(none none none)", "oklch(50% 50% 120deg)"];
  while (out.length < count) {
    const pick = next();
    if (pick < 0.55) out.push(`oklch(${fixed(next(), 3)} ${fixed(next() * 0.37, 3)} ${fixed(next() * 360, 1)})`);
    else if (pick < 0.65) out.push(`oklch(${fixed(next() * 100, 1)}% ${fixed(next() * 100, 1)}% ${fixed(next() * 360, 1)} / ${fixed(next(), 2)})`);
    else out.push(`#${hex([3, 4, 6, 8][Math.floor(next() * 4)] as number)}`);
  }
  return out;
}

describe("the colour module mirrors the CSS package's contrast check", () => {
  it("measures every pair as the package does, both gamut mappings and translucency included", () => {
    const next = random(20261021);
    const colours = corpus(next, 400);
    const opaque = colours.filter((text) => read(text).alpha >= 1);
    let below3 = 0;
    let between = 0;
    let above45 = 0;
    let outOfGamut = 0;
    let translucent = 0;
    for (let i = 0; i < 3000; i += 1) {
      const fg = colours[Math.floor(next() * colours.length)] as string;
      const bg = colours[Math.floor(next() * colours.length)] as string;
      const backdrop = opaque[Math.floor(next() * opaque.length)] as string;
      const theirs = upstream.contrast(fg, bg, backdrop).ratio;
      const ours = contrastRatio(read(fg), read(bg), read(backdrop));
      expect(ours, `${fg} on ${bg} over ${backdrop}`).toBeCloseTo(theirs, 12);
      if (ours < 3) below3 += 1;
      else if (ours < 4.5) between += 1;
      else above45 += 1;
      if (read(bg).alpha < 1) translucent += 1;
      if (/oklch\(0\.\d+ 0\.3/.test(fg + bg)) outOfGamut += 1;
    }
    for (const text of colours) expect(relativeLuminance(read(text)), text).toBeCloseTo(upstream.relativeLuminance(text), 12);
    // Agreement means something only if the corpus lands on every side of the floors.
    expect(Math.min(below3, between, above45)).toBeGreaterThan(100);
    expect(translucent).toBeGreaterThan(100);
    expect(outOfGamut).toBeGreaterThan(100);
  });
});

describe("parseColour", () => {
  const WHITE = read("#fff");
  const onWhite = (text: string) => contrastRatio(read(text), WHITE, WHITE);

  it("reads the same red in every space a document or a browser writes it in", () => {
    const red = onWhite("#ff0000");
    expect(red).toBeCloseTo(4, 1);
    for (const text of [
      "#F00",
      "rgb(255 0 0)",
      "rgb(255, 0, 0)",
      "rgb(100% 0% 0%)",
      "rgba(255, 0, 0, 1)",
      "hsl(0 100% 50%)",
      "hsl(360deg 100% 50%)",
      "hsl(1turn 100% 50%)",
      "oklch(0.62796 0.25768 29.2339)",
      "oklab(0.62796 0.22486 0.12585)",
      "lab(54.2905 80.8049 69.891)",
      "lch(54.2905 106.8372 40.8526)",
      "color(srgb 1 0 0)",
      "color(srgb-linear 1 0 0)",
      "color(display-p3 0.91749 0.20029 0.13856)",
      "color(xyz-d65 0.41239 0.21264 0.01933)",
      "color(xyz-d50 0.43607 0.22249 0.01392)",
    ]) {
      expect(onWhite(text), text).toBeCloseTo(red, 2);
    }
  });

  it("reads alpha in each spelling, and transparent", () => {
    for (const text of ["#ff000080", "#f008", "rgba(255, 0, 0, 0.5)", "rgb(255 0 0 / 50%)", "oklch(0.628 0.258 29.2 / 0.5)", "color(srgb 1 0 0 / 0.5)"]) {
      expect(read(text).alpha, text).toBeCloseTo(0.5, 1);
    }
    expect(read("transparent").alpha).toBe(0);
  });

  it("measures a colour outside sRGB by the worse gamut mapping, whatever space it came in", () => {
    const p3 = read("color(display-p3 0 1 0)");
    expect("srgb" in p3).toBe(false);
    expect(contrastRatio(p3, WHITE, WHITE)).toBeGreaterThan(1);
  });

  it("reads nothing it cannot measure", () => {
    for (const text of ["var(--C-CANVAS)", "red", "currentcolor", "url(x.png)", "rgb(1 2)", "rgb(1 2 3 4)", "#12", "#ggg", "color(rec2020 1 0 0)", "color-mix(in oklch, red, blue)", "oklch(0.5 0.1 1px)", "calc(1)"]) {
      expect(parseColour(text), text).toBeUndefined();
    }
  });
});
