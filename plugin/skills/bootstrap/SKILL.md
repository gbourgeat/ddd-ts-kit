---
name: bootstrap
description: >-
  Sets up a new or existing TypeScript backend with the ddd-ts-kit architecture (config,
  composition root, database, Docker Compose, tracing, OpenAPI and event scripts, CI
  pipeline, agent rules, first bounded contexts). Run by the user only, with
  /ddd-ts-kit:bootstrap.
argument-hint: "[http: express|fastify|nest] [validation: zod|class-validator]"
disable-model-invocation: true
allowed-tools:
  - Bash(npx ddd-ts-kit init *)
  - Bash(npx ddd-ts-kit@* init *)
  - Bash(npm install)
  - Bash(npm run verify)
---

# Bootstrap a project

Stack hints given: `$ARGUMENTS`

1. Look before asking: `ls`, `package.json`, existing `src/`. An existing project is adopted, never
   overwritten: the CLI skips existing files unless `--force`.
2. Settle the stack. Ask only for what cannot be read from `package.json`:

   | Choice | Options | Default |
   |---|---|---|
   | HTTP | `express`, `fastify`, `nest`, `none` | `express` |
   | Validation | `zod`, `class-validator`, `standard-schema` | `zod` |
   | DI | `tsyringe`, `nest`, `manual` | `tsyringe` (`nest` with NestJS) |
   | ORM | `drizzle`, `knex`, `prisma`, `typeorm`, `custom`, `none` | `drizzle` |
   | Database | `postgres`, `mysql`, `sqlite`, `none` | `postgres` |
   | Events | `outbox`, `in-memory` | `outbox` with a database |
   | API docs UI | `swagger`, `scalar`, `redoc`, `none` | `swagger` |
   | Tests | `vitest`, `jest` | `vitest` |

3. Settle the first bounded contexts and their ubiquitous language with the skill
   `ddd-ts-kit:model-context`: the glossary comes before any code. Do not invent
   contexts to fill the tree: one well-named context beats four guessed ones.
4. Preview, then run:
   ```bash
   npx ddd-ts-kit@latest init --http <http> --validation <validation> --di <di> \
     --orm <orm> --database <database> --events <events> --docs-ui <ui> \
     --context <name>:<core|supporting|generic> --dry-run
   npx ddd-ts-kit@latest init ...same flags
   npm install
   ```
5. Prove it: `npm run verify` (typecheck, tests, `check:arch`, `docs:check`). Report the output.
   Then `npm run infra:up` (Docker Compose: database, optional tracing backend) and
   `npm run dev` (auto reload); the API documentation is served at `/docs`.
6. Tell the user what exists now and the next step: `ddd-ts-kit:use-case` for the first use case.

Do not hand-write any file the CLI generates. If a generated file is wrong, say so: it is a bug
of the template, not something to patch locally.
