# Changelog

## 0.1.0 (unreleased)

First release. Format version 2; there is no compatibility with version-1 documents.

- `ViewRenderer` renders a document given whole (`spec`), as a growing string (`text` +
  `complete`) or from `useViewSpecStream`, inside a view root carrying the density.
- `./spec`: the format's types, the safety and URL policy, `validateViewSpec`,
  `formatIssuesForModel`, `createValidationHandler` and `listComponentNames`, free of React.
- `./stream`: the incremental parser (`createViewSpecParser`, `parsePartialViewSpec`, `PENDING`).
- `./reference`, `./icons`, `./zod`, `./styles`, `./schema.json`, and the `r-ui-validate` bin.
