# Content group: lessons (CodeBlock, CopyButton, Markdown; batch B, b2)

- **Destructure a dynamic import where it happens, or the bundler keeps everything.**
  `import("lowlight").then((mod) => build(mod))` hands the whole namespace on, so the lazy
  chunk carried lowlight's `all` (192 grammars): 905 kB / 299 kB gzip. Destructuring only
  `createLowlight` drops both grammar sets: the core is 22 kB / 8.6 kB gzip. Grammars then come
  one chunk each from `highlight.js/lib/languages/<name>` (a declared dependency: an isolated
  linker resolves only what the package names), loaded with the curated grammars they embed,
  so a block pays for its language only. Measure the built chunks; the source reads the same.
- **An optional peer behind `import()` is optional at runtime, not at build.** Vite fails the
  build on a bare specifier it cannot resolve, so a consumer without the peer could not build
  at all. That is why lowlight became a regular dependency. The load's catch still matters: a
  failed chunk or a network error leaves the block plain.
- **Render the highlighter's tree flat.** Each run takes the innermost mapped scope's role,
  which is what nested spans would paint by inheritance, with one span per run and no
  nesting. Unmapped scopes are body ink; `subst` resets to body ink inside a string.
- **Code colour under forced colors: collapse, don't opt out.** Opting the block out keeps
  hues the user's palette never chose. The meaning that survives is weight (keywords), slant
  (comments), the diff's own `+`/`-`, and a marked line's bar drawn as a border (a band is
  repainted away; a transparent border would be drawn on every line, so only marked lines
  carry one and give the width back in padding).
- **`data-not-prose` on a UI island is about the box, not the font.** A utility
  (`text-body-2`) already beats the prose region's `pre` font size; what leaked without the
  island was the prose `pre` padding and border. Assert the box, or the check proves nothing.
- **A nesting cap is a width cap too.** 32 levels guarded the stack but pushed a deep quote
  550px in, past a phone; 8 levels fit 375px. A spill check must not let a scroller *outside*
  the component excuse a spill (the showcase's demo frame scrolls), and a `hidden` clip is
  lost content, not an excuse.
- **A depth cap must be measured before it is kept.** An inline-nesting cap looked prudent
  and was dead: link labels are already capped at 1,000 characters, and 5,000 nested links
  parse in 17ms. It was removed rather than shipped as a guard that guards nothing.
- **`.map(parseInline)` passes the index as the second argument.** With a depth parameter,
  column 17 of a table silently became plain text. Wrap callbacks whose signature can grow.
- **A live-region message must change to be re-announced.** A second "Copied" is the same
  text; alternating a trailing no-break space makes it a change. The region sits beside the
  button, never inside (a button's content is presentational).
- **jsdom cannot see `visibility: hidden`.** Inactive labels stacked in one grid cell to hold
  a button's width are counted in the accessible name there; `aria-hidden` on them is right
  in both worlds.
- **The selection-copy fallback writes its textarea beside the button**, not on `<body>`:
  inside a modal dialog everything outside is inert and the copy silently writes nothing.
- **Prove a parser refactor by fuzzing it against the parser it replaces.** Example tests
  hold the cases someone thought of; a hand-written parser's behaviour lives in its corners
  (unclosed openers, a marker at a line end, nesting at the cap, very long runs). Keep the
  old parser as a scratch copy outside the package, generate many inputs from the syntax's
  own markers, and compare the trees. Each difference is a bug or a deliberate fix: fix the
  first, record the second with a test, then delete the copy.
- **A cap's comparison is part of what it promises.** Markdown's "8 nested containers" cap
  compared with `>` and let a ninth level through behind a correct comment. Pin both sides
  in tests (N nests, N + 1 falls back), so an off-by-one cannot ship either way.
