# Building in parallel in one worktree

How the r-ui family was built: one orchestrator, many subagents, one branch, no
worktree-per-agent. It worked because parallel work and verification were kept
apart: **build in parallel batches, then integrate in one sequential gate.**

## The loop

1. **Settle the contract before fanning out.** Names that several agents will
   read (tokens, utilities, cross-group component APIs) are decided first, by
   one agent or by the orchestrator in a shared decisions file. Parallel agents
   designing the same names produce two vocabularies.
2. **Batch: up to five agents at once, each owning disjoint files.** One
   package, one component group, one showcase page per agent. Shared files are
   avoided by structure rather than by care (see below). Agents **build, they
   don't run the heavy checks**: they write code, unit tests and browser
   scripts, may run their own new test files on a single Vitest worker and one
   typecheck at the end, and never start a browser, a dev server, the full test
   suite or `browser:check`.
3. **Gate: one agent, alone.** Reconciles what the batch did blind to itself,
   fixes cross-cutting problems, runs everything (`check`, `test`, `build`,
   `showcase:build`, `browser:check`), and looks at screenshots across every
   axis. Nothing else runs during a gate.
4. **The orchestrator verifies the gate's claims itself** before starting the
   next batch: re-runs the suite and spot-checks screenshots. Agent reports are
   claims, not evidence.
5. Repeat. Each batch's reports feed the next gate's fix list.

Batching the testing is the point. Integration problems (name drift,
duplicated helpers, inconsistent hover washes, a section that crashes the page)
only appear when everything lands together, so per-agent suite runs mostly test
a moving target. They also cost memory: each full run is a Vitest worker per
core plus, for browser checks, a dev server and a headless Chrome. Five to
seven agents doing that at once exhausted a 20 GB WSL VM. Run the suite and
the browsers once, in the gate, with nothing else running.

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
- What "done" means for a builder: the code, unit tests and browser scripts
  written (tests designed so they can fail), its own new tests passing on one
  worker, a clean typecheck, and a short report in a stated shape and length
  that lists what the gate must run and look at.
- What "done" means for the gate: the full `check`, `test`, builds and
  `browser:check`, a visual pass across theme × density × input × width with a
  sample of screenshots actually looked at, and "break it once": every check
  that passed first time is broken on purpose and seen to go red, or it proves
  nothing.

## Pitfalls seen

- **`/tmp` is RAM.** On this WSL setup `/tmp` is a tmpfs, so briefs, screenshots,
  PDFs and logs written there hold memory until deleted, and vanish on a
  restart. Keep orchestration files and artefacts on disk, outside the repo
  (e.g. `~/.cache/r-ui-orchestration/`), keep only a sample of screenshots plus
  failures, and delete what has been looked at.

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
- **Two groups that each borrow from the other.** Agents told "use group B's component"
  in parallel can make A use B while B uses A (a palette in overlays took form's Input as a
  picker in form took overlays' Popover). Neither agent sees the cycle. A gate on the group
  import graph (`verify:group-deps`) makes it a failing check; the fix is a group above both
  or a shared piece moved down.
- **A browser script nobody has run is a draft.** After a crash, agents wrote checks
  without running them. At the gate most failed first on the harness, not the code (a
  multi-file pick on a single-file input, a popup that flipped above the clip it was
  expected below, geometry read mid-animation, a forced-colours comparison that a
  translucent wash satisfied). Run each one alone, fix the harness to measure the claim,
  then break the code once to see it go red.
- **A shared harness file is a single point of failure.** One agent rewrote the browser
  prelude every check runs inside and never ran a check; it called `URL`, which
  playwright-cli's run-code scope does not have, so all 29 checks failed on their first
  line. Lint passed because its globals list named `URL` for the page side too. After
  changing a prelude, a runner or a shared helper, run one check through it before
  anything else, and make lint's globals the narrowest scope the code runs in.
