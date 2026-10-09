---
name: audit-context
description: >-
  Reviews one whole bounded context in depth, beyond what automated checks see (anemic
  model, misplaced logic, leaky boundaries, weak tests, naming outside the ubiquitous
  language), and returns a prioritized list of findings. Read-only. Use for a design review
  of a context or before refactoring it. For a diff or a pull request use the
  architecture-reviewer agent.
argument-hint: "<context>"
context: fork
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Audit a bounded context

Context to audit: `$0`. If empty, stop and ask which context.

Read-only: produce findings, change nothing.

## 1. Start from the machines

```bash
npx ddd-ts-kit list --json
npx ddd-ts-kit check src/contexts/<context> --format json
```

Mechanical violations are listed as is. Then look for what a tool cannot see.

## 2. Strategic

- `CONTEXT.md` is current: every aggregate and event on disk is listed, glossary terms match
  class and method names. Names in code that are not in the glossary are findings.
- The classification still fits the effort visible in the model.
- Imports of `published-language/` from upstreams: are there fields the context copies around
  without using? Is an anti-corruption layer missing?
- Does the context publish events nobody consumes, or expose internals in payloads?

## 3. Tactical

| Smell | How to spot it |
|---|---|
| anemic aggregate | public setters, or methods that only assign; rules in handlers |
| fat handler | branches on domain state, loops over entities, computes amounts |
| oversized aggregate | loads collections it does not need for its invariants |
| cross-aggregate transaction | a handler saving two aggregates |
| primitive obsession | `string` or `number` for emails, money, periods, statuses, identifiers of other aggregates |
| technology-named port | `StripePort`, `PostgresUserStore` in `application/ports/` |
| leaking persistence | ORM entities or rows returned through a repository interface |
| generic errors | `throw new Error(...)` for a business failure, or one error class for many cases |
| DTO reuse | a presentation schema imported by application or domain, or a response returning a domain object |
| invalid states representable | optional fields that are mandatory together, status plus nullable dates |

## 4. Tests

- Domain specs assert behaviour (events, errors, state through public API), not internals.
- Handler specs use fakes, cover each declared error code.
- Each fake and adapter share a contract suite.
- Test names read as business rules.

## 5. Report

A table sorted by severity (`blocker`: wrong behaviour or broken boundary, `major`: design
debt that will spread, `minor`), each line with `file:line`, the smell, the consequence and
the proposed move. End with the three changes that would pay off most. Do not pad: an
absence of findings in a section is stated in one line.
