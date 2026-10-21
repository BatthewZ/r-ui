# The reference: rendering VIEWSPEC.md from the contracts

**Render from emptied prose, or a forgotten region passes.** When the template is the
committed document, a region the renderer forgets comes out already correct, and every
byte-for-byte check agrees with itself. The shipped prose is the document with its regions
emptied, and filling refuses both a region with no body and a body with no region, so a
dropped renderer shows as an empty region and a failed check. Regions no option can change
(issue codes, not-addressable) are proven this way; the regions a scope or a host list
reaches are also proven by a render that must differ.

**List props as a document writes them.** A declared `Date`, formatter or `ReactNode` is
not what the author types; the contract fields the renderer coerces with (templates,
FormatSpecs, icon names, ISO dates, Sets, element and heading values, form and field
names, refs) decide the shown type, so the table and the renderer cannot disagree.

**Which props are listed is the validator's decision, in the validator's order.** `form`
is both an id-reference attribute and a form prop; checking the id rule first hid Form's
only prop. The listing mirrors `forbidden-prop` step for step, and a test renders every
contract prop through the validator in both directions. When a second module must decide
what another already decides, copy the order, not just the rules, and make a test hold
them together.

**Reference-only data lives in its own generated file.** Prop doc sentences were a third of
the contracts JSON that the client and `./spec` ship; split out, only `./reference` reads
them, and an upstream doc-comment edit stales that file alone.

**A React-free subpath cannot import Markdown.** The module-graph gate resolves files, not
bundler queries (`?raw`), so the prose ships as generated JSON, one array entry per line so
a prose edit diffs as that line.
