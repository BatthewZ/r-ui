Read [ETHOS.md](./ETHOS.md) first. It holds the defining decisions and the design principles; this file holds the working rules.

Three packages in one bun workspace (see [guides/workspace.md](./guides/workspace.md)):

- `r-ui-css/` → `@batthewz/r-ui-css`
- `r-ui-tw-merge/` → `@batthewz/r-ui-tw-merge`
- `r-ui-react-components/` → `@batthewz/r-ui-react-components` (showcase app in `showcase/`)

`mockup/` is the original scratchpad, kept as reference only. Do not build on it.

Dependencies run one way:

```
r-ui-css + r-ui-tw-merge  →  r-ui-react-components  →  (renderer: deferred, not in this repo)
```

**Bump rule.** r-ui-css and r-ui-tw-merge release independently of r-ui-react-components and of each other. When either one bumps, r-ui-react-components bumps its dependency on it. A change to r-ui-css's `@theme` names changes the r-ui-tw-merge mirror in the same change; the mirror check fails otherwise. Pre-1.0, a break bumps the **minor** and gets a changelog entry.

**Knowledge runs one way too.** r-ui-css's docs never name r-ui-tw-merge or r-ui-react-components: no "if you also use…", no cross-references, no examples that assume a downstream consumer. r-ui-tw-merge may name r-ui-css (it mirrors it) but nothing downstream. Downstream may talk about upstream; upstream never talks about downstream. This rule is the easiest one to break with good intentions.

## What belongs in the universal contract

A token goes in r-ui-css only if **all three** hold: **standalone-meaningful** (useful with no component library), **cross-cutting** (read by many contexts), and **domain-neutral** (its name encodes no component or domain). If any one fails, it is a **domain extension** and lives in the library that owns the domain (chart, series, trend, KPI and stale tokens live in r-ui-react-components). If a token only means something once you know the component or the kind of app, it is an extension.

Tokens are the only vocabulary. No raw hex, `rem`, `px` or Tailwind defaults (`p-4`, `text-sm`, `bg-blue-500`, `rounded`) in components, and no primitive tokens read in components. If no token fits, raise it as a contract question.

## Theming: read before touching anything theme-shaped

- **The example themes `nightfall` and `harbour` have no privileges.** Never write their names into a selector, type, default, config list or test fixture in library code. If a fixture needs a theme name, invent one (`aurora`, `midnight`). If something must vary per theme, make it a token the consumer's theme controls too. Prose may discuss them as examples. The **showcase app is a consumer** and may list them.
- One theme file = one scheme. Every theme sets `color-scheme` and `--SCHEME-DARK` (`0`/`1`). No `light-dark()`.
- Themes apply only via `:root[data-theme="name"]`. No subtree themes.
- Domain colours are `-LIGHT`/`-DARK` pairs blended by `--SCHEME-DARK` at the read, so themes never need to name them.
- **Density themeability:** themes set the per-density *named* values (`--R-SIZE-3-COMFORTABLE`, `--R-SIZE-3-COMPACT`) only. They never set the selected name (`--R-SIZE-3`) and never select a density. Only `[data-density]` selects. A check enforces this.
- No token changes under an `@media (width …)` query. The viewport moves layout only.

The theme checks live in r-ui-css and run under its `check` script. Read a check's header before adding an allowance; the fix is almost never an allowance.

## Rules for developing

1. Search the codebase before building. Don't assume something isn't implemented.
2. Clean, modular, maintainable design, but never at the expense of accuracy.
3. Single sources of truth: no migrations, adapters or compat shims. If tests unrelated to your work fail, fixing them is part of your change.
4. Never suppress or ignore a TS or eslint error. Fix it.
5. Run the tests and the `check` script for every package you changed, and fix what fails.
6. Run the package's `typecheck` after code changes and fix what fails.
7. Write a comment only where the code is not self-explanatory, and keep it terse without losing nuance or accuracy.
8. Save lessons for future agents in `<package>/memory/`, and keep `<package>/memory/README.md` as its index. Principles and guidance only: no TODOs, upcoming tasks, line numbers or file references.
9. For browser work, run `playwright-cli -h`.
10. Before writing tests, read [guides/tests.md](./guides/tests.md).

## Where a fact goes

Per package: `AGENTS.md` for rules that ship · `README.md` for consumers · `CHANGELOG.md` for contract changes · `memory/` for lessons. Family-wide decisions go in `ETHOS.md`; family-wide working rules go here. A fact that fits none of those does not need a file. This repo has no plan, brief or handover documents lying around and should not grow any.
