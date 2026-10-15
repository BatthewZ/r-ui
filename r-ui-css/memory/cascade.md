# Where a custom property resolves

An unregistered custom property substitutes its `var()`s on the element that DECLARES it, then
inherits the resulting token stream. Units such as `rem`, `em` and `cqi` stay unresolved until a
real property uses them. Almost every rule below follows from that.

- **Derived tokens are re-declared at every boundary that can change their inputs.** `--CONTROL-H`
  and `--ROW-H` live in each density selection block, not on `:root` alone; otherwise a compact
  subtree inherits the root's comfortable result.
- **Selected density names are never set by a theme.** A theme overrides the named values
  (`-COMFORTABLE` / `-COMPACT`); the selection blocks pick them up because themes sit on the
  same element as the root selection. Setting the selected name freezes it for every density.
- **An alias that a subtree must be able to move belongs at the read**, as a `var()` fallback
  (`var(--FONT-DISPLAY, var(--FONT-UI))`), not as a `:root` declaration. Such a token is then
  undeclared and reads empty from script; say so where it is documented. Aliases that only a
  root-level theme moves are safe either way, because the theme and the alias share an element.
- **Never put a font size on `:root`.** It redefines `rem` for every token. A density boundary
  resets body text on itself only when it is not the root.
- **`@property` for values script must read in px** (`--CONTROL-H`, `--ROW-H`). The
  `initial-value` must be computationally independent: `px`, never `rem`. Never register a
  `cqi`-based token: registration resolves it where declared, not where used.
- **User preferences outrank brand.** Reduced motion and more contrast override tokens with
  `!important` inside their media query, because `:root[data-theme]` is more specific than
  `:root`. The overriding `var()`s still resolve on the root, so they pick up the theme's own
  values (more-contrast muted text becomes that theme's secondary text).
- **Package-wide defaults go in `@layer base`** so a utility can override them, and alias a
  contract token instead of minting a literal.
