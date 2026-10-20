---
name: document
description: >-
  Keeps the generated documents and contracts of a ddd-ts-kit project current: the OpenAPI
  contract from the routes, the event catalog and the AsyncAPI document from the integration
  events, the generated lists and diagram, plus the written integration notes and decision
  records. Use when a route, a schema, an error code or an integration event changes, when
  the user asks for the API contract, Swagger, client generation, an ADR or the integration
  documentation, or when the pipeline reports documentation or contract drift. The glossary
  and CONTEXT.md belong to glossary; relationships and the map to context-map.
argument-hint: "[openapi|events|adr <title>]"
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit docs)
  - Bash(npx ddd-ts-kit docs --check)
  - Bash(npx ddd-ts-kit generate adr *)
  - Bash(npm run regenerate)
  - Bash(npm run docs:generate)
  - Bash(npm run docs:check)
  - Bash(npm run openapi:generate)
  - Bash(npm run openapi:check)
  - Bash(npm run events:generate)
  - Bash(npm run events:check)
  - Bash(git diff *)
---

# Generated documents and contracts

Scope requested: `$ARGUMENTS` (everything when empty)

Two kinds of content, never mixed: **generated** (derived from code and config, rewritten by
a command, checked for drift in the pipeline, never edited by hand: the guard refuses) and
**written** (decisions and meaning no tool can derive, short).

| File | Kind | Rewritten by |
|---|---|---|
| `openapi/openapi.yaml` (one file per document of `openapi.documents`), `<platform>/http/openapi-documents.ts` | generated from the route definitions and the config | `npm run docs:generate` |
| `docs/integration/event-catalog.md`, `asyncapi.yaml` | generated from `defineIntegrationEvent` declarations and their handlers | `npm run events:generate` |
| `docs/context-map.md` between its markers, lists of each `CONTEXT.md` between theirs, `<context>.declarations.ts` and the `<folder>.declarations.ts` of each role folder | generated from the config and the tree | `npx ddd-ts-kit docs` (every `generate` runs it) |
| `.dependency-cruiser.cjs` | generated from the config | `npx ddd-ts-kit depcruise-config --write` |
| `docs/integration/README.md` | written | you |
| `docs/adr/NNNN-<slug>.md` | written, one decision each | `npx ddd-ts-kit generate adr "<title>"` |

`npm run docs:generate` runs the three generators; `npm run docs:check` fails on a stale
file and is part of `npm run verify`. `npm run regenerate` is the one step after a change of
route, schema, event or config: `depcruise-config --write`, then `docs:generate`, which already
runs `npx ddd-ts-kit docs` (a project without the script gets it from `npx ddd-ts-kit init --force`).

## Procedure

1. Change the source: the route definition, the event declaration, the config. Never the
   generated file.
2. Regenerate (`npm run regenerate`), then read `git diff -- openapi docs`: it is the summary of what the change
   did to the contracts. A diff you did not expect is a breaking change you did not intend.
3. Update the written parts the diff makes stale. If nothing is stale, write nothing.
4. Commit the generated files with the code that changed them (skill
   `ddd-ts-kit:commit-discipline`).

## The HTTP contract

Routes, schemas, error codes, what is breaking, the typed clients (`ddd-ts-kit sdk`): [openapi.md](openapi.md).
Under `"stack.representations": "negotiated"` the contract lists every media type of a route
(`produces`, `consumes`), `406` on every route that answers a body and `415` on every route that
reads one; a field marked with `withFieldAccess` carries `x-field-access`. The contract script and
the documentation page take the representations of the boundary: never generate it with other
ones than the server is mounted with. Under `"stack.forms": "on"`, `npm run docs:generate` also writes each form whole
to `openapi/forms/<operationId>.json`, checked like the contract: commit them with the route.

## Integration notes (`docs/integration/README.md`)

What the catalog cannot say, each in a few lines: delivery guarantees (at least once, no
order across aggregates) and what a consumer must tolerate; the provider per environment,
its retry and dead-letter policy, how to replay; the versioning policy and how an old
version is retired; one Mermaid `sequenceDiagram` per business flow crossing contexts, with
the eventual-consistency window a user may notice; for each outside system, its port, its
adapter, its failure behaviour and where its credentials are configured (never their
value). Describe a payload field in its schema (`.describe(...)` with zod): it flows into
the catalog and the AsyncAPI document.

## Decision records

A choice that constrains the future (a boundary, a relationship pattern, a provider, an
exception to a rule) gets a record: context, decision, consequences, alternatives rejected,
half a page. `npx ddd-ts-kit generate adr "<title>" [--deviation <what>] [--reason "<why>"]`
numbers it (after the highest, or `--number <n>` when the project numbers by block, so that
parallel branches never collide), and with `--deviation` writes the config entry that points to it. An accepted
record is never rewritten: it is superseded by a new one.

Style everywhere: present tense, business vocabulary, no history of how the code got there,
no copy of generated content, diagrams in Mermaid so they are diffable.
