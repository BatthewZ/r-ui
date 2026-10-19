# Browser checks on a build, in parallel sessions

Learned moving `browser:check` from one session on the dev server to a development build
under `vite preview`, split across sessions, October 2026.

- **Build every run rather than guess staleness.** The showcase builds in about a second;
  rebuilding every run makes a stale build impossible without comparing timestamps. A
  CSS edit made just before a run shows up in it.
- **A development-mode build keeps React's warnings.** `NODE_ENV=development vite build
  --mode development` ships React's development build, so a duplicate key still reaches
  the console the checks collect; the production build drops the warning and the same
  check stays green there. Both modes are worth running: the production build had never
  been in a browser, and every check passed on it.
- **A claim about modules needs the build's names.** Stack frames and request URLs in a
  build name chunks, not source files. A check that attributes a listener to a source
  folder reads each frame back through the chunk's source map (and fails when a frame
  resolves to nothing), and a lazy-load claim counts the chunks fetched. Without that the
  check passed vacuously on the build: nothing could ever match a source path.
- **Every wait needs a limit, or one stuck page holds the whole run.** playwright-cli's
  own page waits for a navigation without limit and `page.evaluate` has none of its own;
  a shard sat idle for minutes on one. Bound the in-page waits (a frame, the fonts) and
  the navigations, and give each script a hard limit as the last resort. The daemon runs
  one command at a time per session, so a hung session cannot be inspected from outside.
- **Parallel sessions remove slack a lone session had.** Under three sessions a "two
  frames after the scroll" read landed a frame before the header had even turned hidden.
  Time a frame window from the event it is about (the frame the state changed), not from
  the action that should cause it.
- **Two runs must not share files.** A second run that rebuilt into the first run's
  output directory and cleared its logs mid-run; each run now works in its own folder.
- **A cold dev server and parallel sessions do not mix.** Each module compiles on its
  first request; three sessions against a cold server timed out on the ready signal.
  Parallelism belongs to the static build.
- **Read a sharded run's differences as timing first.** Sequential, sharded and shuffled
  runs matched on every count; only frame-timed readouts (px in 10 frames, ms to open)
  moved, and those are the timing scripts, which run alone after the shards.
