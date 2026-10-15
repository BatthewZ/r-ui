# D1 — overlays, commands, content: focus on open, names, labels

- **`autoFocus` inside a `<dialog>` opened from the dialog's own effect does nothing in a
  browser.** React focuses an `autoFocus` child while committing it; the dialog is still
  closed (`display: none`), so the call is a no-op and `showModal()` then picks the first
  focusable element. jsdom focuses anything, so a test only sees it when it emulates the
  wall (focus refused inside `dialog:not([open])`, `showModal` focusing the first control).
  Open the dialog from a FIRST child's layout effect: siblings commit in order, children
  before parents, so it runs before a later sibling's `autoFocus`.
- **A parent's ref is not attached when a child's layout effect runs.** Refs attach in the
  layout phase, children first; on the first mount (and whenever a merged callback ref
  changes identity) a child cannot read the parent element through the parent's ref. A
  child reaches its parent through its own element's `parentElement`.
- **A labelling part renders the caller's `id` if given, else a generated one, and
  registers whichever it rendered** with the surface it names. Overriding the caller's id breaks their own IDREFs; ignoring it
  makes the surface point at an id nobody rendered.
- **Escape for a hover-opened tooltip listens on `document`.** It runs after every element
  handler (React's root listener included), so a surface that used the key has already
  `preventDefault()`ed it and the tooltip stands down.
- **Move focus before a node leaves, not after.** A toast dismissed with focus on it hands
  focus to the next toast (else where focus came from) before it turns inert: a removed or
  inert node fires no blur everywhere, and focus falls to `<body>`.
- **`aria-activedescendant` ids come from the option's key.** An index id names a
  different option after every re-filter, and an assistive tech holding it reads the wrong
  command.
- **Links never nest.** A Markdown label that holds a link (an autolink counts) keeps its
  brackets as text and the inner link wins, as CommonMark has it; the label's parsed nodes
  are reused, so nested labels cost one pass each.
- **A `100vw` cap counts the scrollbar.** A promoted (`[popover]`, fixed) panel's
  containing block is the viewport without it, so `100%` is the safe cap; only the
  in-place fallback still needs the viewport unit.
