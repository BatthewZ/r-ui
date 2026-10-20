# Validator, Zod and schema.json: lessons

## One source, three readers

The conformance rules exist once, as a JSON Schema written in TypeScript. The
validator interprets it, `./zod` is built from it and `schema.json` is it with
the validator's `x-` annotations stripped. A rule written twice drifts, and a
covariant type cannot catch the drift in the direction that matters (a list
that shrinks still type-checks). Bind each object shape to its interface with a
helper whose parameter is `{ [K in keyof T]-?: … }`, so adding or dropping a
key in the format's types fails to compile until the schema follows; hold an
inline union and its tuple equal with a two-way type equality.

Agreement is still proved by behaviour, not by construction alone: a corpus
(one document touching every shape, one break per rule, edge cases that must
pass) plus a few thousand seeded random mutations, all judged by the validator,
the Zod schema and an interpreter over the published file. Assert the tally
lands on both answers, or "they agree" may mean "they all say yes".

## Pick the branch a value evidently meant

A union passes when any branch does; that part is not a choice. Which branch to
report when all fail is: the discriminator's branch (`x-discriminator`), else
the one branch that applies (its type matches, it requires a key the value
has, its constants match) and fails deepest; a tie is one issue at the union in
its own words. Reporting every branch's failure buries the one line that
matters.

Make union branches fail fast. A probe that descends into two branches of the
same value at every level is exponential in nesting: give every branch a
required key or a constant that rules it out before any descent, check keys
before values, and never probe a branch the discriminator already excluded. An
"is not a sole marker key" rule belongs beside the object's value checks as a
key-only `anyOf`, not as two overlapping object branches.

## The stack is the limit, and it is shared

Frames on the recursive path (check → object/array/union → check) all stay on
the stack at once; keep those functions small and push scalar checks and
message building into helpers that return before the descent. Even so a
document thousands of levels deep runs out, in every JSON Schema reader and in
Zod alike. Catch `RangeError` at the top and report it as its own error code,
never as a throw; walks of the raw value (the not-JSON check, the declaration
scan) are iterative.

## Warnings must say what the renderer will do

Every warning is a promise that the renderer drops, refuses or ignores that
value. Keep the promise by calling the same code, not by writing the rule
twice: see gate1-lessons.md.

## Zod's JSON Schema reader is not a referee

`z.fromJSONSchema` is looser than the spec in places (it reads
`additionalProperties` beside `patternProperties` as open, and ignores untyped
key-only branches), so it can show the published schema is never stricter than
the validator, not that it is as strict. Write the gap down as an asserted fact
so the test says when it closes.
