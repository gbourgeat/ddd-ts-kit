# {{project.name}}

Domain-Driven Design and Clean Architecture on [ddd-ts-kit](https://www.npmjs.com/package/ddd-ts-kit).
The rules are in `CLAUDE.md` and `.claude/rules/`; `npx ddd-ts-kit explain <rule-id>` explains each one.

## Run it

```bash
npm install
cp .env.example .env
{{#if database.server}}
npm run infra:up        # the database, in Docker; add --profile observability for Jaeger
{{/if}}
{{#if orm.drizzle}}
npm run db:generate     # SQL migrations from the Drizzle schema
npm run db:migrate
{{/if}}
{{#if orm.knex}}
npm run db:migrate      # builds, then applies migrations/ (the first one creates every table)
{{/if}}
{{#if orm.prisma}}
npm run db:client       # the Prisma client and the schema of the tests, from prisma/schema.prisma
npm run db:generate     # a migration from the schema
npm run db:migrate
{{/if}}
{{#if orm.typeorm}}
npm run build && npm run db:generate   # a migration from the entity schemas
npm run db:migrate
{{/if}}
npm run dev
```

`npm run dev` restarts the application when a source file changes. It runs `tsx watch`, which
executes TypeScript directly; `--env-file-if-exists=.env` gives Node the variables of `.env`
when the file is there, and `--import` loads `{{config.platformDir}}/tracing.ts` before
everything else so that instrumentation is installed first. `src/platform/config.ts` validates
the variables and refuses to start when one is wrong.
{{#if docs.any}}

The API documentation is served at `/docs` and the contract at `/openapi.json`, outside
production unless `API_DOCS=true`.
{{/if}}

## Tooling

The compiler is the native TypeScript 7, installed under the alias `@typescript/native` and
called by its path in `npm run typecheck` and `npm run build`. `typescript` 6 is installed next
to it because ESLint and dependency-cruiser read sources through the compiler API, which the
native version does not ship: do not use `npx tsc`, it would run version 6.

| Gate | Script | Tool |
|---|---|---|
| types | `npm run typecheck` | TypeScript 7 |
| code rules | `npm run lint` | ESLint with `@ddd-ts-kit/eslint-plugin` |
| structure | `npm run check:arch` | `ddd-ts-kit check` |
| import graph | `npm run depcruise` | dependency-cruiser, on `.dependency-cruiser.cjs` (generated from `ddd-ts-kit.config.json`) |
| dead code | `npm run deadcode` | knip |
| drift | `npm run docs:check` | context map, OpenAPI, AsyncAPI, event catalog |

`npm run verify` chains them with the tests. Git hooks: `npm run hooks:install` once per clone
(lefthook: lint and architecture on staged files, conventional commit messages).
{{#if ci.any}}
The pipeline calls the same `ci:*` scripts; what makes it binding is described in
{{#if ci.github}}
`.github/branch-protection.md`{{/if}}{{#if ci.gitlab}} `.gitlab/merge-request-settings.md`{{/if}}.
{{/if}}

`ddd-ts-kit.config.json` also takes `"guard": "enforce" | "advise" | "off"` (default `enforce`):
how the editor hook of the ddd-ts-kit plugin reacts when a file just written breaks a rule
(refuse it, only say so, or stay silent).

## Work on it

1. Define the vocabulary in the `CONTEXT.md` of the context, with the domain experts.
2. Model: aggregates, value objects, events, in the words of that glossary.
3. Scaffold with `npx ddd-ts-kit generate ...` and fill the `TODO(domain)` places it lists.
4. Test: builders and fakes, no mocks. `npm test`, then `npm run test:e2e`.
5. Verify: `npm run verify`.

| Script | Does |
|---|---|
| `npm run dev` | the application with auto reload |
| `npm test` | domain, application and adapter specs |
| `npm run test:e2e` | the whole application through HTTP, on an in-process database unless `DATABASE_URL` is set |
| `npm run check:arch` | `ddd-ts-kit check` |
| `npm run docs:generate` | context map, OpenAPI, AsyncAPI and event catalog |
| `npm run verify` | everything CI runs |
