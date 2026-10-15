# Example themes have no privileges

The default theme is `:root`. Everything else, the shipped examples included, is a consumer
theme. The moment an example gets something a consumer theme cannot have (a name in a
selector, a type, a default, a config list, a fixture), the reskinning claim is quietly false.

How the package keeps that mechanical rather than cultural:

- No entry imports a theme. Examples sit under `examples/`, outside semver, deletable.
- The theme-rule check fails if an example's name appears anywhere in the package outside its
  own file, Markdown included. Docs describe them as "a dark example" or "the examples".
- Tests and fixtures invent their own names; when a test needs a real example it discovers
  one from disk.
- The specimen discovers themes from the loaded stylesheet and builds its CSS by reading the
  examples directory, so adding or deleting an example needs no edit anywhere else.
- Theme files are validated by the same scripts a consumer can run on their own theme.
