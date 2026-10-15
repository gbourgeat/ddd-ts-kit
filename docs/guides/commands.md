**English** · [Français](commands.fr.md)

# Which command, when

**Summary.** The commands of the CLI and the skills of the plugin, by the moment of a project's
life when they are called: what each does, what it leaves behind, and what usually comes next.
The order of the moments is the order of the [methodology](methodology.md), which is the
supported path; this page says how to walk it. The last part is the reference of every command
and flag, generated from the help of the CLI.

Commands are written for npm. On pnpm, `npx ddd-ts-kit` reads `pnpm exec ddd-ts-kit` and
`npm run` reads `pnpm run`. A skill is typed in Claude Code with the plugin installed:
`/ddd-ts-kit:<skill>`; the agent also uses most of them on its own when the situation matches.

![The six moments of a project in order, start, model the domain, build a slice, before a commit, before a pull request, release and deploy, each with its skills and commands; the next slice loops back to build a slice; connecting two contexts and persistence come inside a slice; a refusal or a kit upgrade can come at any moment](../assets/diagrams/commands-moments.svg)

The sections below follow these moments. Most of the time is spent in the loop from
[Build a slice](#build-a-slice) to [Before a pull request](#before-a-pull-request), one slice
per turn of the loop.

## A first feature, from zero

The realistic sequence for an order-taking service, each line in the order it is typed:

| # | Command | Leaves |
|---|---|---|
| 1 | `/ddd-ts-kit:start We take orders from shops and bill them monthly` | `docs/architecture/plan.md`, then `discovery.md`, `contexts.md`, the glossary and the context map, one step per turn, each closed on your yes |
| 2 | `/ddd-ts-kit:bootstrap` (or `npx ddd-ts-kit init`, `npm install`, `npm run verify`) | the project, green before any business code |
| 3 | `npx ddd-ts-kit generate context ordering --classification core --term "Order=A shop's request to buy products" --term "Place=To submit an order"` | `src/contexts/ordering/` and its `CONTEXT.md` with the glossary |
| 4 | `/ddd-ts-kit:plan-slices` | `docs/architecture/slices.md`: `PlaceOrder` first |
| 5 | `/ddd-ts-kit:use-case PlaceOrder`, which runs `generate aggregate ordering Order`, `generate repository ordering Order`, `generate command ordering PlaceOrder --permission order.place --aggregate Order`, `generate route ordering PlaceOrder --method POST --path /orders`, `generate e2e ordering PlaceOrder` | the files, their specs and fakes, and the `TODO(domain)` places to fill |
| 6 | `npx ddd-ts-kit todo ordering` | what is left to write in the slice, as `file:line` |
| 7 | `npm run db:generate place-order`, `npm run docs:generate` | the migration of the new table, the OpenAPI contract with `POST /orders` |
| 8 | `/ddd-ts-kit:quality-gate`, that is `npm run verify` | a green gate |
| 9 | `/ddd-ts-kit:commit-discipline` | one commit for the slice, generated files with it |
| 10 | `npx ddd-ts-kit status` | the next slice of the plan |

Line 5 is where the generators do the typing. With Drizzle chosen at `init`, the five commands
it runs write these files, each in its layer:

![The files written by generate aggregate, repository, command, route and e2e for the PlaceOrder slice: the routes and the controller in presentation, the permissions, the command and the handler in application, the aggregate and the repository port in domain, the Drizzle repository, the mapper and the schema in infrastructure, the builder, the fake, the contract suite and the specs under test, and the end-to-end spec outside the context](../assets/diagrams/commands-first-slice-files.svg)

None of these files holds business code yet. Most of them hold `TODO(domain)` markers where a
decision is left to you; three come wired and hold none (the route group `orders.routes.ts`, the
permissions `ordering.permissions.ts` and the adapter `drizzle-order.repository.ts`). The
generated specs hold `it.todo` entries. Line 6 lists them, one
line each, in the order of the files:

```text
$ npx ddd-ts-kit todo ordering
src/contexts/ordering/CONTEXT.md:5  TODO(domain)  say in two sentences which business capability this context owns and for whom; the first sentence is reused in the context map.
src/contexts/ordering/application/commands/place-order/place-order.command.ts:7  TODO(domain)  declare the input of "place order" as a constructor with the actor first, then readonly primitives and ids, ...
src/contexts/ordering/application/commands/place-order/place-order.handler.ts:16  TODO(domain)  decide what "place order" does to a Order: ...
src/contexts/ordering/domain/aggregates/order.aggregate.ts:28  TODO(domain)  add one method per business intention (issue, cancel, ...): each guards its invariants, replaces `this.state` and records the event of what happened.
...
src/contexts/ordering/test/unit/order.aggregate.spec.ts:33  it.todo  records the fact of its birth
...
```

The slice is finished when `todo ordering` no longer lists anything of it.

## Start a project

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:start` | conducts steps 1 to 7 of the method, one per turn, and resumes from the plan | first, before any code; again to resume | `docs/architecture/plan.md` and the artefact of each step | the step its `Next:` line names |
| `/ddd-ts-kit:bootstrap` | chooses the stack by criteria, runs `init`, creates the contexts | step 5, once the context map is drafted | the project and one `CONTEXT.md` per context | `/ddd-ts-kit:plan-slices` |
| `npx ddd-ts-kit init [flags]` | writes the config, the platform, the pipeline, the agent rules | the bootstrap; `--dry-run` first to read what it writes | a project that passes `npm run verify` | `npm install`, `npm run verify` |
| `npx ddd-ts-kit init --preset identity`, `generate context <name> --preset identity` | writes a generic context whole instead of an empty one: accounts from the identity provider, organisations, members and roles, invitations, delegations ([why and which](bootstrap-with-well-designed-contexts.md)) | when `contexts.md` holds a generic identity context | the context, its specs, its adapters and its glossary, green at once | read its `## Design`, then the slices of the core |
| `npx ddd-ts-kit status` | the next step of the plan, the slices by status and owner, what is left per context | at the start of every session | a short text, `--json` for data | the step or slice it names |

## Model the domain

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:discover-domain` | a written event storming: actors, commands, events, policies, read models | step 1 | `docs/architecture/discovery.md` | `/ddd-ts-kit:bounded-contexts` |
| `/ddd-ts-kit:bounded-contexts` | finds and classifies the contexts, with the reason of each boundary | step 2 | `docs/architecture/contexts.md` | `/ddd-ts-kit:glossary` |
| `/ddd-ts-kit:glossary` | the ubiquitous language of a context | step 3, and before any new name | `docs/architecture/glossary.md`, then `## Ubiquitous language` of each `CONTEXT.md` | `/ddd-ts-kit:context-map` |
| `/ddd-ts-kit:context-map` | upstream, downstream, pattern and contract of each pair | step 4, and when two contexts start depending on each other | `docs/architecture/context-map.md`, then the upstreams of the config | the bootstrap, or the slice that needs it |
| `npx ddd-ts-kit generate context <name> --classification <c> --term ... --upstream ...` | declares a context with its language and relationships | after the bootstrap, one per row of `contexts.md`, upstreams first | the context directory, its `CONTEXT.md`, the config entry | `npx ddd-ts-kit docs` |
| `npx ddd-ts-kit list`, `describe <context>` | what exists, per context or for one | before planning or changing a context | a map of the contexts, or one as facts (`--json`) | `/ddd-ts-kit:plan-slices` |

## Build a slice

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:plan-slices` | the work as vertical slices, ordered, with their generator commands | step 6, after the bootstrap | `docs/architecture/slices.md` | `/ddd-ts-kit:use-case` |
| `/ddd-ts-kit:use-case <UseCase>` | one slice end to end, test first | for each row of the slices | domain, handler, route and specs, filled | `npm run verify` |
| `npx ddd-ts-kit generate <kind> ...` | one file of a role with its spec, fake and registration (list below) | whenever a file of a role is needed, never by hand | the file and the `TODO(domain)` places, `--json` for the list | fill the places, then `todo` |
| `npx ddd-ts-kit todo [<context>]` | each `TODO(domain)`, `TODO(platform)` and `it.todo` left | before closing a slice | `file:line` entries | write them, then `npm test` |
| `/ddd-ts-kit:parallel-work` | splits the slices between workers, one context each | when several agents or people build at once | a briefing per worker, `npx ddd-ts-kit worker-scope <context>` worktrees | each worker's `use-case` |

## Connect two contexts

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:integration-event` | a versioned event in the producer's published language, its consumer downstream | a context must react to another | the declaration, the outbox publication, an idempotent handler | `npm run docs:generate` |
| `npx ddd-ts-kit generate integration-event <context> <Aggregate> <Fact>` | declares the event | in the upstream slice | `published-language/*.integration-event.ts` and its payload | `generate integration-handler` downstream |
| `npx ddd-ts-kit generate integration-handler <context> <upstream> <eventType>` | the consumer, named after the event, or as the design calls it with `--name <Name>` (the consumer name follows) | in the downstream slice | the handler, its spec, its registration | `npm run docs:generate` |
| `npx ddd-ts-kit generate acl` or `gateway` | an anti-corruption layer, or a synchronous need behind a port | a downstream that must not take the upstream's model | the port and its adapter | the context map note |

## Persistence

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:persistence` | repository port, ORM adapter, mapper, fake, contract suite | a new aggregate, table or read model | the adapter and its specs | `npm run db:generate <what-it-does>` |
| `npx ddd-ts-kit generate repository <context> <Aggregate>` | the port, the in-memory fake and the ORM adapter | with the first slice of an aggregate | the files and the table of the schema to fill | `npm run db:generate <what-it-does>` |
| `npm run db:generate <what-it-does>` | a migration from the schema, named `<timestamp>_<what-it-does>` | after a change of the schema | `migrations/` (`prisma/migrations/` on Prisma) | `npm run db:migrate`, `npm run check:arch` |
| `npm run infra:up`, `npm run db:migrate`, `npm run dev` | the database in Docker, migrated, the application with reload | to see it run | a running API, its documentation on `/docs` | `npm run test:e2e` |

## Before a commit

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `npx ddd-ts-kit check --changed-since <ref>` | the architecture rules on what changed | while iterating | violations with their fix | `npx ddd-ts-kit explain <rule-id>` when one is unclear |
| `npm run regenerate` (`npx ddd-ts-kit depcruise-config --write`, then `npm run docs:generate`, which runs `npx ddd-ts-kit docs`) | regenerate every derived file: `.dependency-cruiser.cjs`, the context map, the `CONTEXT.md` lists, the barrels and the contracts | after a change of a route, a schema, an event or the config | the generated files, committed with the code | `/ddd-ts-kit:commit-discipline` |
| `/ddd-ts-kit:commit-discipline`, `npx ddd-ts-kit check --commit-size --staged` | one slice per commit, its size against the config | before `git commit` (the hook runs the check) | a message `<type>(<context>): ...` | the next slice |

## Before a pull request

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:quality-gate`, `npm run verify` | every gate of the pipeline, fixed at the root cause | before opening the pull or merge request | a green gate | the request |
| `npx ddd-ts-kit affected --base origin/main` | the contexts a change reaches through the context map | in the pipeline; locally to see what it will run | filters for the tests and the linter | the pipeline |
| agent `architecture-reviewer` | a read-only review of the diff against the rules | before merging a slice | findings with file and line | fixes, then merge |

## Release and deploy

| Command | Does | When | Produces | Then |
|---|---|---|---|---|
| `npm run build`, `npm start` | compiles, rewrites the aliases of `dist/`, runs it with plain Node | to ship | `dist/` | the image |
| `docker build .` | the image of the `Dockerfile` that `init` wrote (the pipeline builds it without pushing) | to ship | an image | `npm run db:migrate` against the target database, then the deployment |
| `npx ddd-ts-kit sdk` (or `init --sdk`) | generates the typed client of each document of the contract under `clients/<document>`, wires its scripts, and keeps it current (`docs:generate` runs it, `docs:check` compares it) | when another team, a front end or a test calls the API | one workspace package per document, built by `npm run sdk:build` | `npm publish --workspace clients/<document>` by hand, see [the client SDK](../tools/client-sdk.md) |
| `npx ddd-ts-kit generate worker`, `generate service <context>` | a process for the jobs, or one context run alone | when the jobs or one context must scale apart | `src/apps/<name>/main.ts` | `/ddd-ts-kit:extract-service` |

## Migrate after a kit upgrade

| Command | Does | When | Produces | Then |
|---|---|---|---|---|
| read [CHANGELOG.md](../../CHANGELOG.md), also shipped as `node_modules/ddd-ts-kit/CHANGELOG.md` | what changed and what to do | before upgrading, or when the session start says the plugin describes another version | the steps of the version | update the `@ddd-ts-kit/*` and `ddd-ts-kit` versions together |
| `npx ddd-ts-kit init --force` | rewrites the files `init` owns, keeps the config and wires the contexts again | after the upgrade | the platform and pipeline files of the new version, and notes | `npm run verify` |
| `npx ddd-ts-kit controllers`, `error-factories --plan` then `--apply`, `value-objects` | moves function routes to controllers, error classes to factories, value objects from a `Result` to factories that throw | when the project adopts those forms | the rewritten files and the config key | `npx ddd-ts-kit docs`, `npm run verify` |
| `npm run regenerate` | regenerate what derives from the config | after any change of the config | `.dependency-cruiser.cjs`, the generated documents | `npm run verify` |

## When something is refused

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `npx ddd-ts-kit explain <rule-id>` | the reason of a rule and one example each way | a violation is not clear | the explanation | fix the cause |
| `npx ddd-ts-kit check-file <path>`, `rules` | one file checked; every rule id | after an edit; to look a rule up | violations; the list | fix the cause |
| `generate ... --term "<Term>=<meaning>"` | adds the missing word to the glossary as it generates | the generator refuses a name outside the glossary | the term in `CONTEXT.md` | `/ddd-ts-kit:glossary` if the meaning is unsure |
| `/ddd-ts-kit:deviation`, `npx ddd-ts-kit generate adr "<title>" --deviation <what> --reason "<why>"` | puts the exception to the owner and records it | only when the owner agrees to go around a rule | a decision record and the config entry | `npm run verify` |

Every refusal says what to do next. The generator refuses a name the glossary of the context
does not hold, and writes nothing:

```text
$ npx ddd-ts-kit generate command ordering CancelOrder --permission order.cancel --aggregate Order
error: "CancelOrder" uses "cancel", which the glossary of src/contexts/ordering/CONTEXT.md does not define.
  fix: Either use an existing term (Order, Place), or add the term in the same command: --term "Cancel=<what it means for the business>". The glossary is written before the code (rule language/glossary-term).
```

so the same command, with the meaning of the word, goes through:

```bash
npx ddd-ts-kit generate command ordering CancelOrder --permission order.cancel --aggregate Order \
  --term "Cancel=To withdraw an order before it is shipped"
```

The checker reports a violation with its rule id and a fix sentence. Here, a file of the
`notification` context of the example application imports an aggregate of `scheduling`:

```text
$ npx ddd-ts-kit check-file src/contexts/notification/application/commands/probe.ts
src/contexts/notification/application/commands/probe.ts:1  error  context/published-language-only
  "notification" imports the internals of "scheduling" (src/contexts/scheduling/domain/aggregates/appointment.aggregate.ts).
  fix: Import from src/contexts/scheduling/published-language only; if the type is missing there, publish it with `ddd-ts-kit generate integration-event scheduling <Aggregate> <Fact>` or react to an integration event.

1 error, 0 warnings, 0 suppressions in 1 file.
```

and `explain` gives the reason of the rule, with one example each way:

```text
$ npx ddd-ts-kit explain context/published-language-only
context/published-language-only

A file imports from another context only through that context's published-language/.

Why: A bounded context owns its model and must be free to change it. The published language is the only part designed for others; importing anything else couples two models and turns every refactoring into a cross-team negotiation.

Bad:
    // contexts/shipping/application/...
    import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';

Good:
    // contexts/shipping/application/...
    import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index';

Suppress one line (with a reason): // ddd-ts-kit-disable-next-line context/published-language-only -- <reason>
```

The last line is the suppression the checker accepts; using it is a deviation, which takes the
owner's agreement and a decision record (the last row of the table above).

## Reference

Every command and flag, as `npx ddd-ts-kit --help` prints them. A test of the CLI fails when a
command or a flag is added without this part being regenerated.

<!-- ddd-ts-kit:commands -->
<!-- Generated from the help of the CLI: `npm run build`, then `node pipeline/monorepo/commands-guide.mjs`. -->

```text
Usage
  ddd-ts-kit init [--http express|fastify|hono|nest|none]
                  [--validation zod|class-validator|typebox|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                  [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis] [--http-cache none|varnish]
                  [--storage local|s3|none]
                  [--audit on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--dependencies signature|listed] [--refusals factories|classes]
                  [--routes controllers|functions] [--representations negotiated|json] [--forms on|off]
                  [--value-objects throwing|result] [--literals named|free] [--values classes|free] [--tenancy none|shared-table] [--queue database|redis|memory]
                  [--schemas shared|per-route]
                  [--package-manager npm|pnpm] [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                  [--import-extension none|js] [--sdk]
                  [--context <name>:<core|supporting|generic>]... [--preset identity]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status
  ddd-ts-kit todo [<context>]
  ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--dry-run]
  ddd-ts-kit docs [--check] [--stored-events]
  ddd-ts-kit sdk [--check] [--dry-run]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit drizzle-generate --name <what-it-does> [--custom]
  ddd-ts-kit error-factories --plan | --apply [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
  ddd-ts-kit value-objects [--dry-run]
  ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).

  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  drizzle-generate the db:generate of a Drizzle project: drizzle-kit generate --name, which without a terminal
                   fails and names the fix when drizzle-kit would ask whether a column or table is renamed,
                   where drizzle-kit alone writes nothing and exits 0
  error-factories  moves a project from one class per error to static factories on one error class per
                   concept: --plan writes error-factories.plan.json, where each class is given its concept;
                   --apply follows it (classes, specs, every usage, "stack.refusals" in the config)
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, and the TODO(domain), TODO(platform) and it.todo left in each context
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  worker-scope     a git worktree on the branch build/<context> (by default ../<project>-<context>), cut from
                   --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules; an existing worktree or branch
                   that does not contain the base is refused
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one: run it once the shape of a version is the one to store;
                   docs --check fails while a declared version is not recorded
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do

Kinds
  context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]... [--preset identity]
  aggregate <context> <Name> [--event-sourced] [--term "<Term>=<meaning>"]...
  builder <context> <Aggregate>
  entity <context> <Name> [--term "<Term>=<meaning>"]...
  value-object <context> <Name> [--term "<Term>=<meaning>"]...   (alias: vo)
  vocabulary <context> <Name> --value <value> [--value <value>]...
  state-machine <context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]... [--term "<Term>=<meaning>"]...
  domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...
  error <context> <Concept> <refusal> [--code CODE] [--term "<Term>=<meaning>"]...   (alias: refusal)
  domain-error <context> <Name> [--code CODE]
  domain-service <context> <Name> [--term "<Term>=<meaning>"]...
  repository <context> <Aggregate> [--tenant-scoped]
  command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...
  query <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--search] [--term "<Term>=<meaning>"]...
  port <context> <Name>
  route <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store]
  controller <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store]
  file-upload <context> <UseCaseName> --path <path> (--permission <aggregate>.<action> [--grant <role>] | --public) [--method <POST|PUT>] [--group <Name>]
  route-group <context> <Name> [--prefix <path>] [--group <ParentName>] [--public | --role <role>]   (alias: group)
  guard <context> <Name>
  representation <context> <UseCase> <xml|csv|media/type>[,...]
  form <context> <UseCase>
  schema <context|shared-kernel> <Name>
  integration-event <context> <Aggregate> <Fact> [--version <n>] [--term "<Term>=<meaning>"]...
  integration-handler <context> <upstreamContext> <eventType> [--name <Name>] [--term "<Term>=<meaning>"]...   (alias: consumer)
  event-handler <context> <Aggregate> <Fact> [--phase before-commit|after-commit] [--name <Name>] [--term "<Term>=<meaning>"]...
  projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...   (alias: projector)
  job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--term "<Term>=<meaning>"]...
  background-job <context> <Name> --command <UseCaseName> [--term "<Term>=<meaning>"]...
  process <context> <Name> [--term "<Term>=<meaning>"]...   (alias: process-manager)
  acl <context> <upstreamOrSystemName>
  e2e <context> <UseCaseName>
  policy <context> <Name> --permission <aggregate>.<action>
  gateway <context> <upstreamContext> <Name>
  adapter <context> <Port> [--kind external|gateway] [--decorators]
  service <context>
  worker
  adr "<title>" [--number <n>] [--deviation <what>] [--reason "<why>"]
```
<!-- /ddd-ts-kit:commands -->

## See also

- [Methodology](methodology.md): the path, step by step, with what each step leaves and when it is done
- [CLI README](../../packages/cli/README.md): every command in detail
- [Configuration](../CONFIG.md)
