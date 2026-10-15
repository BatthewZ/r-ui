# Building in parallel in one worktree

How the r-ui family was built: one orchestrator, many subagents, one branch, no
worktree-per-agent. It worked because parallel work and verification were kept
apart: **build in parallel batches, then integrate in one sequential gate.**

## The loop

1. **Settle the contract before fanning out.** Names that several agents will
   read (tokens, utilities, cross-group component APIs) are decided first, by
   one agent or by the orchestrator in a shared decisions file. Parallel agents
   designing the same names produce two vocabularies.
2. **Batch: several agents at once, each owning disjoint files.** One package,
   one component group, one showcase page per agent. Shared files are avoided
   by structure rather than by care (see below).
3. **Gate: one agent, alone.** Reconciles what the batch did blind to itself,
   fixes cross-cutting problems, runs everything (`check`, `test`, `build`,
   `showcase:build`, `browser:check`), and looks at screenshots across every
   axis. Nothing else runs during a gate.
4. **The orchestrator verifies the gate's claims itself** before starting the
   next batch: re-runs the suite and spot-checks screenshots. Agent reports are
   claims, not evidence.
5. Repeat. Each batch's reports feed the next gate's fix list.

Batching the testing is the point: per-agent checks catch an agent's own
mistakes, but integration problems (name drift, duplicated helpers,
inconsistent hover washes, a section that crashes the page) only appear when
everything lands together. Paying for that once per batch is cheaper than
every agent fighting a moving target.

## Structure that makes parallel work safe

- **Disjoint ownership.** Each agent's prompt names exactly the folders it may
  edit. A shared file it needs changed is *reported*, not edited; the gate
  does it.
- **Registries that discover, not lists that are edited.** Showcase sections
  are found by `import.meta.glob`; each component group has its own `index.ts`
  and `styles.css` which the aggregators import. Adding work never touches a
  shared list.
- **Agreed cross-group APIs up front.** When group A needs group B's component
  (DataTable needs Checkbox), the API is written into the batch brief and both
  code against it. The gate reconciles any drift.
- **Exactly one installer per batch.** Concurrent `bun install` corrupts the
  lockfile. Dependencies the next batch needs are installed by the gate before
  it.
- **Append-only shared docs.** CHANGELOG lines may be appended by many agents;
  memory files are new files per group (`<group>-lessons.md`); the gate indexes
  them in `memory/README.md` and tidies.
- **Prefixed scratch.** Playwright sessions, dev-server ports and scratch files
  carry the agent's prefix (`dash-`, `stress-`), or agents overwrite each
  other's harnesses.
- **Global class names are prefixed by group** (`r-<group>-…`), enforced by
  `verify:class-prefix`, because parallel agents otherwise invent the same
  class.

## What each agent prompt carries

- The shared decisions/principles files to read first, and the old family to
  learn from (read-only).
- Exactly what it owns and may edit, and what it must report instead.
- What "done" means: tests that can fail, the package `check`, a visual check
  across theme × density × input × width, saved screenshots it has actually
  looked at, and a short report in a stated shape and length.
- "Break it once": every check that passes first time is broken on purpose and
  seen to go red, or it proves nothing.

## Pitfalls seen

- **A late agent writing during a gate.** An agent can finish background work
  after its report. Check for recently modified files before a gate starts and
  tell the gate to re-read from disk.
- **Backups that silently fail.** A tamper test whose backup step failed still
  applies the tamper. Check the backup exists before breaking anything, and
  revert by exact inverse edit when it didn't.
- **Contract drift during a batch.** Removing Tailwind defaults in the CSS
  package silently killed classes written in parallel; the gate's
  `verify:utilities-exist` caught it. Any change that can make code dead needs
  a check that notices dead code.
- **Duplicated mechanisms.** Three groups each invented a hit-area class. The
  gate's job includes looking for the same idea solved twice and moving it to
  its single source (here, the contract).
- **IDE diagnostics mid-batch are noise.** Files are half-written; only the
  gate's `typecheck` counts.
- **A browser check that measured the wrong element, and passed.** Once the
  showcase's own frame became an AppShell, a bare `.r-…-sidebar` selector in
  the Dashboard check found the showcase's sidebar, not the Dashboard's, and
  every assertion held. Scope selectors to the thing under test, then break
  that thing (here: delete its bottom nav) and watch the check go red.
- **A new contract lever leaves old literals behind.** A batch that adds a
  token (a line weight, a stacking scale) updates the utilities; component
  stylesheets written earlier keep `1px` and `z-index: 2`. The gate greps for
  the literal the lever replaces and turns it into a check.
- **A check that measures the outer box misses what an inner box absorbs.** The Overview
  check measured each demo frame for sideways overflow; a spill inside a scroller within the
  demo never reached the frame. Measure every scroll container, and make the exemption an
  explicit, local opt-out on the thing designed to scroll, never on the whole demo.
- **A growing showcase outgrows every per-script timeout at once.** Six agents each added
  sections, and several unrelated checks began timing out on their first wait. The fix is
  structural: code-split the pages, have the app publish a "ready" signal, and give every
  check one shared wait for it, rather than raising each script's own timeout.
- **The same small look gets written three times.** Three agents each copied the Field
  error's markup (icon + error ink) for their own messages, and the original lacked a fix one
  copy had. Grep for a component's class string, not only its name, when looking for
  duplicates.
- **Dev and production bundles disagree.** A per-language lazy load measured right in the
  production build while the dev server fetched every grammar (its pre-bundled dependency
  ignores tree-shaking). A browser check against the dev server must count what the code
  under test asks for, and the production claim is settled by measuring the build.
