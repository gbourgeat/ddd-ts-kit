---
name: scaffold
description: >-
  Creates ONE new file of a ddd-ts-kit role from a template with `ddd-ts-kit generate`
  (context, aggregate, entity, value object, domain event, domain error, domain service,
  command, query, port, repository, route, integration event, integration event handler, domain event handler,
  anti-corruption layer, builder, e2e spec), with its spec and wiring, then lists the
  places where business logic is expected. Use whenever a single file of one of these roles
  is needed, instead of writing it by hand. For a whole feature or endpoint use use-case;
  for cross-context events use integration-event.
argument-hint: "<kind> <context> <Name> [options]"
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Read
  - Grep
  - Glob
---

# Scaffold

Requested: `$ARGUMENTS`

Boilerplate is generated, never typed. The generator and the checker share one definition of
the architecture, so a generated file is conformant by construction and costs no tokens.

## Kinds

| Kind | Command | Lands in |
|---|---|---|
| context | `generate context <name> --classification <c> [--upstream <ctx>:<rel>]` | `contexts/<name>/` |
| aggregate | `generate aggregate <ctx> <Name>` | `domain/aggregates/` |
| entity | `generate entity <ctx> <Name>` | `domain/entities/` |
| value object | `generate vo <ctx> <Name>` | `domain/value-objects/` |
| domain event | `generate domain-event <ctx> <Aggregate> <Fact>` | `domain/events/` |
| domain error | `generate domain-error <ctx> <Name> [--code CODE]` | `domain/errors/` |
| domain service | `generate domain-service <ctx> <Name>` | `domain/services/` |
| command | `generate command <ctx> <UseCase> [--aggregate <Name>]` | `application/commands/<use-case>/` |
| query | `generate query <ctx> <UseCase>` | `application/queries/<use-case>/` |
| port | `generate port <ctx> <Name>` | `application/ports/` + fake |
| repository | `generate repository <ctx> <Aggregate>` | interface, in-memory adapter, contract suite |
| route | `generate route <ctx> <UseCase> --method <M> --path <p>` | `presentation/http/` |
| integration event | `generate integration-event <ctx> <Aggregate> <Fact>` | `published-language/` + publisher |
| integration event handler | `generate integration-handler <ctx> <upstream> <event-type>` | `application/integration/handlers/` |
| event handler | `generate event-handler <ctx> <Aggregate> <Fact>` | `application/event-handlers/` |
| anti-corruption layer | `generate acl <ctx> <upstream-or-system>` | `infrastructure/anti-corruption/` |

## Procedure

1. Name from the glossary of the context's `CONTEXT.md`. If the term is missing, add it there
   first. The CLI refuses `Manager`, `Helper`, `Util`, `Data`, `Info`: find the domain word.
2. Run with `--json`:
   ```bash
   npx ddd-ts-kit generate <kind> ... --json
   ```
   The output lists `created`, `updated` and `next`: the `file:line` of every `TODO(domain)`.
3. Open only the `next` locations. Each `TODO(domain)` states the decision expected: an
   invariant, a field, an error, a payload. Implement it and delete the marker. A marker you
   cannot resolve is a question for the user, not a guess.
4. Replace each `it.todo` of the generated spec by a real test. Tests first when the rule is
   non-trivial (skill `ddd-ts-kit:use-case`).
5. `npx ddd-ts-kit check` and the tests of the context.

Never edit the structure the generator produced (constructor visibility, factories, suffixes,
folders). If the structure does not fit, the model is probably wrong: go back to
`ddd-ts-kit:model-context`.
