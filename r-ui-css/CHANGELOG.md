# Changelog

## 0.1.0 (unreleased)

First release.

- **Token contract.** Canvas and surfaces 0–3; text primary / secondary / muted / inverse / accent; borders; scrim; primary fill (+hover, +active, +on-primary); accent (+hover, +on-accent); focus; selection (+on-selection); status error / success / warning / info as mark, text, subtle background and on-mark text; `--SCHEME-DARK`; radius; floating-layer shadows; motion durations, easings and distances; UI, mono and optional display faces; weights; heading levers.
- **Axes.** Density (`comfortable` / `compact`, on any element, per-density named values that themes override, selection blocks that re-derive derived tokens); input (`--HIT-MIN`, `pointer: coarse` and `html[data-input]`); registered `--CONTROL-H` / `--ROW-H`; container-relative fluid tokens. The viewport never redefines a token.
- **Role split.** Flat UI scale (`r1`–`r6`, `h1`–`h6`, `body-1`–`3`) and a fluid prose/display scale (`display-1`–`4`, `prose-1`–`3`, `section-1`–`3`, `gutter`, `measure`). `.prose` / `[data-prose]` regions with `.not-prose` opt-out; controls inside keep UI sizing.
- **Themes.** The default theme is `:root` (light). Theme template organised by brand lever. Two worked examples under `src/examples/themes/` (one dark, one light with a different personality).
- **Tailwind.** `@theme inline` utilities for every token; Tailwind's palette, type, radius, shadow, weight, leading, tracking and easing scales are removed. `focus-ring` / `focus-ring-inset` utilities; `hit-area`, the input axis's pseudo-element hit box for visually small controls.
- **Layout widths.** `--PAGE-MAX` (`max-w-page`) and auto-fit column floors `--COLUMN-SM/MD/LG` (`w-` / `min-w-` / `basis-column-*`): fixed, density-independent, in the theme template.
- **Base.** Canvas, UI body text with tabular figures, hairline default border colour, themed selection, focus-visible ring, UI heading defaults, placeholder colour. `prefers-reduced-motion` and `prefers-contrast: more` handled at the token level, ahead of any theme.
- **Animations.** Fade, slide, scale, morph, stagger, scroll-reveal and view transitions on the motion tokens, with logical `start` / `end` directions.
- **Checks.** Contrast pairs for every theme, theme rules, compile; tests that prove each check fails on a tampered copy.
