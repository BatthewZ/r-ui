# The Pages site

What deploying the showcase and the playground to GitHub Pages taught.

- **Deploy from release tags, not `main`.** The apps import their package from source, so a
  build of `main` shows unreleased work. Each app builds from its own package's latest tag.
- **GitHub raises no push event for a push of more than three tags.** A release that pushes
  every package's tag in one `git push` triggers nothing. Push tags one at a time.
- **A project site lives under a base path (`/r-ui/`).** Hash routing needs no fallback page,
  and Vite's `--base` moves the bundle, but any absolute path an app hands the browser
  (`/fixtures/…` in a document) escapes the base. Rebase it in the app, keyed to Vite's
  `BASE_URL`, so the default `/` stays the identity and the dev, preview and browser checks
  are untouched.
- **The `github-pages` environment allows the default branch only.** A tag-triggered deploy is
  refused until the environment's deployment policy names the tag patterns.
