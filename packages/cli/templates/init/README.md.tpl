# {{project.name}}

Domain-Driven Design and Clean Architecture on [ddd-ts-kit](https://www.npmjs.com/package/ddd-ts-kit).
The rules are in `AGENTS.md`, which every coding agent reads, and by layer in `.claude/rules/` and `.github/instructions/`; `npx ddd-ts-kit explain <rule-id>` explains each one.

## Run it

```bash
npm install
npm run verify          # every gate of the pipeline: green before the first line of business code
cp .env.example .env
{{#if database.server}}
npm run infra:up        # the database, in Docker; add --profile observability for Jaeger
{{/if}}
{{#if orm.drizzle}}
npm run db:generate initial   # migrations/<timestamp>_initial.sql, from the Drizzle schema
npm run db:migrate
{{/if}}
{{#if orm.knex}}
npm run db:migrate      # builds, then applies migrations/ (the first one creates every table)
{{/if}}
{{#if orm.prisma}}
npm run db:client       # the Prisma client and the schema of the tests, from prisma/schema.prisma
npm run db:generate initial   # prisma/migrations/<timestamp>_initial/, from the schema
npm run db:migrate
{{/if}}
{{#if orm.typeorm}}
npm run build && npm run db:generate migrations/initial   # migrations/<timestamp>-initial.ts, from the entity schemas
npm run db:migrate
{{/if}}
npm run dev
```

{{#if persistence.hasDatabase}}
Every migration is named `<timestamp>_<what-it-does>`: `npm run db:generate` refuses to run
without a name, so two branches never write the same file, and `npm run check:arch` reports
migrations that a merge left out of order (`npx ddd-ts-kit explain persistence/migration-history`).

{{/if}}
`npm run dev` restarts the application when a source file changes. It runs `tsx watch`, which
executes TypeScript directly and resolves an import alias from the `paths` of `tsconfig.json`;
`--env-file-if-exists=.env` gives Node the variables of `.env`
when the file is there, and `--import` loads `{{config.platformDir}}/tracing.ts` before
everything else so that instrumentation is installed first.
`{{config.platformDir}}/config/load-config.ts` validates the variables and refuses to start when
one is wrong.
{{#if docs.any}}

The API documentation is served at `/docs` and the contract at `/openapi.json`, outside
production unless `API_DOCS=true`; a contract split into documents (`openapi.documents` of
`ddd-ts-kit.config.json`) is served at `/openapi/<name>.json`, and the page offers each one.
`npm run docs:generate` commits it as `openapi/openapi.yaml` (or one file per document).
{{/if}}
{{#if sdk.on}}

A typed client of the contract is generated for its callers, one workspace package per document
under `clients/` (`npx ddd-ts-kit sdk`, run by `npm run docs:generate`): typed errors keyed by
the error codes of each operation, a credential per security scheme, no runtime dependency.
`npm run sdk:build` compiles them; publishing one is a manual step, its README says how.
{{/if}}

## How it is put together

{{#if errors.none}}
`{{config.sourceRoot}}/main.ts` is the composition root: tracing first, then the validated
configuration, the storage, and `composeApplication` of `{{config.platformDir}}/compose-application.ts`.
{{/if}}
{{#if errors.sentry}}
`{{config.sourceRoot}}/main.ts` is the composition root: tracing first, error reporting second
(`{{config.platformDir}}/errors.ts`), then the validated configuration, the storage, and
`composeApplication` of `{{config.platformDir}}/compose-application.ts`.
{{/if}}

- **A port is an abstract class, and the class is what is injected.** A repository port lives in
  `domain/repositories/`, any other port in `application/ports/`, one per file; an adapter
  `implements` its port. There is no token constant and no token file anywhere: a constructor
  parameter typed by a port class names what is injected (`private readonly clock: Clock`), the
  ports of the kernel included (`Clock`, `IdGenerator`, `CommandBus`, `UnitOfWork`... of
  `@ddd-ts-kit/kernel`).
{{#if di.tsyringe}}
- **Three modules, then the contexts.** `kernelModule({...})` binds the ports of the kernel to what
  this platform chose (one execution scope, one clock, the two buses with their middlewares);
  `platformModule` (`{{config.platformDir}}/platform.module.ts`) rebinds what needs the storage{{#if broker.external}}, the broker{{/if}}{{#if cache.redis}} or the Redis protocol server{{/if}}
  (`builder.rebind(UnitOfWork)`, `builder.bind({{persistence.tokenOrNone}})`...); the authorization
  module binds the guard both buses ask first. Replacing a provider happens in the platform module
  and nowhere else.
{{/if}}
{{#unless di.tsyringe}}
- **One `Platform`, handed to each context.** `createPlatform` (`{{config.platformDir}}/create-platform.ts`)
  builds the buses, the clock, the storage and the event ports once; the module file of a context
  receives it and registers its handlers, adapters and jobs on it. Replacing a provider happens
  there and nowhere else.
{{/unless}}
{{#if style.declared}}
- **A context declares itself.** Each class says what it is with a decorator of
  `@ddd-ts-kit/kernel/declarations` and is its own registration{{#if assembly.barrel}}; the composition root reads the
  generated barrel `<context>.declarations.ts`{{/if}}{{#if assembly.discovery}}; the composition root discovers the role files of
  each context at startup (`discoverContext`), publishers and jobs included{{/if}}.
{{/if}}
{{#if broker.external}}
- **Behind the broker each context listens under its own name**: the platform module rebinds
  `EventSubscribers` to `{ forContext: (name) => bus.forConsumer(name) }`, so a context keeps its
  queues when it is extracted (`npx ddd-ts-kit generate service <context>`).
{{/if}}
- **Domain events leave with the save.** A handler writes `await repository.save(aggregate)` and
  returns: the events the aggregates recorded wait for the end of the unit of work of the command
  and are dispatched there, before the commit, so their handlers see every save and what they
  write, the outbox included, commits or rolls back with it. An effect of a domain event exists
  only if the state change that recorded it is committed: a reaction outside the database is
  declared in the `after-commit` phase (at most once) or goes through an integration event.
- **Cross-cutting behaviour stays outside the contexts**: one action is one trace (the request,
  the use case, each repository or outbound call, the domain events and their handlers, the
  outbox append, then the publication and each consumer), put around the application by
  `traceApplication()` of `@ddd-ts-kit/tracing`, `tracedRoutes()` at the HTTP boundary and
  `tracedPublisher` for the relay; what leaves the process gets retries and a time limit
  (`{{config.platformDir}}/resilience/`), inside the span of the call.

## Observability

| Variable | Says |
|---|---|
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error` |
{{#if logger.stdout}}
| `LOG_FORMAT` | `json` only: the logger writes JSON lines on the standard output and has no pretty format (`init --logger pino` or `--logger winston` brings one, and redacts credentials) |
{{/if}}
{{#unless logger.stdout}}
| `LOG_FORMAT` | `json` (the default, everywhere) or `pretty` (a developer's terminal) |
{{/unless}}
| `LOG_SCRUB_MESSAGES` | `true` writes `[message removed]` for the message of every logged error that is not a `DomainError` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | where spans go; left out, none leaves the process. `docker compose --profile observability up -d jaeger`, then `http://127.0.0.1:4318`, and the traces are on `http://127.0.0.1:16686` |
| `TRACE_SAMPLE_RATIO` | the share of traces kept, 0 to 1; left out, every trace |
| `TRACE_CONSUMERS` | `continue` (the default): a consumed event stays in the trace of the request that published it; `link`: each delivery starts a trace linked to it |

Every log line carries the correlation id, the origin, the actor and the ids of the active trace
(`{{config.platformDir}}/observability/create-logger.ts`). Stopping the application flushes the
error reporter, then the logger, last: whatever logs has closed before.

## Scheduled jobs

`npx ddd-ts-kit generate job <context> <Name> --every 15m --command <UseCase>` writes a job in
`application/scheduling/`: it sends one command, as the system actor `system:<context>.<name>`,
and `execution.scheduledAt` says which period the work is for.

| Variable | Says |
|---|---|
| `RUN_JOBS` | whether this process runs the jobs by time ({{#if worker.off}}`true` by default{{/if}}{{#if worker.on}}`false` by default: the worker runs them{{/if}}) |
| `JOB_<CONTEXT>_<JOB>_ENABLED` | `false` switches one job off in one environment (`{{config.platformDir}}/job-settings.ts`, where a schedule or a timeout can be read from the environment too) |

- **A dedicated worker**: `npx ddd-ts-kit generate worker` writes `{{config.sourceRoot}}/apps/worker/main.ts`
  (the same modules as `main.ts`, no HTTP server, the jobs started whatever `RUN_JOBS` says), the
  script `npm run start:worker` and a compose service, and makes `RUN_JOBS` default to `false`
  for the API.{{#if events.outbox}} The worker runs no outbox relay: the events its commands store are relayed by the API.{{/if}}
- **A context extracted as a service** (`generate service <context>`) takes its jobs with it.
{{#if cache.redis}}
- **Several instances**: the kernel `Lock` is bound to `RedisLock`, so one occurrence of a job
  runs on one instance, best effort: it may still run twice or not at all (a paused holder, a
  failover), which is why a job, or the command it sends, is idempotent.
{{/if}}
{{#unless cache.redis}}
- **Limitation: one instance runs the jobs.** The kernel `Lock` is the in-memory one, which
  excludes inside one process only: two instances started with their jobs on both run every
  job. Run the jobs in a single process (one API instance, or one worker with `RUN_JOBS=false`
  on the API), or initialise the project with `--cache redis`, which binds `RedisLock`, or bind a
  lock between processes of your own to `Lock` in the platform.
{{/unless}}
{{#if files.any}}

## Files

The content of a file lives in a file storage, never in the database: {{#if files.local}}a directory
(`FILES_DIRECTORY`, `.data/files` by default, kept out of version control) whose signed links the
application answers under `/files`; before running several instances, move to an object store
with `npx ddd-ts-kit init --force --storage s3`{{/if}}{{#if files.s3}}a bucket of the S3 protocol (`S3_*` variables), MinIO
in `docker-compose.yml` while developing, which creates the bucket at its first start{{/if}}. The tests keep files in memory. An
aggregate keeps the `StoredFile` reference (key, size, media type, checksum). The command bus
stages a file a command carries before the transaction opens, `FileStaging` moves it to its key
with the commit and, every hour, purges what refused or rolled-back commands left in `staging/`. `npx ddd-ts-kit generate file-upload <context> <UseCase>` writes an
upload; see https://github.com/gbourgeat/ddd-ts-kit/blob/main/docs/concepts/file-storage.md.
{{#if files.local}}

| Variable | Says |
|---|---|
| `FILES_DIRECTORY` | the directory of the files, `.data/files` by default |
| `FILES_PUBLIC_URL` | where clients reach `/files`, which signed links point to: required in production, `http://localhost:<PORT>/files` elsewhere |
| `FILES_SIGNING_SECRET` | signs the links, 32 characters at least: required in production, even before the first file arrives; drawn at each start elsewhere |
{{/if}}
{{/if}}
{{#if errors.sentry}}

## Error reporting

Unexpected failures go to an error tracker through the kernel `ErrorReporter`, bound to
`@ddd-ts-kit/sentry`: Sentry or GlitchTip, which speak the same protocol, so only the DSN differs.
`{{config.platformDir}}/errors.ts` starts it, second import of every entry point, and nothing in
`domain/` or `application/` reports anything: a handler throws, and what stands around it reports.

| Variable | Says |
|---|---|
| `SENTRY_DSN` | where the events go. Empty or absent: the application starts and reports nothing. Anything else than a URL refuses the start |
| `SENTRY_ENVIRONMENT` | the environment issues are filed under; `NODE_ENV` when left out |
| `SENTRY_RELEASE` | the release issues are attached to; none when left out |
| `SENTRY_SCRUB_MESSAGES` | `true` removes the message of every reported error that is not a `DomainError`: for a tracker hosted by a third party |

| Reported | Not reported |
|---|---|
| a command or a query that fails with anything but a `DomainError` | a `DomainError`: a business refusal is an answer, not an incident |
{{#if http.any}}
| a request answered 5xx | a 4xx |
{{/if}}
| a scheduled run that failed, a timeout included | a skipped or missed occurrence |
{{#if errors.broker}}
| an integration event given up: retries exhausted, poison message{{#if events.outbox}}, publication of the outbox relay declared dead{{/if}} | a delivery that fails and is retried |
{{/if}}
{{#unless errors.broker}}
{{#if events.outbox}}
| an integration event whose publication the outbox relay declares dead | a publication that fails and is retried |
{{/if}}
{{/unless}}
| `uncaughtException` and `unhandledRejection`, as `fatal`, before the process exits with code 1 | |

One failure is one report: the first boundary that sees an error reports it, the others recognise
it. Each report carries the trace id of the active span, which opens the trace in the tracing
backend. What leaves the process is scrubbed first: no request body, header, cookie or query
string, no local variable, no breadcrumb, no email or name (the actor id only), no tenant. The
message of the error is sent: `scrubMessages: true` in `{{config.platformDir}}/errors.ts` removes
it for everything that is not a `DomainError`, which is the setting for a tracker hosted by a
third party. The README of `@ddd-ts-kit/sentry` has the full table and the other options
(`sampleRate`, `tagTenant`, `beforeSend`).

Stopping the application flushes the reporter, two seconds at most. The tools and the tests
compose the application without a reporter: nothing is reported there.

### A local GlitchTip

```bash
docker compose --profile errors up -d --wait    # GlitchTip 6, its PostgreSQL and its Valkey; the first start migrates, allow a few minutes
docker compose logs glitchtip | grep 'DSN:'     # the DSN of the project it created
```

Put that DSN in `SENTRY_DSN` of `.env` (`http://<public-key>@localhost:8000/1`) and restart the
application; from another container of the compose file, replace `localhost` with `glitchtip`.
Sign in at http://localhost:8000 with `test@example.com` / `admin_pass`. `GLITCHTIP_PORT` moves
the port, and the DSN the logs print then names it. This instance is for local development only:
its secret key, its `DEBUG` mode and its account are public.
{{/if}}

## Tooling

The compiler is the native TypeScript 7, installed under the alias `@typescript/native` and
called by its path in `npm run typecheck` and `npm run build`. `typescript` 6 is installed next
to it because ESLint and dependency-cruiser read sources through the compiler API, which the
native version does not ship: do not use `npx tsc`, it would run version 6.

Every file of the project is imported by an alias from the project root, never by a relative
path: `{{alias.platform}}/config/load-config{{alias.ext}}` for `{{config.platformDir}}/config/load-config.ts`,
`{{alias.test}}/...` for `test/`, `{{alias.scripts}}/...` for `scripts/`.{{#if alias.extensionless}} An import names its
file without an extension (`"importExtension": "none"` in `ddd-ts-kit.config.json`), and never a
directory: `.../published-language/index`.{{/if}}{{#unless alias.extensionless}} An import ends with the `.js` of the file the
compiler emits (`"importExtension": "js"` in `ddd-ts-kit.config.json`).{{/unless}} The alias is declared
once, under `paths` in `tsconfig.json`, which the compiler, `npm run dev`, the tests, knip and
the import graph read. Node reads no alias and needs the extension: `npm run build` compiles,
then `ddd-ts-kit build-aliases` rewrites each alias of `dist/` into a relative path ending in
`.js`, so `npm start` is plain `node`. `npm run lint:fix` turns a relative import into its alias
and gives an import the ending the config asks for, and `npm run check:arch` reports a
declaration that no longer follows `importAlias` and `importExtension` of
`ddd-ts-kit.config.json`, or a build that skips the rewrite (`imports/alias-only`,
`imports/extension`, `imports/alias-declared`).

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

## Recommended steps

Follow them in order: it is the path the kit supports, and each step leaves what the next one
reads. With the ddd-ts-kit plugin of Claude Code, `/ddd-ts-kit:start` conducts steps 1 to 7 and
records them in `docs/architecture/plan.md`; `npx ddd-ts-kit status` says which step is next.

1. **Discover the domain** (`/ddd-ts-kit:discover-domain`): actors, commands, events and
   policies in `docs/architecture/discovery.md`.
2. **Find the bounded contexts** (`/ddd-ts-kit:bounded-contexts`): `docs/architecture/contexts.md`.
3. **Write the glossaries** (`/ddd-ts-kit:glossary`) before any code: the generators refuse a
   name the glossary of its context does not hold.
4. **Draw the context map** (`/ddd-ts-kit:context-map`): who is upstream, by which pattern.
5. **Bootstrap**: done by `init`. Declare each context with its language and its upstreams,
   upstreams first: `npx ddd-ts-kit generate context <name> --classification <core|supporting|generic> --term "<Term>=<meaning>" --upstream <context>:<pattern>`.
6. **Plan the slices** (`/ddd-ts-kit:plan-slices`): one use case per slice, in
   `docs/architecture/slices.md`.
7. **Build slice by slice** (`/ddd-ts-kit:use-case`): `npx ddd-ts-kit generate ...`, then the
   `TODO(domain)` places it lists (`npx ddd-ts-kit todo <context>`); builders and fakes, no mocks.
8. **Pass the gate** (`/ddd-ts-kit:quality-gate`): `npm run verify` before each merge.
9. **Document** (`/ddd-ts-kit:document`): `npm run docs:generate`, committed with the code.

A step skipped costs later: boundaries drawn from the tables, a glossary written after the
code, a first integration made by a direct import the checker then refuses. The method, step by
step: https://github.com/gbourgeat/ddd-ts-kit/blob/main/docs/guides/methodology.md; the command
for each moment of the project: https://github.com/gbourgeat/ddd-ts-kit/blob/main/docs/guides/commands.md.

| Script | Does |
|---|---|
| `npm run dev` | the application with auto reload |
| `npm test` | domain, application and adapter specs |
| `npm run test:e2e` | the whole application through HTTP, on an in-process database unless `DATABASE_URL` is set |
| `npm run check:arch` | `ddd-ts-kit check` |
| `npm run docs:generate` | context map, OpenAPI, AsyncAPI and event catalog{{#if sdk.on}}, the clients under `clients/`{{/if}} |
| `npm run verify` | everything CI runs |
