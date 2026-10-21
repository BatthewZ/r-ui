# AGENTS — @batthewz/r-ui-renderer

Rules for anyone (human or agent) working in this package. Read the family's `ETHOS.md`
and `CLAUDE.md` first, and `VIEWSPEC.md`, which is the format's contract with its
producers. Each rule names the gate that holds it where one exists (`bun run check`).

## Layout

```
VIEWSPEC.md               the model-facing reference: hand-written prose + generated regions
src/
  index.ts                the package root ("use client"): ViewRenderer, the stream hook,
                          the parser, registry and contract helpers, diagnostics, format types
  ViewRenderer.tsx        the composition root: input → snapshot → runtime → forms → renderNode
  diagnostics.ts          every class the renderer marks its elements with, and the DOM query
  styles.css              `./styles`: the renderer's own CSS (tokens only, components layer)
  schema.json             `./schema.json`: the format as JSON Schema
  spec/                   `./spec`, React-free: the format (types.ts), its policy (policy.ts,
                          url-policy.ts), what renderer and validator both read off a
                          contract (contract-facts.ts), the one ISO date parser (dates.ts),
                          contract prop paths (prop-path.ts), the $ref grammar, JSON
                          Pointers, shape guards, issues, the built-in contracts, the
                          validator (validate*.ts) and its one schema source
  contracts/              the contracts every check reads: generated/ (the deriver's JSON,
                          never hand-edited), curated/ (the decisions, each gated), index.ts
                          (the assembled view, extendContracts)
  stream/                 `./stream`, React-free: the incremental parser, PENDING, fences;
                          plus the React hooks the root exports (use-view-spec-stream.ts)
  render/                 renderNode, Scope, props and their coercions, the built-ins (Text,
                          Heading, Icon), diagnostics in place and the issue log
  runtime/                RenderContext, adapters, actions, event values, state, data
                          bindings, dialogs, the issue channel, useViewRuntime
  forms/                  form defs compiled to a Standard Schema on the library's useForm
  registry/               names → components (registry.ts, React side) and the name list
                          (names.ts, React-free), derived from the library's barrel
  reference/              `./reference`, React-free: renders VIEWSPEC.md from the contracts
                          and the prose (prose.json, written from VIEWSPEC.md by derive:viewspec)
  icons/                  `./icons`: a curated lucide set (and the IconSet type)
  zod/                    `./zod`: the format as a Zod schema (zod is an optional peer)
  cli/                    the `r-ui-validate` bin (main.ts holds everything but process wiring)
  examples/               the corpus (not shipped as an entry): product documents, coverage/
                          (every addressable component), the typed manifest, their tests
scripts/                  the gates (`verify:*`), their tests and fixtures; browser/ holds the
                          browser checks, run by browser-check.mjs against the playground
playground/               a consumer app: editor, live preview, issue panel, streaming replay,
                          and the full-page route `/?view=<name>` the browser checks drive
test-utils.ts             shared test helpers (not shipped)
```

## Dependencies and knowledge run one way

- `src/` imports only `@batthewz/r-ui-react-components`, `react` and `react-dom`;
  `lucide-react` only under `icons/`, `zod` only under `zod/`. Never `@batthewz/r-ui-css` or
  `@batthewz/r-ui-tw-merge`: the renderer's CSS reads tokens by name and the consumer imports
  the contract. Those two are dev dependencies for the gates only.
- This package may name the library; nothing upstream ever names this package (its docs,
  code, tests or changelog). A library change the renderer needs is an additive change with
  the library's own tests and its own justification.
- **React-free subpaths.** `./spec`, `./stream`, `./reference`, `./zod` and the bin run on
  servers and in the CLI. Their module graphs, type-only imports included, reach no React, no
  library, no lucide and no `.tsx` (`verify:react-free`). React-side code lives in a module only
  the package root imports.

## The format

- `src/spec/types.ts` and `VIEWSPEC.md`'s prose describe the same format and change
  together. The format is a one-way door: a change that can break a document is a minor bump
  with a CHANGELOG entry.
- **Errors are conformance, warnings are advice.** An `error` issue is exactly what a schema
  can express (shape, JSON types, closed sets, syntax), so `validateViewSpec` and the Zod
  schema agree on `ok`. Anything needing scope, the registry, contracts or a cross-reference
  is a `warning`. Issue codes come only from `ISSUE_CODE_INFO`.
- Contracts are the single source of what the renderer, the validator and the reference
  know about a component. A table that names a library component or prop is gated against
  the library. Derive a fact from the declarations where they show it (a native `name`, a
  `RefObject` type); curate it, with a gate that fails on an unclassified case, where they
  do not.
- **The renderer and the validator read a fact the same way, from one place:** the policy
  (`policy.ts`, `url-policy.ts`), the contract facts (`contract-facts.ts`), the ISO parser,
  the prop-path walker, the Intl checks. A warning is a promise of what the renderer will
  do; a second copy of the rule breaks it silently.
- **`name` keeps its meaning unless a contract says otherwise** (`nameRole`): a DOM name
  (`domName`, derived from native attributes or curated) is dropped, Field's is a field
  name, every other is the component's own. Never default the other way: the set of
  semantic names is open.
- No example theme name (the library's showcase themes) appears anywhere in this package:
  not in code, types, fixtures or docs. Fixtures invent names (`aurora`).

## Rendering

- **No wrapper component or wrapper DOM between a parent and its children.** `renderNode`
  builds the library's elements directly; `$each` yields keyed sibling arrays. Parents read
  their children by identity, props, cloning and counting, and direct-child CSS selectors
  assume nothing in between. A per-node error boundary sits only where the parent's contract
  allows one, and never remembers a failure across renders.
- **Degrade, never throw, never silently.** A bad node renders a diagnostic in place (or,
  where its context allows no element, the issue log lists it). Every diagnostic is a DOM
  element carrying the classes in `diagnostics.ts`; nothing else spells them.
- Renderer-held controlled values (`open`, `value`) are defined from the first render.
- Do not wrap a document's `className` in `cn()`: every library component already merges
  its own.

## CSS: tokens only

The renderer's stylesheet and the built-ins speak the contract's tokens and nothing else: no
raw lengths or colours, no Tailwind defaults (`p-4`, `text-sm`). Every class the renderer
defines carries the `r-renderer-` prefix. Its rules sit in `@layer components`, so a
document's `className` wins.

## The gates (`bun run check`)

| Script | Asserts |
| --- | --- |
| `verify:react-free` | the React-free subpaths' module graphs (type imports included) reach no React, library, lucide, CSS package or `.tsx`, and zod only under `./zod`; each entry is still published under its subpath (fixture test proves each rule) |
| `verify:no-suppressions` | no lint or TypeScript suppression directive in sources, tests, gates or configs (fixture test) |
| `verify:source-text` | no raw control character in any text file, which would make git treat it as binary (test writes its bad fixture at run time) |
| `verify:contracts` | `src/contracts/generated/` is what `derive:contracts` writes from the installed library's built declarations (stale or missing fails, naming the file) |
| `verify:viewspec` | `VIEWSPEC.md`'s generated regions and `src/reference/prose.json` are what `derive:viewspec` writes (byte for byte, naming the stale file) |
| `verify:classes` | `src/spec/class-vocabulary.json` and the stylesheet's `@source inline` lines are what `derive:classes` writes, every listed class compiles to CSS, no Tailwind default is listed, and the stylesheet reads tokens only |
| `verify:schema` | `src/schema.json` is what `derive:schema` writes from the one schema source (`validate-schema.ts`) |
| `verify:playground` | the playground's sources speak tokens only, and no example theme is named outside its theme list module (fixture test) |
| `typecheck`, `lint`, `test` | tsc strict (+ `noUncheckedIndexedAccess`), eslint (narrow; inline config off), vitest (jsdom) |

| Writer | Writes (commit the result; the matching `verify:*` fails until you do) |
| --- | --- |
| `derive:contracts` | `src/contracts/generated/`: components, parts, props, value sets, slots, node props, native attributes and DOM names, declared paths. Needs the library's `dist` current |
| `derive:classes` | the class vocabulary JSON and the stylesheet's `@source inline` lines |
| `derive:schema` | `src/schema.json` (runs on bun: the source is TypeScript) |
| `derive:viewspec` | `VIEWSPEC.md`'s generated regions and `src/reference/prose.json`. Edit the prose in `VIEWSPEC.md`, never inside a region; after a library rebuild run `derive:contracts` first |

Gates that live in `test`: the barrel gate (library exports = contracts ∪ `NOT_ADDRESSABLE`),
curated-table drift, the omission scans (un-JSON-able props, the library's URL, heading and
children-reading sinks), the `name` classification, DataTable column keys against the format
and the library, the fold, validator ⇄ Zod ⇄ `schema.json` agreement, and the README
(`readme.test.tsx`: its named code blocks typechecked and run, its snippets typechecked, its
CLI transcript replayed, each hardening row provoked, each number in its prose measured).
A README example is a claim: change it and its test together.

Outside `check`, run alone (they start a browser or a server):

| Script | Does |
| --- | --- |
| `playground:dev` / `playground:build` / `playground:preview` | the playground on 4318 / into `playground/dist` / served on 4317 |
| `browser:check` | builds the playground into its own folder, serves it and runs `scripts/browser/*.js` in playwright-cli sessions (`--group`, `--changed`, name filters; a failure re-runs alone and a pass then is FLAKY, which fails). Takes the machine-wide browser lock |

The corpus asserts zero issues: a document never keeps an excuse for a validator or renderer
shortfall; fix the rule at its source, as a contract fact both read.

**Never suppress** a TypeScript or ESLint error. Fix it.

## Testing

Read the family's `guides/tests.md`. Shared helpers are in `test-utils.ts`:
`renderThrowing` (a render a node is expected to throw in, silenced only there),
`queryDiagnostics` (every diagnostic in `document.body`, hidden ones included),
`createMountProbe` (mount counts per id, for no-remount claims while streaming),
`stubPopover` / `stubDialog` (per test, never global). Run new tests on one worker.
