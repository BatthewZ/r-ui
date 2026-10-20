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
   fixes cross-cutting problems, runs `check`, `test`, `build` and
   `showcase:build`, and looks at screenshots across every axis. Nothing else
   runs during a gate. **Browser checks in a gate are targeted**: the scripts
   for what the batch touched (`bun run browser:check --changed`, or `--group`
   per area) plus the cross-cutting sweeps (`--tier sweep`: the all-sections,
   forced-colour, print, floating and hit-area sweeps and the Stress page's;
   `--changed` adds them by itself). A check that is not a sweep (the
   virtualized table's, the Dashboard's) is reached by its group or page, not
   by the sweep tier. The full `browser:check` runs once per round, at the
   end, not after every batch: per-gate full runs cost the wall-clock nothing
   else can run underneath. How to run them: "Running the browser checks"
   below.
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

## Running the browser checks

`bun run browser:check` (r-ui-react-components) builds the showcase in development
mode, serves it with `vite preview`, and runs its scripts in parallel sessions.

- **Targeted in a gate:** `--changed` (or `--group a,b`, `--tier sweep`, name
  filters). The full suite once per round.
- **Preview, not the dev server.** The default target is a fresh build (about a
  second, every run, so never stale): no hot reload under a running check, React's
  development warnings still collected, one static server shared by every session.
  `--production` runs the same scripts on the production build. `--dev` is for
  debugging against live source and runs one session by default: a cold dev server
  compiles on first request, and parallel sessions against it time out (four checks
  failed that way, then passed alone).
- **Shards.** The runner picks N from free memory (a session that runs an all-sections
  sweep peaks near 2.2 GB, a solo-section one near 1 GB), at most 4, at most 3 with
  a sweep in the set, and prints the budget. Timing-flagged scripts run alone after
  the shards. A failure is re-run alone; one that then passes is FLAKY and fails the
  run. Nothing else heavy (Vitest, builders) runs during a sharded run.
- **Wall clock, 57 scripts (Oct 2026, 7 cores, 19 GB):** one session on preview
  ~545 s; 3 shards ~255 s (each shard ~175 s, then the ~78 s timing tail); the
  production build ~242 s. Before the migration the same coverage took ~39 min in one
  session on the dev server.

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

## Rounds, verification and fix batches

A **round** is a few batches with a gate after each. Shape that has worked:

1. **A solo contract step first** when something cross-cutting must exist
   before parallel work: the token contract, a shared labels/locale mechanism,
   anything every component will call. One agent, alone, then a light gate.
   Parallel agents can't agree on a mechanism they are all inventing.
2. **Builder batches** of up to five, each followed by its gate.
3. **A verification round** once the building is done, with exactly one agent
   editing and the rest read-only so they can't collide:
   - one agent runs the `refactor` and then the `checker` skill across the
     packages (it may fan out its own sub-agents; pass the resource rules on);
   - read-only reviewers for API consistency and design principles,
     accessibility at the code level, and test quality (checks that cannot
     fail). Split these by area so none hands back half-finished;
   - a consumer check: pack tarballs from a snapshot copy, install them into
     a separate strict-TS app, follow only the READMEs.
4. **A fix batch**: the findings, triaged by the orchestrator into up to five
   agents with disjoint ownership, then a gate. Decide the cross-cutting
   conventions the findings imply (naming of label props, destructive
   variants, where `className` goes, controllable popups) **once, in the
   batch brief**, so each owner applies them to its own groups.

## The orchestrator's job between agents

- **Write the briefs to disk** (`~/.cache/r-ui-orchestration/`, never `/tmp`)
  and point every prompt at them; keep prompts short.
- **Relay.** When one agent publishes something others need (a shared util,
  a renamed selector, a reordered demo), message the agents still running
  with the exact names. Agents can't see each other's reports.
- **Collect** what reports scatter: breaking renames, memory files to index,
  things the gate must run in a browser. Put them in one file for the gate;
  agents don't edit the CHANGELOG in a fix batch, the gate assembles it.
- **Spot-check claims** before acting on them (grep the line a reviewer
  quotes) and **re-run the suite yourself** after every gate.
- **Make the calls agents surface**: contract questions (a new token?),
  deviations (APG order over the brief's wording), packaging choices.
- **Commit only when the user asks**, after checking the staged set has no
  screenshots, logs, PDFs, build output or secrets.

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
- **A demo nobody rendered is a draft too.** Builders that never open a browser lay out
  demos by habit; in batch E1 two showcase sections put form fields in a flex row where
  they collapse to nothing at every width, and the browser checks written for those demos
  failed on the layout, not the component. The gate looks at every new section before
  trusting what its checks say, and fixes the demo, not the assertion.
- **A gate that matches names across files regresses as files are added.** A heuristic
  keyed on a variable's spelling held until a later agent used the same common word
  (`classes`) for something else, and an unchanged file started failing. Cross-file
  matches go by binding (an import), and the fixture holds the same-name case.
- **A break that stays green is a finding, not a pass.** Each gate breaks every new
  assertion once; the ones that stayed green here found a duplicated guarantee (a rule
  the contract already made) and a check that could not see its claim (centred vs merely
  visible). Tighten the check or delete the duplicate, then break it again.
- **The dev server reloads under a running check.** A gate that edits `src/` or the showcase
  while browser checks run against the same dev server gets hot reloads mid-measure and
  flaky failures that are nobody's bug. Batch the checks, edit between batches (docs and
  scratch files are safe meanwhile), and re-run what an edit touches.
- **A check that never ran hides real bugs behind harness bugs.** In gate E2 nine of the
  twelve new browser checks failed first; about half on the harness (an unregistered token
  read as `1.5rem`, a required field's label with its `*`, a locator matching two live
  regions, a transition read mid-turn) and half on the code (a spill that scrolled the whole
  page, a selection lost in the browser but kept by jsdom, a tree row taller than
  `--ROW-H`). Fix the harness first, then believe the failures that remain.
- **A harness error in a callback kills the whole session.** playwright-cli's `run-code`
  scope has no `setTimeout` (nor `URL`); a `page.route` handler that called it threw outside
  the script's own `try`, the daemon died and every later command said "Session closed".
  Wait with `page.waitForTimeout` in Node-side callbacks. Likewise a probe that turns on CDP
  touch emulation leaves `(hover: hover)` false for the rest of the session: reopen it
  before trusting the next check.
- **A check whose demo cannot differ proves nothing.** Pricing's rows "lined up" because
  every card's parts were equally tall; subgrid was in fact disabled (the card was a size
  container) and the break stayed green. Make the check create the difference it guards
  against (lengthen one card), then break the code again.
- **A fix can make a neighbouring check vacuous.** Gate E4 moved a hidden site header fully
  past the host's bar; the older "it paints under that bar" assertion could then never fail
  (nothing overlapped), and breaking `isolate` stayed green. Re-break the assertions next to
  every fix, not only the new ones, and make the check create the overlap itself.
- **Builders' workarounds are the gate's fix list.** A page agent that cannot edit the
  library works around its gaps and says so; the gate fixes each at the source, removes the
  workaround and proves it with an assertion that goes red without the fix. Leaving the
  workaround in place teaches the next consumer the workaround.
- **A gate never touches the git index.** `git rm` stages the deletion; delete with `rm` and
  leave staging to whoever commits.
