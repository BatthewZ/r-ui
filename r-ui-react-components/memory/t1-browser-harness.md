# Browser-check harness: what a check costs, and where it goes

Measured on the runner's own profile (`browser:check --profile`), October 2026.

- **A load of the whole Overview is the cost, not the check.** Opening one section on the
  Overview lays out every section: ~3–5 s per load and ~450 requests, growing with each new
  section, and every interaction after it (a click, a `getBoundingClientRect`) is slower
  on that huge document too. The same check on the section alone loads in ~0.5–0.7 s and
  its interactions ran about four times faster. Open sections alone (`openSection`); keep
  the Overview for the checks whose claim is about the whole page.
- **Change the View live, not by reload.** The showcase publishes the same preference
  hooks its switchers use, so a check can move theme, density, input and direction in a
  couple of hundred milliseconds. A fresh load is for the View a claim needs at mount.
- **A hash-only `goto` keeps the document.** Going from one hash to another on the same URL
  is a same-document navigation: nothing remounts and state survives. A reset or a fresh
  mount needs a new document (leave for `about:blank` first, or reload).
- **The page outlives the check.** One session runs every script, so anything a check (or
  the harness) patches onto `page` must be put back exactly, or the next script inherits it.
- **Code inserted into a script can land in a page-side callback.** A callback handed to
  `page.evaluate` runs in the page, where the prelude does not exist; inserted calls are
  guarded with `typeof`, and use a name no script declares (a script's own `const` of the
  same name puts the call in its temporal dead zone).
- **A session's memory grows across scripts.** A renderer that ran full-Overview scripts
  reached ~2.3 GB RSS (the session ~2.8 GB PSS) and does not shrink between scripts; a
  solo or Stress page holds ~0.3–0.4 GB. Budget shards by the heaviest script a session
  will run, not by a fresh page.
- **playwright-cli sessions run in parallel.** Each session is its own daemon and browser;
  two sessions' `run-code` calls overlap fully. Each call pays about a second of process
  start.
- **A page that suspends on `use()` needs an awaited `act` in jsdom.** Rendered in a plain
  `render`, the Suspense fallback never resolves in the test; wrap the render in
  `await act(async () => …)`.
- **A light page removes the slack a heavy one gave.** Moved from the Overview to the
  section alone, two checks failed only because frames and round trips got shorter: a list
  still mounted for its exit when the next one opened (a strict locator saw two), and a
  "closed within two frames" claim that a 30ms Overview frame had always covered. The first
  was the harness's (wait for the exit to finish), the second a real bug (reduced motion's
  0.01ms exits were still waited on). Decide which it is; never pad a wait to hide the bug.
- **Read frame-timed numbers as timing.** Distances "in 10 frames", heights "two frames
  in", hover-intent milliseconds and "not loaded yet" counts change with how heavy the page
  is; compare the claims they guard, not the readouts.
- **A section is as wide alone as on the Overview by construction.** The demo frame is an
  inline-size container (it adds no intrinsic width) and the pages' grid column is
  `minmax(0, 1fr)`. Headless scrollbars take no width; a reserved gutter
  (`scrollbar-gutter: stable`) does, and narrowed the solo page by 15px.
