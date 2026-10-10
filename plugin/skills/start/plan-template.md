# Architecture plan

Next: 1 discover-domain - write the event storming from the needs below

The `Next:` line above is read by tools at the start of every session: keep it on one line,
`Next: <step number> <skill> - <first thing to do>`, and `Next: done` at the end.

## Needs

<the statement of needs, word for word, with its date and who stated it>

## Steps

| # | Step | Artefact | Status |
|---|---|---|---|
| 1 | Discover the domain | `docs/architecture/discovery.md` | todo |
| 2 | Find the bounded contexts | `docs/architecture/contexts.md` | todo |
| 3 | Write the glossaries | `docs/architecture/glossary.md`, then each `CONTEXT.md` | todo |
| 4 | Draw the context map | `docs/architecture/context-map.md`, then `docs/context-map.md` | todo |
| 5 | Choose the stack and bootstrap | `ddd-ts-kit.config.json`, the project | todo |
| 6 | Plan the slices | `docs/architecture/slices.md` | todo |
| 7 | Build | code, one commit per slice | todo |

Status is `todo`, `in progress`, `done` or `skipped` (with the reason under Decisions).

## Decisions

One line each: `<date> <what was decided>: <why> (<who decided>)`. A decision that constrains
the code later becomes a record in `docs/adr/` once the project exists.

## Open questions

One line each, with who can answer. A question blocks only the step that needs its answer.
