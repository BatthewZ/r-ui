# Faces on type-role utilities

- **Tailwind's `--text-*` sub-keys stop at line height, letter spacing and weight.** There is no
  font-family sub-key, so a size utility cannot carry a face through `@theme` alone.
- **A same-name `@utility` extends a theme utility.** Declaring `@utility text-h1 { … }` next to
  `--text-h1` makes Tailwind emit both blocks under `.text-h1`, and every variant (`md:`,
  `hover:`) carries both. To a class merger it is still one `text-*` size, so
  `text-h1 text-fg-muted` keeps both and `text-h1 text-h2` collapses. The modifier form (`text-h1/7`) is a different
  candidate and gets only the theme block.
- **Sort order is what lets explicit utilities win.** Tailwind sorts by the lowest property in
  the rule, then puts rules with more properties first. A companion led by `font-family` lands
  before `font-mono`, `normal-case` and `tabular-nums`, so those override it, the same way
  `font-semibold` overrides a size's built-in weight. Check the compiled order when a companion
  gains a property that sorts earlier than its siblings'.
- **Check what a rule reads, not what it mentions.** `var(--FONT-DISPLAY` also matches
  `var(--FONT-DISPLAY-SIZE-ADJUST`. The compile check pins the property and the exact token name.
- **Optional roles resolve at the read.** `--FONT-HEADING` and `--FONT-DISPLAY` stay undeclared
  and every reader writes the whole chain, so one theme line moves every role below it.
- **Fonts belong to the app.** The Tailwind CLI inlines an `@import`ed font stylesheet without
  rewriting its `url()`s; a bundler (Vite) rewrites them and emits the files. Verify that a face
  loaded with `document.fonts`, not by looking.
