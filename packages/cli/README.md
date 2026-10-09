# ddd-ts-kit

Bootstrap, scaffold, document and verify Domain-Driven Design and Clean Architecture projects
in TypeScript. One binary: `init` creates the project, `generate` writes every piece of
boilerplate at its canonical place, `docs` keeps the architecture documentation current,
`check` proves that the code still follows [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
`init` also installs the quality pipeline: ESLint with `@ddd-ts-kit/eslint-plugin`,
dependency-cruiser, knip, coverage thresholds, git hooks and the CI of GitHub or GitLab.

The generator and the checker share one definition of the canonical tree, and a test generates
every kind for every stack and requires zero violation: they cannot disagree.

No runtime dependency. Node 22.12 or later.

```
npx ddd-ts-kit init
npx ddd-ts-kit generate context billing --classification core --term "Invoice=A request for payment"
npx ddd-ts-kit generate aggregate billing Invoice
npx ddd-ts-kit generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue --term "Issue=To make an invoice final"
npx ddd-ts-kit generate route billing IssueInvoice --method POST --path /invoices
npx ddd-ts-kit check
```

Every command accepts `--json` (machine-readable output, errors included) and `--cwd <dir>`.
Commands other than `init` look for `ddd-ts-kit.config.json` in the directory and its parents.
Exit codes: `0` success, `1` violations or stale documentation, `2` wrong usage (the message
says what to do).

## init

```
ddd-ts-kit init [--http express|fastify|nest|none]
                [--validation zod|class-validator|standard-schema|none]
                [--di tsyringe|nest|manual] [--tests vitest|jest]
                [--orm drizzle|knex|prisma|typeorm|custom|none]
                [--database postgres|mysql|sqlite|none]
                [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                [--ci github|gitlab|both|none]
                [--authn jwt|none] [--authz rbac|abac|rebac|custom]
                [--broker none|rabbitmq|custom] [--allow-no-outbox "<reason>"]
                [--context <name>:<core|supporting|generic>]...
                [--dry-run] [--force]
```

Works in an empty directory or an existing project. An existing file is never replaced without
`--force`; it is reported as skipped. An existing `package.json` is merged: missing scripts and
dependencies are added, yours are kept and mentioned in the notes. Run again later, `init` keeps
the stack recorded in the config.

Defaults: `express`, `zod`, `tsyringe` (`nest` with `--http nest`, and only then), `vitest`,
`drizzle` on `postgres`, `outbox` when there is an ORM, `swagger`, `github`, `jwt`, `rbac`, no broker.
`--events in-memory` together with an ORM is refused unless `--allow-no-outbox "<reason>"` is given:
it records a `deviations` entry (`stack.events`) and writes the decision record it points to. The generated
persistence of the four ORMs is written for PostgreSQL; `custom` starts on in-memory adapters
held to the contract suites, for you to replace. The choices are recorded under `stack` in the
config, `docsUi` and `ci` included.

| Written | Content |
|---|---|
| `ddd-ts-kit.config.json` | stack, contexts, rule severities ([docs/CONFIG.md](../../docs/CONFIG.md)) |
| `package.json` | scripts and dependencies of the stack (below) |
| `tsconfig.json`, `tsconfig.build.json` | strict, NodeNext, alias `@/*` to `src/*`; decorator flags only for nest or class-validator |
| `src/main.ts` | composition root: tracing first, config, persistence, application, outbox relay, HTTP server |
| `src/platform/` | `tracing.ts`, `config.ts` (fail-fast, `DATABASE_URL` included), `platform.module.ts`, `application.ts` (wires the contexts), `http-server.ts`, `http-docs.ts` (`/docs` and `/openapi.json`, off in production unless `API_DOCS=true`), `outbox-relay.ts` |
| `src/platform/auth/` | `authenticator.ts` (`--authn jwt`: `JwtAuthenticator` on `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI`; `--authn none`: `DevelopmentHeaderAuthenticator`, which reads `x-development-actor` and throws in production), `http-boundary.ts` (`resolvePrincipal` and `withPrincipal`: every request runs inside the actor context), `authorizer.ts` and the files of the model (`roles.ts`; `attribute-policies.ts`; `relationships.ts`, its store contract spec and `permissions.ts`; `custom-authorizer.ts`, its `authorizerContract` spec and `permissions.ts`), `authorization.ts` (`authorizationModule` with tsyringe, a guard for the hand-wired buses otherwise), `access-policies.ts`, `audit.ts` (one structured line per decision, ids and codes only). Without an HTTP stack there is no authenticator and no boundary |
| `src/platform/events.ts` | the event provider of `--broker`: the in-memory bus; `RabbitMqEventBus` with one subscriber per consuming context (`forConsumer`), `AMQP_URL` validated, a `rabbitmq` compose service; or `custom-event-bus.ts` with its `eventBusContract` spec |
| `src/platform/database/` | `persistence.ts` (unit of work, outbox and processed-event stores of the ORM package), connection, schema, `testing.ts` (PostgreSQL in process, or the server named by a URL) |
| migration tooling | `drizzle.config.ts`, `knexfile.js` and `migrations/0001_initial.js`, `prisma/schema.prisma` and `prisma.config.ts`, or `data-source.ts` |
| `scripts/openapi.ts`, `scripts/events.ts` | write `openapi/openapi.json`, `docs/integration/asyncapi.json` and `docs/integration/event-catalog.md`; `--check` fails on a difference |
| `docker-compose.yml`, `.env.example`, `Dockerfile`, `.dockerignore` | the database with a healthcheck and a named volume, Jaeger behind the `observability` profile, ports from `.env`; a multi-stage, non-root image with production dependencies only |
| `vitest.e2e.config.ts`, `test/e2e/support/application.ts` | the whole application on a free port, on an in-process database unless `DATABASE_URL` is set |
| `docs/context-map.md`, `docs/integration/README.md` | see `docs` |
| `test/architecture/extractable.spec.ts` | written with the first context: boots each context alone on the kernel and the platform |
| `eslint.config.mjs` | the `dddTsKit` preset of `@ddd-ts-kit/eslint-plugin`, typed linting on the project's tsconfig |
| `.dependency-cruiser.cjs` | the import graph rules, generated from the config (see `depcruise-config`) |
| `knip.json` | dead code: entry points are `main.ts`, the scripts, the specs and the fakes |
| `vitest.config.ts` | unit and integration projects, coverage thresholds per layer |
| `lefthook.yml`, `commitlint.config.mjs` | pre-commit and commit-msg hooks (`npm run hooks:install`), conventional commits |
| `--ci github` | `.github/workflows/ci.yml`, `codeql.yml`, `pr-title.yml`, `.github/dependabot.yml`, `.github/branch-protection.md`, `renovate.json` |
| `--ci gitlab` | `.gitlab-ci.yml` (architecture findings as a Code Quality report through `check --format gitlab`), `.gitlab/merge-request-settings.md`, `renovate.json` |
| `README.md`, `CLAUDE.md`, `.claude/rules/*.md` | how to run it; a short guide (commands, map of the rules, generated files, compiler note) and the invariants by layer, each rules file scoped by a `paths` frontmatter |
| `.claude/settings.json` | permissions only: the checks and generators run without asking, `.env` files are unreadable (`.env.example` stays readable), the three generated documents are not edited by hand, `git push`, `npm publish` and any edit of the files that hold the rules and the pipeline (`ddd-ts-kit.config.json`, `eslint.config.mjs`, `.dependency-cruiser.cjs`, `knip.json`, `lefthook.yml`, `.gitlab-ci.yml`, `.github/workflows/**`, `.claude/settings.json`) ask first |

`--ci both` writes the two pipelines, `--ci none` neither (and no `renovate.json`). The pipeline
files are copies of the assets of the repository's `pipeline/` directory, shipped in
`templates/pipeline/`; a test fails when a copy differs from its source by more than its
documented placeholders.

An existing `.claude/settings.json` is never overwritten: the missing permissions are appended
to its lists, everything else is kept, and the notes of the command list what was added. The
`.env` rule relies on the gitignore semantics of permission patterns: `Read(./.env.*)` is
denied and `Read(!./.env.example)`, a negation placed after it in the same list, takes the
example file back out.

Scripts: `dev` (`tsx watch` with `.env` loaded by `--env-file-if-exists` and tracing preloaded),
`build`, `start`, `typecheck`, `lint`, `lint:fix`, `test`, `test:e2e`, `check:arch`, `depcruise`,
`deadcode`, `quality`, `openapi:generate|check`, `events:generate|check`, `docs:generate|check`,
`db:generate`, `db:migrate`, `infra:up`, `infra:down`, `hooks:install`, the `ci:*` scripts the
pipelines call, and `verify`: typecheck, lint, tests, end-to-end tests, `check:arch`,
`depcruise`, `deadcode`, `docs:check`.

`package.json` carries two compilers: `typescript ~6.0.3`, which the tools load as a library,
and `@typescript/native` (`npm:typescript@~7.0.2`), which `build` and `typecheck` call by path
(`node node_modules/@typescript/native/bin/tsc`). `npx tsc` would run the older one.

`init` and `generate context` start with the language: the first entry of `next` is the glossary
of the context to fill in.

## generate (alias g)

```
ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--dry-run] [--force]
```

| Kind | Arguments | Writes |
|---|---|---|
| `context` | `<name> --classification <c> [--purpose "<two sentences>"] [--term ...]... [--upstream <ctx>[:relationship]]...` | `CONTEXT.md` with its glossary, `<name>.module.ts`, `published-language/index.ts`, `application/authorization/<name>.permissions.ts`, config entry, registration in `platform/application.ts` and in `test/architecture/extractable.spec.ts` |
| `aggregate` | `<context> <Name>` | aggregate, builder, spec in given / when / then |
| `builder` | `<context> <Aggregate>` | `test/builders/<name>.builder.ts`, a class extending `Builder` |
| `entity` | `<context> <Name>` | entity, spec |
| `value-object` (`vo`) | `<context> <Name>` | value object, spec |
| `domain-event` | `<context> <Aggregate> <Fact>` | event named `<context>.<aggregate>.<fact>`, spec |
| `domain-error` | `<context> <Name> [--code CODE]` | error with a stable code, spec |
| `domain-service` | `<context> <Name>` | service, spec |
| `repository` | `<context> <Aggregate> [--tenant-scoped]` | domain interface, adapter of the project's ORM with its mapper and table (or model), fake extending `InMemoryRepository`, one `repositoryContract` spec run on both, registration |
| `command` | `<context> <UseCaseName> (--permission <aggregate>.<action> \| --public) [--aggregate <Name>]` | command on `AuthorizedCommand` (plain `Command` when public), handler, spec through the bus with the refusal of an actor who lacks the permission, registration with `.requires(...)` or `.public()` (and the repository when missing) |
| `query` | `<context> <UseCaseName> (--permission <aggregate>.<action> \| --public)` | query on `AuthorizedQuery` (plain `Query` when public), handler, read port, in-memory reader, fake, spec, registration on the query bus |
| `port` | `<context> <Name>` | port, fake |
| `route` | `<context> <UseCaseName> --method <GET\|POST\|PUT\|PATCH\|DELETE> --path <p> [--command\|--query]` | route depending on `CommandBus` or `QueryBus` (and DTOs with class-validator), spec, registration |
| `integration-event` | `<context> <Aggregate> <Fact> [--version n]` | `defineIntegrationEvent` declaration in the published language, index export, publisher, spec, registration |
| `consumer` | `<context> <upstreamContext> <eventType>` | consumer depending on `CommandBus`, spec, idempotent subscription; refused unless the upstream is declared |
| `event-handler` | `<context> <Aggregate> <Fact>` | reaction to a domain event of the context, spec, subscription |
| `acl` | `<context> <upstreamOrSystemName>` | translator in `infrastructure/anti-corruption/`, spec |
| `e2e` | `<context> <UseCaseName>` | `test/e2e/<use-case>.e2e.spec.ts` driving the route of the use case: 401 without a credential, 403 without the permission, the documented status with it; needs the route |
| `policy` | `<context> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec, registration in `platform/auth/access-policies.ts` |
| `gateway` | `<context> <upstreamContext> <Name>` | the read contract in the upstream's published language, a port of the caller, an in-process adapter in `infrastructure/external/` bound `.as('gateway')`, a fake, one contract suite; refused unless the upstream is declared |
| `service` | `<context>` | `src/apps/<context>/main.ts` (kernel, platform, that context only), script `start:<context>`, a compose service behind the `services` profile, the knip entry, `deployable: true` in the config. The Dockerfile takes the entry as build argument `ENTRY` |
| `adr` | `"<title>" [--deviation <what>] [--reason "<why>"]` | `docs/adr/NNNN-<slug>.md`; with `--deviation`, the `deviations` entry of the config that points to it |

- **Deny by default.** `command` and `query` are refused without `--permission` or `--public`. A new
  permission joins `<context>.permissions.ts`; its words are checked against the glossary like any
  other name. With `--authz rebac` the requirement names the context as its resource, a starting
  point to replace by the element the right bears on.
- `route` hands `actorOf(context.principal)` to a protected use case and sets `security` (the scheme
  of `--authn`, or `false` for a public one). `consumer` carries `systemActor('<context>.<consumer>')`
  for the command it builds; behind a broker it subscribes with `consume(...)` on the subscriber of
  its context.
- `repository --tenant-scoped` (drizzle and knex) adds the tenant column and an adapter that reads the
  tenant of `ActorContext` on every statement, with a spec that one tenant does not see another's
  rows. With another ORM the regular adapter is written and a note says what to add.
- **The language first.** The name of an aggregate, entity, value object, domain service, domain
  event, command or query is refused when one of its words is not covered by a term of the
  `## Ubiquitous language` table of the context (plural, past participle and -ing forms are
  recognised). `--term "<Term>=<meaning>"`, repeatable, adds the rows in the same command.
  Technical words (`Manager`, `Helper`, `Data`, `Impl`, `Model`...) and an event fact that does
  not read as past tense are refused too. `--allow-name` overrides the three checks; `check`
  will still report what the glossary does not define.
- Generated code compiles as is and passes `check` at the default severities. Every place that
  needs business knowledge carries a `// TODO(domain): ...` comment saying which decision is
  expected, and a place where an adapter is to be replaced a `// TODO(platform): ...` one; these
  are the only comments.
- Specs hold one real passing test where it can be written generically, and `it.todo` entries
  naming the behaviours to cover. No mock: fakes, builders, `createTestApplication` (tsyringe)
  or `createTestBuses`.
- `--json` prints `{ dryRun, created, updated, skipped, next, todos, notes }`. `next` lists the
  `TODO(domain)` places as `file:line`, the glossary first; `todos` adds their text.
- A kind that needs something else to compile either creates it (a missing repository or
  domain event) or stops with the command that creates it (a missing aggregate, use case or
  route).
- Registration goes between marker comments (`// ddd-ts-kit:<region>` ... `// /ddd-ts-kit:<region>`,
  HTML comments in Markdown). Remove a marker and the generator prints what to add by hand.
- Every `generate` refreshes the generated documentation and `.dependency-cruiser.cjs` when
  they exist; generating twice changes nothing.
- A fake is an entry point for knip and may have no importer for dependency-cruiser: a port
  and its fake generated before a use case needs them fail neither analyzer. A domain service
  is kept alive by the spec generated with it.

Templates are plain files in `templates/<kind>/`, with `{{name.pascal}}`, `{{name.camel}}`,
`{{name.kebab}}`, `{{name.constant}}`, `{{context.kebab}}` placeholders and
`{{#if x}}` / `{{#unless x}}` blocks. An unknown placeholder is an error.

## docs

```
ddd-ts-kit docs [--check]
```

Regenerates what is derived from the config and the code, and nothing else:

- `docs/context-map.md`, between `<!-- ddd-ts-kit:context-map -->` markers: a Mermaid diagram
  (one node per context styled by classification, one arrow per relationship from upstream to
  downstream labelled with the pattern) and the table of contexts with the first sentence of
  their purpose, upstreams, downstreams, published events and whether they are deployable alone. The text outside the markers is
  kept; on first creation the four written sections are laid out with hints.
- the generated lists of every `CONTEXT.md` (aggregates, published events, permissions, relationships);
- `docs/integration/README.md`, created once and never rewritten; its Provider section starts with
  the strategy of the chosen broker.

`--check` writes nothing, names each stale file and exits 1. The event catalog and the
AsyncAPI document need the code of the project to run, so they are produced by
`scripts/events.ts` (`npm run events:generate`, part of `npm run docs:generate`).

## depcruise-config

```
ddd-ts-kit depcruise-config [--check | --write]
```

Prints the dependency-cruiser configuration derived from `ddd-ts-kit.config.json`: layers,
published languages, declared upstreams, allowed packages, cycles and orphans. `--write` saves
it as `.dependency-cruiser.cjs`; `--check` exits 1 when the file is missing or stale, which is
what `npm run depcruise` runs first. Edit the config, not the file.

## list

```
ddd-ts-kit list
```

Contexts with their classification, glossary size, upstreams, aggregates, commands, queries,
domain events, published events, builders, permissions, policies, gateways and whether the context
is deployable alone, then the end-to-end specs.

## check

```
ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab]
                 [--changed-since <git-ref>] [--self]
ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github|gitlab]
```

Each violation has a rule id, a severity, a file, a line, a message and a `fix`: one sentence
saying what to do instead. Exit code 1 when there is at least one error.

- `paths` and `--changed-since` limit what is reported, not what is analysed.
  `--changed-since` runs `git diff --name-only --relative <ref>...` in the project.
- `--format github` prints `::error file=...,line=...::` annotations.
- `--format gitlab` prints a GitLab Code Quality report: one issue per violation, `major` for
  an error and `minor` for a warning, with a fingerprint that does not depend on the line.
- Severities come from `rules` in the config (`error`, `warn`, `off`). Default `error`, except
  `test/no-mocks`, `test/builder-required`, `clean/function-size`, `clean/no-noise-comment` and
  `clean/no-flag-argument` (`warn`). `any` in a test file is always a warning.
- `limits: { "maxParameters": 3, "maxFunctionLines": 30 }` in the config sets
  `clean/function-size`.
- `domainAllowedPackages`, `applicationAllowedPackages` and `publishedLanguageAllowedPackages`
  extend what the inner layers may import.
- Suppress one line with `// ddd-ts-kit-disable-next-line <rule-id> -- ADR-0007: <reason>`. Without a
  reason the comment is itself a violation, and so is a reason that names no existing decision record. On the first line of a file it also covers
  file-level violations.
- `--clean-only` runs the rules that judge a file on its own (`clean/stepdown`,
  `clean/function-size`, `clean/no-commented-out-code`, `clean/no-noise-comment`,
  `clean/no-escape-hatch`) on any directories, without a project or a config.
- `--self` replays the rule fixtures shipped with the CLI and exits 0 when every rule behaves
  as expected.

| Rule | Detects |
|---|---|
| `layer/domain-purity` | in `domain/`: a package outside `domainAllowedPackages`, any Node built-in, another layer, another context |
| `layer/application-inward` | in `application/`: `infrastructure/`, `presentation/`, the platform, a package outside the allow-list, a Node built-in |
| `layer/presentation-no-infrastructure`, `layer/infrastructure-no-presentation` | the forbidden import, inside one context |
| `context/published-language-only` | an import of another context outside its `published-language/` |
| `context/declared-relationship` | an import of a published language whose context is not a declared upstream |
| `context/published-language-is-a-contract` | `published-language/` importing anything but its allow-list and other published languages |
| `context/no-cycle` | a cycle in the declared upstreams, with its path |
| `tree/closed` | a directory outside the canonical tree and `extraDirectories`; a source file outside a role directory |
| `tree/context-doc` | a missing `CONTEXT.md`, a missing section, a classification that contradicts the config |
| `naming/suffix` | a file without the suffix of its role, or not in kebab-case |
| `naming/one-concept-per-file` | several exported classes in an aggregate, entity, value object, event, command, query, handler or consumer file |
| `test/spec-required` | an aggregate, value object, domain service, handler, event handler or consumer without a spec |
| `test/no-mocks` | `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins, or a mocking library in a context's tests |
| `test/builder-required` | an aggregate without `test/builders/<name>.builder.ts` |
| `events/name-format` | an event name that is not `<context>.<aggregate>.<fact>` in kebab-case with the right context |
| `events/defined-in-published-language` | `defineIntegrationEvent` outside a published language, without a payload, twice for one version; an event described by hand |
| `language/glossary-term` | a class of the model named with a word the glossary of its context does not define; an empty glossary |
| `language/no-technical-name` | `Manager`, `Helper`, `Util`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` in a type declared under `domain/` or in a use case folder |
| `purity/no-system-clock` | `new Date()` without argument, `Date.now()`, `performance.now()` in `domain/` or `application/` |
| `purity/no-ambient-randomness` | `Math.random`, the random source of `crypto`, an id library |
| `purity/no-environment` | `process.env` and friends, `console`, `fetch`, file system and network modules |
| `clean/stepdown` | a private method before the last public one or above its first caller; a non-exported function above its first use |
| `clean/function-size` | more parameters or body lines than the limits (constructors are exempt from the parameter limit, module files from the line limit) |
| `clean/no-commented-out-code` | comment lines shaped like statements |
| `clean/no-noise-comment` | banners, closing-brace labels, authors and dates, empty `@param` and `@returns`, a comment that only repeats the declared name, a `TODO` without owner or reference |
| `clean/no-escape-hatch` | `any`, a non-null assertion, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` or `eslint-disable` without a reason |
| `clean/no-flag-argument` | a `boolean` parameter on a public method of a domain class or on `execute` |
| `composition/only-in-module` | `new X` or `useClass: X` of a class imported from `infrastructure/`, outside the module file, `main.ts`, the platform and tests |
| `config/valid` | unknown upstream, classification, relationship, rule id or `guard` mode; a context missing on disk or in the config |
| `config/suppression-needs-reason` | a suppression without a rule id or a reason (kept as an alias next to `governance/recorded-deviation`, which judges the reason) |
| `authz/declared` | in a module file, `builder.command(X)` or `builder.query(X)` without `.requires(` or `.public(` in its chain; with manual or nest wiring, a command or query class absent from every `requires(X, ...)` and `publicUseCase(X)` of the module file and of `application/authorization/`; a `defineRoute` without `security` |
| `authz/in-application` | `presentation/`: a test on roles, `isAdmin`, the import of an authorizer or of `Access`; `infrastructure/`: `authorize(` or `check(` on an authorizer or access, `ForbiddenError`; `domain/`: any import of `@ddd-ts-kit/auth`, of the actor types of the kernel, a read of `.roles` or `.permissions` on an actor |
| `authz/actor-explicit` | in `domain/` and `application/`: `ActorContext`, `ACTOR_CONTEXT`, `AsyncLocalStorage`, `.current()` or `.require()` on an actor context |
| `events/outbox-required` | `stack.events` other than `outbox` with an ORM and no `stack.events` deviation; in `domain/` and `application/`, the import of a broker client or of a bus or relay implementation; a publisher depending on more than `IntegrationEventPublisher`; a platform module that hands out a publisher and never names `OutboxPublisher` |
| `events/consumer-idempotent` | a consumer class registered nowhere in its module file under a consumer name; a free `on(` or `consume(` without `processed`; a consumer name used twice |
| `context/extractable` | a module file importing another context outside its published language; persistence importing another context's infrastructure or naming its schema; a handler importing another context's repository; `export let` or an exported `new Map`, `Set`, `WeakMap` at module level; `deployable: true` without `apps/<context>/main.ts` |
| `governance/recorded-deviation` | a `ddd-ts-kit-disable` or `eslint-disable` comment whose reason names no `ADR-<number>` with a file `docs/adr/<number>-*.md`; a rule set to `off` (or to `warn` below its default), an extra directory, an extra allowed package, a `guard` other than `enforce` or `stack.events` off the outbox, without a `deviations` entry `{ what, adr, reason }` pointing to an existing record |

Five more ids belong to `@ddd-ts-kit/eslint-plugin`, which reads the syntax tree where this
checker reads text: `domain/aggregate-encapsulation`, `domain/value-object-immutability`,
`domain/no-generic-error`, `application/handler-shape` and
`application/command-query-separation`. `rules` and `explain` show them as "checked by
@ddd-ts-kit/eslint-plugin", the config accepts them under `rules`, and `check --rule` on one of
them answers with `npm run lint`.

`guard` in the config (`enforce`, `advise` or `off`) tells the editor hook of the plugin how to
react to a violation after a write: refuse it, only report it, or stay silent. `check` ignores
it, apart from validating its value.

### Limits

The checker reads sources with a small lexer and a shallow reading of declarations, not with a
compiler. It follows relative specifiers, the configured alias and bare packages, and
classifies files by their path.

- Comments, strings, templates and regular expressions are skipped; a regular expression in an
  unusual position can hide the rest of its line. `.tsx` syntax is not understood.
- Re-exports, barrels, `tsconfig` paths other than the alias and computed specifiers are not
  resolved, so a type reaching a layer through a barrel of an allowed layer is not seen.
- Declarations: top-level `function` declarations and class methods are read; arrow functions
  assigned to constants or properties, object-literal methods and nested functions are not, so
  `clean/stepdown`, `clean/function-size` and `clean/no-flag-argument` do not judge them.
- `clean/stepdown` matches uses by name: a helper shadowed by a local of the same name, or a
  private method called through another receiver than `this`, is misjudged. Protected methods
  are neutral.
- `clean/no-commented-out-code` and `clean/no-noise-comment` are heuristics on the shape of a
  line: prose ending like a statement can be flagged, code written as a sentence is missed.
- `language/glossary-term` matches word by word with a crude English inflection; it does not
  know synonyms, and a term of several words covers each of its words separately.
- `purity/*` looks for the listed tokens and modules; a wrapper around them goes unseen.
- `clean/no-escape-hatch` does not see `any` produced by inference, nor a type assertion to
  another type than `any`.
- `composition/only-in-module` sees `new` and `useClass` on imported names; a factory function
  or a re-exported adapter escapes it.
- `events/name-format` checks the shape and the context prefix, not the grammar of the fact.
- `test/spec-required` and `test/builder-required` check that the file exists, not its content.
- `authz/*`, `events/*` and `context/extractable` match names and shapes: an aliased import, a
  route definition built from a variable or a spread, an ownership test (`invoice.ownerId ===
  actor.id`), a schema name in raw SQL, a cross-context transaction and a mutable exported array
  or object go unseen; the content of `apps/<context>/main.ts` is not judged.
- `governance/recorded-deviation` checks that the decision record exists, not what it says; a
  deviation entry that justifies nothing any more is not reported, and `limits` are not governed.
- Nothing constrains what `shared-kernel/`, `platform/` and `main.ts` import.

## check-file

```
ddd-ts-kit check-file <path>
```

Runs the per-file rules (layers, contexts, naming, events, language, purity, clean code, mocks,
composition, suppressions) on one file without walking the project: meant for an editor or
agent hook after each write. A file that is not a source of the project is ignored.

## rules, explain

```
ddd-ts-kit rules
ddd-ts-kit explain <rule-id>
```

`rules` lists the ids, descriptions and current severities, and says which ones ESLint checks.
`explain` prints the rule, why it exists, a bad and a good example, and the suppression syntax.

## Development

```
node node_modules/@typescript/native/bin/tsc -b packages/cli
npx vitest run packages/cli
DDD_TS_KIT_E2E=1 npx vitest run packages/cli    # also type-checks, runs and lints generated projects
node packages/cli/dist/bin.js check --self
npm run clean:self --workspace ddd-ts-kit       # the clean/* rules on this package
```

With `DDD_TS_KIT_E2E=1`, three projects are generated in full (the default stack; `--authz rebac
--broker rabbitmq --ci gitlab`; `--authz abac --orm knex --di manual`), each runs its specs, its
end-to-end specs (401 without a token, 403 without the permission, 2xx with it, with tokens signed
in the test), its build and its documentation checks, and is held to ESLint with the preset,
dependency-cruiser with the generated configuration and knip, with zero finding; one violation is
then injected for each analyzer in the default project and has to be caught. The RabbitMQ project
keeps its events in the process unless `DDD_TS_KIT_TEST_AMQP_URL` names a broker.
