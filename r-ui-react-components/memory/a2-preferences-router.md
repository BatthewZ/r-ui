# Preferences, router config and the showcase shell: lessons (2026-10-15)

- **One implementation for the pre-paint script and the hooks.** `themeScript()` serialises
  `readStoredPreferences` and `applyPreferences` with `Function#toString`, so the head script
  and `useTheme`/`useDensity`/`useInputMode` cannot drift. The price: both functions stay
  self-contained (no imports, no module constants, no helpers). Test the script the way a
  browser runs it (`new Function(script)()`), and escape `<` in every JSON argument so a hostile
  key or theme name cannot close the `<script>`.
- **A `<script>` React creates on the client never runs.** `<ThemeScript>` is for server or
  static rendering; React 19 server-renders a script's text child raw (it only escapes
  `</script`), so no `dangerouslySetInnerHTML` is needed. A client-only app inlines the string
  at build time; the showcase renders `<ThemeScript>` in its Vite config's
  `transformIndexHtml`, after the charset meta (which must stay in the first 1024 bytes).
- **Save the default explicitly.** Clearing the key when the viewer picks the default lets a
  server-rendered `data-theme` win on the next load. `{ theme: "default" }` is a choice, and
  the applier removes the attribute for it.
- **`<html>` is the store.** Every preference hook reads its attribute through a
  `MutationObserver`, so two switchers, the View menu, the head script and a hand-set
  attribute agree with no context. In jsdom the observer fires after a microtask: assert the
  attribute synchronously and the hook's value with `waitFor`.
- **Memoise array options on content, not identity.** A `themes` literal in JSX is a new array
  every render; keying effects and snapshot readers on `themes.join("\u0000")` keeps them from
  re-subscribing (and re-restoring over a newer choice). Same for `useActiveSection`'s ids.
- **Scope `isCurrent` to the navigation it describes.** The showcase's pages are specimens whose
  placeholder links point at the page they sit on; an app-wide `isCurrent` would rightly mark
  them all current. The shell wraps only its sidebar and bottom nav in `RouterProvider`.
- **Two AppShells in one document make bare selectors lie.** Once the showcase frame became an
  AppShell, `document.querySelector(".r-navigation-shell-sidebar")` in a check found the
  showcase's sidebar, not the Dashboard's, and still passed. Scope by frame or landmark name.
- **A grid's implicit `auto` track sizes to its widest child.** `Field`'s layout grid let a
  segmented control push past a 375px demo; one `minmax(0,1fr)` column fixed it at the source.
- **`verify:utilities-exist` follows identifiers by name.** A variable `slot` passed to `cn()`
  was resolved to another `slot` (page-slot strings like `gap-end`) and reported as dead
  classes. Name class variables for what they are (`arrowClass`).
