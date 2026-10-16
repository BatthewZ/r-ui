# TreeView and RequireAuth

- **One flat list of rows, windowed or not.** A tree whose every row carries `aria-level`,
  `aria-setsize` and `aria-posinset` needs no nested `group` elements, so the same rows can be
  windowed past a threshold (absolute at index × `--ROW-H`, the focused row always mounted so
  focus and its scroll-into-view work wherever the window is). Nested groups would force two
  render paths.
- **Look for where focus is really lost before guarding it.** A press on an ancestor's chevron
  already focuses that ancestor's row natively (mousedown focuses the nearest focusable
  ancestor), so a "move focus on collapse" branch was dead and a tamper left the test green.
  The real loss is a collapse the tree did not start (an owner's controlled `expandedIds`): the
  tab stop falls back to the nearest visible ancestor, and focus is handed to it only when the
  element that had focus is disconnected and focus sits on `<body>`.
- **A checked parent checks everything under it by inheritance**, which is what lets lazily
  loaded children arrive checked. So a parent must never be listed while one of its children
  is off (a disabled child the cascade skips): settle parents bottom-up from their children
  after every toggle, the toggled node included. Ids under parents not loaded yet are the
  caller's and are kept as given.
- **Links inside a tree item:** the item stays a `div` with the roving tabindex; the label is
  the router's link at `tabIndex=-1`. Enter calls the link's own `click()`, so a router's
  click handler navigates, and the click bubbles back to the row flagged as from the link (no
  second navigation). Space selects only; it never follows a link.
- **Row actions sit inside the tree item, named apart from it.** The item is
  `aria-labelledby` its label, so the actions never join its name; the render prop hands each
  row a `tabIndex` so only the focused row's actions are in the Tab order (row, its actions,
  out).
- **A tree owns only tree items and groups**: the live region that announces lazy loads sits
  beside the tree element, not inside it; a loading row is `aria-hidden` and never a stop (it
  vanishes under focus), the parent carries `aria-busy`.
- **A gate fails closed.** RequireAuth renders `children` only for `status === "authenticated"`;
  any other value (an untyped hook's `"refreshing"`) is a wait. Its `onUnauthenticated` is an
  effect keyed to the status alone: one call per arrival, not one per render. A flash is a
  commit, so the browser check watches the gate with a MutationObserver while the demo
  really waits.
- **Browser-check lint globals are deliberately narrow:** a page callback reaches anything
  else through `window` (`new window.MutationObserver(…)`).
