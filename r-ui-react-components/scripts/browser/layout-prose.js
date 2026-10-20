// @covers   layout/Prose
// @sections layout-prose primitives-typography
// @tier     component
// @cost     8
//
// Browser check: a Prose region is a measure of its BODY text wide, whatever the
// density, and UI inside it stays UI.
//
// --MEASURE is in `ch`, which resolves where it is set: on the region. So the region
// carries the body prose size, and --MEASURE counts characters of the text being read (it
// once counted the UI font at the UI size, and an article's width moved with density
// and the theme's UI face). Opened at 1280, it asserts, at comfortable and at compact:
//   1. the article region (`[data-testid="prose"]`) has its paragraphs' font size, and
//      is exactly --MEASURE wide as resolved inside one of them (±1px);
//   2. it holds the same number of body characters at both densities: width over body
//      size equal within 0.2% (the body size itself is fluid with the container, whose
//      padding follows density, so neither alone is constant), while UI text does change;
//   3. UI inside stays UI: the region's Button is --CONTROL-H tall in UI body text
//      (smaller than the region's), and the `data-not-prose` note is in UI text;
//   4. the Typography section's prose-sizes block, at the body prose size, is as wide
//      as the article (±1px).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const read = () =>
    page.evaluate(() => {
      const region = document.querySelector('[data-testid="prose"]');
      const p = region.querySelector(":scope > p");
      const probe = (host, prop, value) => {
        const el = document.createElement("div");
        el.style.cssText = `position:absolute;visibility:hidden;${prop}:${value}`;
        host.append(el);
        const r = el.getBoundingClientRect();
        el.remove();
        return prop === "inline-size" ? r.width : r.height;
      };
      const button = region.querySelector('[data-testid="prose-button"]');
      const note = region.querySelector("[data-not-prose]");
      const sizes = document.querySelector("#primitives-typography .text-prose-2.max-w-measure");
      const px = (el) => Number.parseFloat(getComputedStyle(el).fontSize);
      return {
        width: region.getBoundingClientRect().width,
        measureInText: probe(p, "inline-size", "var(--MEASURE)"),
        regionSize: px(region),
        textSize: px(p),
        button: { height: button.getBoundingClientRect().height, size: px(button), control: probe(button.parentElement, "block-size", "var(--CONTROL-H)") },
        uiBody: probe(region, "block-size", "var(--BodyText-1)"),
        note: { size: px(note), ui: probe(note, "block-size", "var(--BodyText-2)") },
        sizesWidth: sizes?.getBoundingClientRect().width ?? null,
      };
    });

  const at = {};
  try {
    for (const density of ["comfortable", "compact"]) {
      await openSection(page, ["layout-prose", "primitives-typography"], { view: { theme: "default", density, input: "fine" } });
      const m = (at[density] = await read());
      const label = density;
      if (Math.abs(m.regionSize - m.textSize) > 0.01) fail.push(`${label}: the region's font size is ${m.regionSize}px, its paragraphs' ${m.textSize}px`);
      if (Math.abs(m.width - m.measureInText) > 1) fail.push(`${label}: the region is ${m.width}px wide, --MEASURE in its body text is ${m.measureInText}px`);
      if (Math.abs(m.button.height - m.button.control) > 0.5) fail.push(`${label}: the Button inside is ${m.button.height}px tall, --CONTROL-H ${m.button.control}px`);
      if (Math.abs(m.button.size - m.uiBody) > 0.01 || !(m.button.size < m.regionSize)) fail.push(`${label}: the Button's text is ${m.button.size}px, UI body ${m.uiBody}px, the region ${m.regionSize}px`);
      if (Math.abs(m.note.size - m.note.ui) > 0.01) fail.push(`${label}: the data-not-prose note is ${m.note.size}px, its UI size ${m.note.ui}px`);
      if (m.sizesWidth === null || Math.abs(m.sizesWidth - m.width) > 1) fail.push(`${label}: the Typography prose-sizes block is ${m.sizesWidth}px, the article ${m.width}px`);
    }
    const { comfortable: c, compact: k } = at;
    if (c && k) {
      const ems = (m) => m.width / m.textSize;
      if (Math.abs(ems(c) - ems(k)) / ems(c) > 0.002)
        fail.push(`density: the article is ${ems(c).toFixed(2)} body ems wide comfortable and ${ems(k).toFixed(2)} compact, expected the same`);
      if (!(c.uiBody > k.uiBody)) fail.push(`density: harness: UI body text is ${c.uiBody}px comfortable and ${k.uiBody}px compact, the densities do not differ`);
    }
    if (errors.length) fail.push(...errors.slice(0, 5));
  } finally {
    stopErrors();
  }

  if (fail.length) throw new Error(`layout-prose:\n  ${fail.join("\n  ")}`);
  return `layout-prose OK: the article is --MEASURE of its body text wide (${Math.round(at.comfortable?.width ?? 0)}px), the same body characters at both densities; UI inside stays UI; the Typography prose block matches`;
}
