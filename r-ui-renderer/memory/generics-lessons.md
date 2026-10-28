# Generic components in the contracts

- **A default type argument is written as the synthetic module reaches it.** The deriver
  instantiates a generic component at its defaults in a virtual module that sees the library
  only as `import * as L`. A default that is a literal (`as = "div"`) needs no name; one that
  is the library's own type (`T extends CalendarEvent = CalendarEvent`) must be written
  `L.CalendarEvent`, which `typeToString` does when given that module as the enclosing
  declaration. Written bare, the release's gate failed with "Cannot find name".
- **A prop typed by the component's own type parameter is read at the default.** Read as
  declared, `events: readonly T[]` has no fields: its nested paths (`events[].href`), dates
  (`events[].start`) and callbacks vanished, and with them the URL check on an event's link,
  silently, until the drift gate named the curated paths no declaration allowed any more.
  Props that do not mention a type parameter keep their declared type, so a polymorphic `as`
  (`ElementType`) is not narrowed to its `"div"` default.
- **A library change can break the renderer's gates through the release only.** The renderer
  derives from the library's built declarations, so a source-level gate run in the library
  sees nothing; the release script builds first and the renderer's check fails there. A dry
  run of the release (`node scripts/publish.mjs --dry-run`) is the cheap place to find it.
