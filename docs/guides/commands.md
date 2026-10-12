# Which command, when

**Summary.** The commands of the CLI and the skills of the plugin, by the moment of a project's
life when they are called: what each does, what it leaves behind, and what usually comes next.
The order of the moments is the order of the [methodology](methodology.md), which is the
supported path; this page says how to walk it. The last part is the reference of every command
and flag, generated from the help of the CLI.

Commands are written for npm. On pnpm, `npx ddd-ts-kit` reads `pnpm exec ddd-ts-kit` and
`npm run` reads `pnpm run`. A skill is typed in Claude Code with the plugin installed:
`/ddd-ts-kit:<skill>`; the agent also uses most of them on its own when the situation matches.

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

## Start a project

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:start` | conducts steps 1 to 7 of the method, one per turn, and resumes from the plan | first, before any code; again to resume | `docs/architecture/plan.md` and the artefact of each step | the step its `Next:` line names |
| `/ddd-ts-kit:bootstrap` | chooses the stack by criteria, runs `init`, creates the contexts | step 5, once the context map is drafted | the project and one `CONTEXT.md` per context | `/ddd-ts-kit:plan-slices` |
| `npx ddd-ts-kit init [flags]` | writes the config, the platform, the pipeline, the agent rules | the bootstrap; `--dry-run` first to read what it writes | a project that passes `npm run verify` | `npm install`, `npm run verify` |
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
| `npx ddd-ts-kit generate integration-handler <context> <upstream> <eventType>` | the consumer | in the downstream slice | the handler, its spec, its registration | `npm run docs:generate` |
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
| `npx ddd-ts-kit docs`, `npm run docs:generate` | regenerate the context map, the `CONTEXT.md` lists, the barrels and the contracts | after a change of a route, an event or the config | the generated files, committed with the code | `/ddd-ts-kit:commit-discipline` |
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
| `npx ddd-ts-kit generate worker`, `generate service <context>` | a process for the jobs, or one context run alone | when the jobs or one context must scale apart | `src/apps/<name>/main.ts` | `/ddd-ts-kit:extract-service` |

## Migrate after a kit upgrade

| Command | Does | When | Produces | Then |
|---|---|---|---|---|
| read [CHANGELOG.md](../../CHANGELOG.md) | what changed and what to do | before upgrading | the steps of the version | update the `@ddd-ts-kit/*` and `ddd-ts-kit` versions |
| `npx ddd-ts-kit init --force` | rewrites the files `init` owns, keeps the config and wires the contexts again | after the upgrade | the platform and pipeline files of the new version, and notes | `npm run verify` |
| `npx ddd-ts-kit controllers`, `error-factories --plan` then `--apply` | moves function routes to controllers, error classes to factories | when the project adopts those forms | the rewritten files and the config key | `npx ddd-ts-kit docs`, `npm run verify` |
| `npx ddd-ts-kit depcruise-config --write`, `npx ddd-ts-kit docs` | regenerate what derives from the config | after any change of the config | `.dependency-cruiser.cjs`, the generated documents | `npm run verify` |

## When something is refused

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `npx ddd-ts-kit explain <rule-id>` | the reason of a rule and one example each way | a violation is not clear | the explanation | fix the cause |
| `npx ddd-ts-kit check-file <path>`, `rules` | one file checked; every rule id | after an edit; to look a rule up | violations; the list | fix the cause |
| `generate ... --term "<Term>=<meaning>"` | adds the missing word to the glossary as it generates | the generator refuses a name outside the glossary | the term in `CONTEXT.md` | `/ddd-ts-kit:glossary` if the meaning is unsure |
| `/ddd-ts-kit:deviation`, `npx ddd-ts-kit generate adr "<title>" --deviation <what> --reason "<why>"` | puts the exception to the owner and records it | only when the owner agrees to go around a rule | a decision record and the config entry | `npm run verify` |

## Reference

Every command and flag, as `npx ddd-ts-kit --help` prints them. A test of the CLI fails when a
command or a flag is added without this part being regenerated.

<!-- ddd-ts-kit:commands -->
<!-- Generated from the help of the CLI: `npm run build`, then `node pipeline/monorepo/commands-guide.mjs`. -->

```text
Usage
  ddd-ts-kit init [--http express|fastify|nest|none] [--validation zod|class-validator|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                  [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis] [--audit on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--dependencies signature|listed] [--refusals factories|classes]
                  [--routes controllers|functions] [--tenancy none|shared-table]
                  [--package-manager npm|pnpm] [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                  [--import-extension none|js]
                  [--context <name>:<core|supporting|generic>]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status
  ddd-ts-kit todo [<context>]
  ddd-ts-kit worker-scope <context> [--worktree <path>] [--branch <name>] [--dry-run]
  ddd-ts-kit docs [--check]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit error-factories --plan | --apply [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
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
  error-factories  moves a project from one class per error to static factories on one error class per
                   concept: --plan writes error-factories.plan.json, where each class is given its concept;
                   --apply follows it (classes, specs, every usage, "stack.refusals" in the config)
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, and the TODO(domain), TODO(platform) and it.todo left in each context
  todo             those markers as file:line, in the project or in one context
  worker-scope     a git worktree on the branch build/<context> (by default ../<project>-<context>), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do

Kinds
  context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]...
  aggregate <context> <Name> [--term "<Term>=<meaning>"]...
  builder <context> <Aggregate>
  entity <context> <Name> [--term "<Term>=<meaning>"]...
  value-object <context> <Name> [--term "<Term>=<meaning>"]...   (alias: vo)
  domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...
  error <context> <Concept> <refusal> [--code CODE] [--term "<Term>=<meaning>"]...   (alias: refusal)
  domain-error <context> <Name> [--code CODE]
  domain-service <context> <Name> [--term "<Term>=<meaning>"]...
  repository <context> <Aggregate> [--tenant-scoped]
  command <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...
  query <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--search] [--term "<Term>=<meaning>"]...
  port <context> <Name>
  route <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer]
  controller <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer]
  route-group <context> <Name> [--prefix <path>] [--group <ParentName>] [--public | --role <role>]   (alias: group)
  guard <context> <Name>
  integration-event <context> <Aggregate> <Fact> [--version <n>] [--term "<Term>=<meaning>"]...
  integration-handler <context> <upstreamContext> <eventType>   (alias: consumer)
  event-handler <context> <Aggregate> <Fact> [--phase before-commit|after-commit] [--term "<Term>=<meaning>"]...
  projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...   (alias: projector)
  job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--term "<Term>=<meaning>"]...
  acl <context> <upstreamOrSystemName>
  e2e <context> <UseCaseName>
  policy <context> <Name> --permission <aggregate>.<action>
  gateway <context> <upstreamContext> <Name>
  adapter <context> <Port> [--kind external|gateway] [--decorators]
  service <context>
  worker
  adr "<title>" [--deviation <what>] [--reason "<why>"]
```
<!-- /ddd-ts-kit:commands -->

## See also

- [Methodology](methodology.md): the path, step by step, with what each step leaves and when it is done
- [CLI README](../../packages/cli/README.md): every command in detail
- [Configuration](../CONFIG.md)
