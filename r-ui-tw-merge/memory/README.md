# Memory index: @batthewz/r-ui-tw-merge

Lessons for anyone changing this package. Principles only: no tasks, no status. Delete a lesson the day it stops being true.

| Note | What it covers |
| --- | --- |
| [tailwind-merge.md](./tailwind-merge.md) | Which namespaces the mirror is load-bearing for, where names without a theme key go, and the extension-shape trap. |

## The short version

1. **This package mirrors names, not values.** A CSS change matters here only if it adds, removes or renames a utility name.
2. **A missing name fails differently per namespace.** Colour: usually nothing changes. Spacing, ease, animate, duration, opacity: the pair stops collapsing. Text: worst, a size is read as a colour and silently dropped next to a real colour.
3. **Measure the merge against plain tailwind-merge.** A pair that merges correctly without the mirror proves nothing about the mirror. Keep a control that plain tailwind-merge gets wrong.
4. **A check is only evidence once it has been seen to fail.** The mirror check is tested against tampered mirrors and a tampered copy of the CSS package; re-break it by hand after changing the parser.
