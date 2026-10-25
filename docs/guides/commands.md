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
| `npx ddd-ts-kit generate module <context> <module> --purpose "..." [--term ...]` | declares a [module of the model](../concepts/modules.md): the config entry, its row of `## Modules` in `CONTEXT.md`, its terms; re-runnable, it adds what is missing | when one context holds clusters of concepts of one language that a reader opens separately; never to hide a second language | the module, declared and documented | `move-to-module`, then `generate ... --module` |
| `npx ddd-ts-kit move-to-module <context> <module> <path>... [--dry-run]` | moves files and folders of `domain/` and `application/` into a declared module, with every import of them in the project | one cluster per commit, until `module/complete` warns no more | the moved files and the rewritten imports | `npm run verify` |

## Build a slice

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:story <code> [<statement>]` | one user story from its questions to a green pull request, in its own worktree: questions first, then specification, rows, design review, acceptance, build, review, report ([story workflow](story-workflow.md)) | once the project is bootstrapped, one terminal per story | the pull request of the story and its report | review the report, validate each provisional decision |
| `npx ddd-ts-kit story-scope <code>` | the worktree of a story on `story/<code>`, its `.ddd-ts-kit/story.json` and its install; the other open stories and their contexts | the first step of the story skill | `.worktrees/<code>` | `npx ddd-ts-kit story <code>` |
| `npx ddd-ts-kit stories` | the stories open in the worktrees of the repository and where two of them meet: the contexts both name, the files both change, what merging one into the other leaves to settle by hand, how far each is behind its trunk | before cutting the rows of a story and before each row, after `git fetch` | a short text, `--json` for data; exits 0 | keep off what another story changes, or record which one lands first |
| `npx ddd-ts-kit worktree <name>` | the worktree of any piece of work that is neither a story nor a worker: `.worktrees/<name>` on `work/<name>` cut from `origin/main`, installed | before writing the code of a context from the main checkout of the trunk, which the guard refuses in a project `init` created | the worktree, its branch and its install | work there, commit, open its pull request |
| `npx ddd-ts-kit story [<code>] [--gate build\|close]` | the phases of a story and the next step; `build` opens its code, `close` its pull request | at any time in the worktree of a story | a short text, `--json` for data; exits 1 while the gate is not met | do the next step |
| `/ddd-ts-kit:plan-slices` | the work as vertical slices, ordered, with their generator commands | step 6, after the bootstrap | `docs/architecture/slices.md` | `/ddd-ts-kit:use-case` |
| `npx ddd-ts-kit cited --rows <id> --base origin/main` | the names the design of a row cites as code that the trunk does not have: removed by its history (with the commit and what replaced them), refused by the canonical tree, or close to a name it gained since the line was written; planned names stay silent | before building a row alone, before committing a design review | one line per name, `--json` for data; exits 0 | build on what the trunk has, and correct the document on the trunk |
| `npx ddd-ts-kit generate acceptance <story>`, then `npx ddd-ts-kit acceptance <story> --lock` | the acceptance spec of a story, one `it.todo` per criterion of `docs/architecture/stories/<story>.md`, to write as scenarios wrapped in `pending(...)`; the lock records them, after which a scenario changes only with its criterion, and a criterion or a scenario whose criteria stayed only with a verdict of the `acceptance-judge` agent | before the first row of code of a story | `test/acceptance/<story>.acceptance.spec.ts` and its `.lock.json` | `npx ddd-ts-kit acceptance <story> --gate written`, then the rows |
| `npx ddd-ts-kit acceptance [<story>] [--gate written\|passing]` | the scenarios of each story against its rows and criteria: left to write, pending, drifted from the lock, inconsistent, and the amendments to validate | before the code of a story (`written`), before closing it (`passing`) | a short text, `--json` for data; exits 1 while the gate is not met | write, lock, build, or report the amendments |
| `/ddd-ts-kit:use-case <UseCase>` | one slice end to end, test first | for each row of the slices | domain, handler, route and specs, filled | `npm run verify` |
| `npx ddd-ts-kit generate <kind> ...` | one file of a role with its spec, fake and registration (list below); `--module <module>` writes into a module of the model, and is required in a context that declares modules | whenever a file of a role is needed, never by hand | the file and the `TODO(domain)` places, `--json` for the list | fill the places, then `todo` |
| `npx ddd-ts-kit todo [<context>]` | each `TODO(domain)`, `TODO(platform)`, `it.todo` and `TODO(review)` left | before closing a slice, a story or a milestone | `file:line` entries | write them, then `npm test`; settle each `TODO(review)` or dismiss it with `generate adr` before the story or milestone is closed |
| `npx ddd-ts-kit story-check <code> [--strict]` | whether a story or a milestone (`M1` for the rows `M1.*`) can close: every row `done`, no marker of its own left, a marker being its own when its text, the commit that wrote it or the worker holding it names one of its rows, or when it belongs to no row in a context no other open story works in | before a story or a milestone is declared closed; `status` names one whose rows are done while markers keep it open | one line when it can close; else each blocker with why it is the story's, its `file:line` and its fix, then the unattributed markers it lists without blocking; exits 0, 1, or 2 on an unknown code | handle each blocker or dismiss it with `generate adr`, then delete the marker; name the row in an unattributed one (`TODO(review): #M1.03 ...`) |
| `npx ddd-ts-kit measures [--since <date>] [--story <code>]` | what the loop of each story cost and left, from git and `docs/architecture/`: design, build and lead time, the requirements changed after the build started, the provisional decisions, the compromises, the review markers settled and the findings repeated across stories, the verification, the stories built at the same time, the origin, the incidents repeated; then the medians of the period; `--by-author` only when the team agreed on it | once a month, by whoever tunes the setup; before a retrospective | one line per story and the medians, `--json` for a dashboard; exits 0 | a repeated remark becomes a line of `AGENTS.md` or a rule of the config; a long design time, a question asked earlier |
| `/ddd-ts-kit:parallel-work` | splits the slices between workers, one context each | when several agents or people build at once | a briefing per worker, `npx ddd-ts-kit worker-scope <context>` worktrees, with the documents of each row's design and the names they cite the trunk does not have | each worker's `use-case` |
| `npx ddd-ts-kit status --workers` | each worker's worktree, branch, context, rows and commits ahead, its state (rows committed, row under way, last verify-slice), the files it changed, and the files two workers change | before briefing a second worker in a context, before each merge | a short text, `--json` for data | other rows for the new worker, the merge order, or `--resume` for a stopped one |
| `npx ddd-ts-kit worker-scope <context> --resume` | where a stopped worker stands (rows by their `Slice:` trailer, files of the row under way, markers, last verify-slice, report, agent), read without changing anything | on a stop notification of a `context-builder` (turn limit, error, a person) | the SendMessage text for its agent, or the briefing of a new one | send it as it is |

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
| `npx ddd-ts-kit verify-slice <context> --since <ref>` | in one run: `npm run regenerate`, the architecture rules on the files changed since the ref (new ones included), the tests of the context, the merges since the ref (as `verify-merge` checks them, reported without failing the slice in this version), the changed files near the 350-line limit | before the commit of a slice, again until it passes | each step with its cause, then the paths of the slice to stage, every other changed path, left out and never staged with it, and the names the slice removes that the design of a row not done still cites (never a failure) | the commit of the slice, of the paths it lists to stage only; those names go to the conductor as notes |
| `npx ddd-ts-kit check --changed-since <ref>` | the architecture rules on what changed | while iterating | violations with their fix, then, with `--explain`, the reason of each rule reported, once | `npx ddd-ts-kit explain <rule-id>` when one is unclear |
| `npm run regenerate` (`npx ddd-ts-kit depcruise-config --write`, then `npm run docs:generate`, which runs `npx ddd-ts-kit docs`) | regenerate every derived file: `.dependency-cruiser.cjs`, the context map, the `CONTEXT.md` lists, the barrels and the contracts | after a change of a route, a schema, an event or the config | the generated files, committed with the code | `/ddd-ts-kit:commit-discipline` |
| `/ddd-ts-kit:commit-discipline`, `npx ddd-ts-kit check --commit-size --staged` | one slice per commit, its size against the config | before `git commit` (the hook runs the check) | a message `<type>(<context>): ...` | the next slice |

## Before a pull request

| Command or skill | Does | When | Produces | Then |
|---|---|---|---|---|
| `/ddd-ts-kit:quality-gate`, `npm run verify` | every gate of the pipeline, fixed at the root cause | before opening the pull or merge request | a green gate | the request |
| `npx ddd-ts-kit merge-trunk` | brings the trunk into the branch as one merge commit computed from the branch's own diff (from where it landed after a squash): derived files, the package.json of each client (at the higher of both versions), generated regions and registries, `slices.md` rows, drizzle meta, the lockfile and the stored-events lock settled, migrations replayed (renamed with `--to-land`), decision records renumbered, regenerate, then `verify-merge` on the result | a worker: to bring the trunk in, never `git merge` alone; the conductor: `--to-land --cwd <worktree>` just before the squash merge | one merge commit with `Merge-Base:`, `Trunk:` and `Landed:` trailers; or a merge in progress with each hunk left, what each side did there, exit 1 | resolve each hunk, `git add`, `merge-trunk --continue` (`--accept-lost` for a removal decided on purpose, `--abort` to undo), then `npm run verify` |
| `npx ddd-ts-kit verify-merge` | what the merges of the branch lost, read from git alone: a line one side added, a row done, a test, a spec file, a migration, a conflict marker | merge-trunk runs it before its commit; after a merge made otherwise, or of a squash with `--theirs <head>`; the pre-push hook (`--warn`) and `verify-slice` run it too, as a warning in this version: a later minor version blocks | the findings of each merge, with `file:line` and the side that held them; nothing without a merge; exit 1 on an error, 0 with `--warn` | restore each one from its side, or record a removal decided on purpose with a `Lost-Accepted: <file:line>` trailer |
| `npx ddd-ts-kit affected --base origin/main` | the contexts a change reaches through the context map | in the pipeline; locally to see what it will run | filters for the tests and the linter | the pipeline |
| agent `architecture-reviewer` | a read-only review of the diff against the rules | before merging a slice | findings with file and line | fixes, then merge |

## Release and deploy

| Command | Does | When | Produces | Then |
|---|---|---|---|---|
| `npm run build`, `npm start` | compiles, rewrites the aliases of `dist/`, runs it with plain Node | to ship | `dist/` | the image |
| `docker build --pull .` | the image of the `Dockerfile` that `init` wrote, on the newest `node` base image rather than the one the machine already holds (the pipeline builds it without pushing) | to ship | an image | `npm run db:migrate` against the target database, then the deployment |
| `npx ddd-ts-kit sdk` (or `init --sdk`) | generates the typed client of each document of the contract under `clients/<document>`, wires its scripts, and keeps it current (`docs:generate` runs it, `docs:check` compares it) | when another team, a front end or a test calls the API | one workspace package per document, built by `npm run sdk:build` | `npm publish --workspace clients/<document>` by hand, see [the client SDK](../tools/client-sdk.md) |
| `npx ddd-ts-kit generate worker`, `generate service <context>` | a process for the jobs, or one context run alone | when the jobs or one context must scale apart | `src/apps/<name>/main.ts` | `/ddd-ts-kit:extract-service` |

## Migrate after a kit upgrade

| Command | Does | When | Produces | Then |
|---|---|---|---|---|
| read [CHANGELOG.md](../../CHANGELOG.md), also shipped as `node_modules/ddd-ts-kit/CHANGELOG.md` | what changed and what to do | before upgrading, or when the session start says the plugin describes another version | the steps of the version | update the `@ddd-ts-kit/*` and `ddd-ts-kit` versions together |
| `npx ddd-ts-kit init --force` | rewrites the files `init` owns, keeps the config, records its version as `initVersion` and wires the contexts again | after the upgrade | the platform and pipeline files of the new version, and notes | `npm run verify` |
| `npx ddd-ts-kit controllers`, `error-factories --plan` then `--apply`, `value-objects` | moves function routes to controllers, error classes to factories, value objects from a `Result` to factories that throw | when the project adopts those forms | the rewritten files and the config key | `npx ddd-ts-kit docs`, `npm run verify` |
| `npx ddd-ts-kit platform-folders [--place <file>=<folder>]... [--dry-run]` | moves the files of `src/platform/` a project generated flat to their folders (`composition/`, `observability/`, `jobs/`, `auth/authentication/`, `auth/authorization/`, the folder of the model, `audit/search-audit-entries/`), with every import of them and the scripts of package.json | when `doctor` reports `folder src/platform: flat`; the generators and `init --force` keep the flat layout until then | the moved files, the rewritten imports, the files of the team it left flat | `npm run format`, `npm run verify` |
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
  "notification" imports the internals of "scheduling" (src/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate.ts).
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
    import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language';

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
                  [--rpc none|orpc|trpc]
                  [--storage local|s3|none]
                  [--audit on|off] [--event-sourcing on|off] [--privacy on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--dependencies signature|listed] [--refusals named|factories|classes]
                  [--routes controllers|functions] [--representations negotiated|json] [--forms on|off]
                  [--value-objects throwing|result] [--literals named|free] [--values classes|free] [--tenancy none|shared-table] [--queue database|redis|memory]
                  [--schemas shared|per-route]
                  [--package-manager npm|pnpm] [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                  [--import-extension none|js] [--sdk] [--agent-profile regulated|none]
                  [--context <name>:<core|supporting|generic>]... [--preset identity]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--module <module>] [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status [--workers]
  ddd-ts-kit doctor [--strict]
  ddd-ts-kit todo [<context>]
  ddd-ts-kit plan-waves [<context>]
  ddd-ts-kit story-check <code> [--strict]
  ddd-ts-kit acceptance [<story>] [--gate written|passing] [--lock]
  ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit worker-scope <context> --resume [--worktree <path> | --branch <name>] [--fresh]
  ddd-ts-kit worker-scope <context> --here [--rows <id,...>] [--base <ref>] [--dry-run]
  ddd-ts-kit story-scope <story> [--from <file>] [--kind story|fix] [--base <ref>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit story [<story>] [--gate build|close]
  ddd-ts-kit stories
  ddd-ts-kit measures [--since <date>] [--story <code>] [--by-author] [--format text|json]
  ddd-ts-kit mutation [--report <file>] [--survivors] [--changed <ref>] [--json]
  ddd-ts-kit worktree <name> [--base <ref>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit verify-slice <context> --since <git-ref>
  ddd-ts-kit cited [<context>] [--rows <id,...>] [--base <ref>] [--removed-since <ref>]
  ddd-ts-kit verify-merge [<commit>] [--since <git-ref>] [--theirs <git-ref>] [--base <commit>] [--warn]
  ddd-ts-kit merge-trunk [--trunk <git-ref>] [--since <commit>] [--to-land] [--dry-run]
  ddd-ts-kit merge-trunk --continue [--accept-lost] | --abort
  ddd-ts-kit docs [--check] [--stored-events] [--behaviour]
  ddd-ts-kit sdk [--check] [--dry-run]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit drizzle-generate --name <what-it-does> [--custom]
  ddd-ts-kit drizzle-generate --replay [--base <git-ref>]
  ddd-ts-kit error-factories --plan | --apply [--to named|factories] [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
  ddd-ts-kit value-objects [--dry-run]
  ddd-ts-kit platform-folders [--place <file>=<folder>]... [--dry-run]
  ddd-ts-kit move-to-module <context> <module> <path>... [--dry-run]
  ddd-ts-kit context-layout [<context>...] [--dry-run]
  ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
  ddd-ts-kit affected --base <git-ref> --run <script>
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--explain] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit lint [paths...] [--format <eslint formatter>] [--fix] [--no-cache]
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).

  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base;
                   --run <script> runs that script of the project on them (DDD_TS_KIT_AFFECTED set,
                   --passWithNoTests on a partial run) and nothing when nothing that runs changed:
                   the pre-push hook tests the contexts its branch reaches
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  drizzle-generate the db:generate of a Drizzle project: drizzle-kit generate --name, which without a terminal
                   fails and names the fix when drizzle-kit would ask whether a column or table is renamed,
                   where drizzle-kit alone writes nothing and exits 0; then formats the snapshot and the
                   journal it wrote with the Biome or Prettier of the format script, and warns when the
                   SQL changes a primary key in an order that fails on PostgreSQL (exit code unchanged);
                   --replay, after merging the trunk into a branch when both added migrations: when the
                   history forks from --base <ref> (origin/main by default), deletes the migrations of the
                   branch the base does not have, with their snapshots and journal entries, then generates
                   each again on top, in order, under its name (working- dropped outside a worker's
                   worktree, a custom one keeping its SQL); when it does not fork, only renames them;
                   refused while the journal holds conflict markers, when two of them change the schema,
                   or when drizzle-kit now writes a generated one otherwise (edited by hand), the folder
                   then put back as it was
  error-factories  moves the refusals of a project to one class per refusal (--to named, the default), from
                   one class per error or from the factories of one error class per concept: --plan writes
                   error-factories.plan.json, where each refusal is given a class (the PascalCase of its
                   code, which it keeps) and a factory (for<Concept>), both editable; --apply follows it
                   (codes.ts per context, one class file per refusal, specs, every usage, the concept
                   classes left empty, "stack.refusals" in the config) and lists what it cannot rewrite
                   (a bare <Concept>Error.is(error), CodeOf<typeof <Concept>Error>); --to factories moves
                   one class per error to static factories on one error class per concept instead
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  platform-folders takes the files of the platform a project generated flat to their folders:
                   composition/, observability/ (tracing.ts first), jobs/, auth/authentication/ (who is
                   calling), auth/authorization/ (what they may do, whatever the model), the folder of
                   the model (auth/roles/, attributes/, relationships/, custom/) and
                   audit/search-audit-entries/; every import of them under the source root, test/ and
                   scripts/ follows, and the scripts of package.json; a file the kit did not write at
                   the root of the platform or of auth/ stays where it is, named, unless --place
                   <file>=<folder> (both from the platform) gives it its folder; the generators and
                   init --force keep either layout until then
  move-to-module   takes files of a context into a module of its model, declared first with generate module,
                   each to <module>/<layer>/ and each spec to test/<unit|integration>/<module>/: each <path>
                   is a file or a folder of a role or a spec, relative to the context
                   (domain/aggregates/waitlist.aggregate.ts, application/commands/join-waitlist,
                   infrastructure/persistence/knex-waitlist.repository.ts); the specs named after a moved
                   file follow it, every import of them under the source root, test/ and scripts/ follows,
                   and the generated declarations are rewritten; what the modules share stays at the level
                   of the context: the code list and the permission set at its root, the schema of its
                   database, its route groups, guards and shared shapes, its fakes, builders and worlds
  context-layout   takes the files of the contexts, or of the ones named, that 0.86 or 0.87 wrote elsewhere to
                   their place of today: domain/errors/codes.ts to <context>.codes.ts and
                   application/authorization/<context>.permissions.ts to <context>.permissions.ts, at the
                   root of the context, and each module of the model from domain/<module>/ and
                   application/<module>/ to <module>/domain/ and <module>/application/, with the adapters,
                   routes and specs it tells by their imports (a spec by the file it is named after); what
                   names no module, or two, is listed and stays; every import of them under the source
                   root, test/ and scripts/ follows, what derives from the tree is written again
                   (.dependency-cruiser.cjs, the declarations) and knip is told of the code lists where they
                   are; the generators keep the code lists and permission sets where they are until then
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  doctor           what an upgrade left to do: the scripts, the packages of the kit (at the ranges of this
                   version) and the agent permissions this version writes that the project lacks or writes
                   otherwise, and the git hooks (the lefthook: line of lefthook.yml, the pre-commit hook of
                   lefthook in this clone); init adds what is missing, hooks:install the hook; then what
                   this checkout lacks to run the project, read without network: the running Node against
                   engines.node and .nvmrc, node_modules installed since the lockfile last changed, each
                   package of the kit installed at the version of this CLI, the submodules initialised;
                   last, the overrides init writes under a dependency that pins a package below a
                   security fix, missing or no longer needed once it asks for the fix itself;
                   each with its fix; --strict exits 1 while something is missing or the checkout cannot
                   run the project, never for a hook this clone has not installed, a Node .nvmrc does not
                   name, a lockfile changed since the install or an override no longer needed
  lint             the ESLint of the project (lint and ci:lint run it): fails on an error, and on a warning
                   as on an error, but on one of a rule of the kit in transition, a new rule that becomes an
                   error in the version it names, whose warnings are listed apart; --format and --fix as ESLint
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, each row not done ready on the trunk (its dependencies done), ready
                   on a branch (the others briefed to a worker with commits ahead of its base) or waiting
                   (with the ids it waits for), a row that landed with a worker's branch but is not marked done,
                   and the TODO(domain), TODO(platform), it.todo and TODO(review) left in each context, and
                   each story or milestone whose rows are all done while markers of its own keep it open (see
                   story-check, whose git blame it runs on those markers only); --workers shows instead each
                   worktree holding .ddd-ts-kit/worker.json (branch, context, rows, base, commits ahead and
                   files changed counted from where its branch landed on the base when it was squash-merged
                   there (else from the merge base), commits behind, the commit it landed as, what merge-trunk
                   would leave conflicted now, dependencies not installed, its report), a state line (rows
                   committed, the row under way, files uncommitted, markers, last verify-slice, and the
                   worker-scope --resume command of a stopped one), then the contexts and the files more than
                   one worker holds
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  mutation         the mutation score of the domain and application layers of each context, read from the
                   json report the last stryker run wrote (reports/mutation/mutation.json, or --report
                   <file>), each held to its "mutation" floor of the config (80 and 75 by default): detected over detected and
                   undetected, the errors left out, as Stryker counts, the ignored mutants (the texts of
                   refusals, the code that runs once when the module loads) shown beside, since the
                   score says nothing about them; exits 1 while a layer is under its floor, 2 without
                   a report. --survivors lists the mutants no test noticed (file:line, mutator, what the
                   code became), each a decision: a test named after the rule, or left alive and said so;
                   --changed <ref>, or DDD_TS_KIT_MUTATION_SINCE in the environment as the job of a pull
                   request sets it, lists those of the files changed since the git ref alone and exits 0
                   whatever the scores, a reading for a change in progress. Runs no test: npm run
                   test:mutation runs Stryker, then this; the pipeline runs it every night and, with
                   the variable set to the merge base of the change, on a pull request
  plan-waves       the rows of slices.md not done, of the project or of one context, in waves (wave 1: every
                   dependency done; wave n: the others in earlier waves), each wave cut into batches of one
                   owner, one or two rows on one aggregate, with the worker-scope command that briefs each,
                   the batches of a wave likely to touch the same files (same aggregate in Start with, or
                   unknown when it names none), each row a row waits for with its status (and its context
                   and story when it is of another story or outside the context shown), the rows of other
                   stories the planned rows wait for, not done, in a section of their own, the merge order
                   and what runs before each merge (merge-trunk --to-land); a cycle, a dependency on an
                   unknown id or a row without owner is reported alone, and exits 1
  story-check      whether a story or a milestone can close, <code> being the start of the ids of its rows
                   (M1 for M1.01, M1.02: the id without its last .<number>): every row of it done in
                   slices.md (the others listed with their status), and no marker of its own left
                   (TODO(domain), TODO(platform), it.todo, TODO(review)). A marker is attributed to
                   rows: those its text names (#M1.03 or M1.03, word-bounded), else those of the commit
                   that wrote its line (git blame, once per file; its Slice: trailer, else the row ids
                   its message names), else, not committed, those of .ddd-ts-kit/worker.json in a
                   worker's worktree. It is the story's own when it belongs to one of its rows,
                   wherever it is; a marker of a context of its rows that belongs to no row is its own
                   when no other open story has a row in that context, and is listed without blocking
                   otherwise (settle it or name its row in it); a marker of other stories' rows does not
                   block. --strict: every marker of its contexts blocks. Each blocker comes with why it
                   is its own, its file:line and its fix: handle it, or dismiss it by a decision record
                   (generate adr), then delete the marker. A done row also holds to its design: every
                   name the ## #<id> section of docs/architecture/reviews/<code>.md cites (a path, a
                   PascalCase name, a Class.member, as cited reads them) exists in the tree, or is
                   listed under ### Compromises of ## Report in the story file; a name that is neither
                   blocks, with its file:line in the review. A commit of the story on the current branch
                   (its Slice: trailer, else its message naming a row or the story) that changes a
                   migration or a container file (the paths the change-reference hook of the regulated
                   profile watches) without a Change: <id> trailer is listed, with its files, and blocks
                   under agents.profile regulated or with --strict. Reads only: exits 0 when it can
                   close, 1 listing what keeps it open, 2 on a code no row carries or without slices.md
  acceptance       the acceptance scenarios of each story (test/acceptance/<story>.acceptance.spec.ts) against
                   its rows in slices.md and the criteria of docs/architecture/stories/<story>.md: the rows and
                   criteria each scenario names (#US5.02 AC1 in its title), the scenarios left to write
                   (it.todo), those wrapped in pending(...) of @ddd-ts-kit/testing/e2e until their code is
                   built, and what is inconsistent (no row, an unknown row or criterion, a scenario skipped,
                   a pending one whose rows are done, a locked one changed while its criteria were not);
                   --gate written: every slice row and criterion has a written scenario, none is left to
                   write, the acceptance is locked (before the code of the story); --gate passing: none is
                   pending either (before the story closes); exits 1 while a gate is not met, or, without
                   one, on an inconsistency. Never runs a test. --lock writes
                   test/acceptance/<story>.acceptance.lock.json, the fingerprint of each criterion and of
                   each scenario (pending(...), layout and comments aside), refused while a scenario is
                   left to write, or while a criterion changed, or a locked scenario changed while its
                   criteria did not, without a verdict "amend" of the acceptance-judge agent on that very
                   version (test/acceptance/verdicts/*.md, lines Story:, Subject:, Fingerprint:,
                   Verdict:, Reason:); a refusal wins; the verdicts become amendments of the lock,
                   listed for the owner to validate. A fix is a story file with a ## Regression section
                   listing the spec files that prove it (- test/unit/<name>.spec.ts): held to the tests of
                   those files instead of rows and scenarios, locked and judged the same way, the statement
                   of the fix being the criterion
  worker-scope     a git worktree on the branch build/<context> (by default .worktrees/<context>, see worktree),
                   cut from --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules, the documents of their design and
                   the names that design cites the base does not have (see cited), and by default the first
                   batch plan-waves cuts for the context (one or two rows on one aggregate), a note naming the
                   next; a worktree it creates gets the clean install of the package manager (npm ci), its
                   time in the notes, unless --no-install; an existing worktree or branch that does not
                   contain the base is refused, with the merge-trunk that brings it in
  --here           worker-scope in the worktree of a story (.ddd-ts-kit/story.json): writes the scope of the
                   next agent in place, its base the base of the story, and prints its briefing; no
                   worktree, branch or install of its own; the agents of a story run one after the other
  story-scope      the worktree of one story, .worktrees/<story> on story/<story> cut from --base (by default
                   origin/main from the trunk, else the current branch, refused from the worktree of a
                   story), its .ddd-ts-kit/story.json ({ story, base, baseCommit, branch, kind, from }) and
                   its clean install; an existing one is kept and the story resumes there; refused when the
                   story is open in another worktree; names the other open stories and the contexts their
                   rows change; --kind story (the default) or fix (a story built behind locked regression
                   specs, listed under ## Regression of its file); --from <file> records where the story
                   comes from, an intent of docs/architecture/intents/ (refused unless its header says
                   Status: accepted) or an incident record of docs/architecture/incidents/, and the Next:
                   line says that the story skill seeds the statement from it while the story file does
                   not exist
  worktree         the worktree of any other piece of work, .worktrees/<name> on work/<name> cut from --base
                   (by default origin/main from the trunk, else the current branch), and its clean install
                   unless --no-install; an existing one is kept; .worktrees/ lies in the main checkout,
                   whichever worktree it runs from, ignored by git and by the tools of the project; while
                   the .gitignore of a project started before does not hold it (init adds it), a worktree
                   opens next to the project, ../<project>-<name>; in a project whose config says
                   "worktrees": "required" (what init writes), the guard of the plugin refuses the code of
                   a context in the main checkout of the trunk, and in a worktree of .worktrees/ without
                   its own node_modules
  story            where a story stands, phase by phase: its specification and criteria
                   (docs/architecture/stories/<story>.md), its rows in slices.md, a design review section
                   per row not done (docs/architecture/reviews/<story>.md, ## #<id>), its acceptance written
                   and locked, its rows done, its acceptance passing, its trunk merged in, its ## Origin
                   (From: and Built with:), its ## Report with ### Verification naming npm run verify; and
                   the next step; in the worktree of a story, the story is its own; --gate build exits 1
                   until the first four are met (the code may start: the guard of the plugin opens the
                   contexts), --gate close until all are
  stories          the stories open in the worktrees of the repository and where two of them meet: the
                   contexts the rows of both name, the files both worktrees change (committed or not), what
                   merging the branch of one into the other leaves to a person and what merge-trunk settles
                   (git merge-tree, nothing written); how far each is behind its base; from the worktree of a
                   story, the stories it meets; the guard of the plugin says it at session start and on a
                   write to a file another story changes
  --resume         worker-scope reads where the stopped worker of the context stands (its rows by their
                   Slice: trailer, the files of the row under way, the markers, its last verify-slice, its
                   report, its agent as the guard recorded it) and prints the message that resumes its agent
                   (SendMessage) or the briefing of a new one; creates and rewrites nothing; --fresh asks for
                   a new agent whatever the last one did; several worktrees of the context need --worktree
  verify-slice     closes a slice before its commit, in one run: the regenerate script, check on the files
                   changed since --since (new ones included), the test script for the context; then the
                   changed files past 300 of the 350 lines, the paths of the slice to stage (its context, an
                   end-to-end spec, a working migration, the derived files git tracks) and every other
                   changed path, left out and never to stage with it; the merges since --since, as
                   verify-merge checks them, reported without failing the slice in this version (a later
                   minor version fails it); exits 1 while a step fails; then the names the slice removes
                   that the design of a row not done still cites (never a failure); in the worktree of a
                   worker, the commit command with the trailer Slice: <row>, and
                   .ddd-ts-kit/verification.json for the conductor
  cited            the names the design of rows not done cites as code (paths, classes, Class.member) that
                   the code does not have: those the history of --base removed (with the commit and the
                   successor), the places the canonical tree refuses, and a name never there whose close
                   name of the same part arrived after the line was written; planned names stay silent.
                   The design of a row: its cells and rule lines in slices.md, a section of a document of
                   docs/architecture whose heading names it, a document that names it or that its rule
                   line links to. Default: every row not done, of the context when given, at the current
                   branch. --removed-since <ref>: the names a change removes, from the merge base to the
                   working tree, that such a design cites. Reads only, exits 0
  verify-merge     what the merges of a branch lost, read from git only: every merge commit since --since
                   (by default the base of .ddd-ts-kit/worker.json, then origin/HEAD, then origin/main) and
                   the merge in progress (its result: the index and the working tree), or one <commit>; a
                   squash commit takes --theirs <head of the branch it took in>. Errors: a line one side
                   added or both kept missing from the result (whitespace, a line laid out again, a move
                   to another file and imports merged into one statement aside), a file neither side
                   deleted gone from the result, a row of slices.md done on one side and no longer done or
                   gone, a test title or a spec file of one side gone, a migration of one side whose
                   description (name without number and working-) the result lacks, a conflict marker;
                   warnings: a line one side removed brought back, a line one side wrote where the other
                   changed the same lines or deleted the file (the merge chose), a line the merge replaced
                   by lines of its own. Derived files, files a tool says it wrote, migrations, lockfiles
                   and slices.md are left out of the lines. The base is --base, else the Merge-Base:
                   trailer of the merge, else git merge-base; entries of a Lost-Accepted: <file:line>,...
                   trailer are listed and never fail, nor what a later commit restored; silent and exit 0
                   without a merge, exit 1 on an error; --warn prints the same and exits 0, as the
                   pre-push hook of init runs it in this version (a later minor version blocks the push)
  merge-trunk      brings the trunk (--trunk, by default origin/HEAD then origin/main, never fetched) into the
                   branch as one merge commit computed from the branch's own diff: from the newest commit of
                   the branch the trunk holds (--since; else the commit whose patch, derived files,
                   migrations, slices.md, plan.md and lockfiles left out, is one commit of the trunk, on this
                   branch or a branch it shares commits with; else the base recorded for the worker when its
                   lines are on the trunk; else git merge-base). Settles derived files and drizzle-kit meta
                   (trunk side), the package.json of a client (trunk side, at the higher of both versions;
                   left to you when one is not a semantic version), generated regions of CONTEXT.md and the
                   context map (trunk side), conflicts inside generated registries (lines of both sides),
                   slices.md row by row (the furthest status), the stored-events lock by key, the lockfile
                   (trunk side, installed again when the branch changed package.json); the rest is left in a
                   merge in progress git understands, with what each side did (exit 1). Then, or on
                   --continue: the drizzle migrations of both sides replayed, on --to-land the working
                   migrations renamed (knex, Prisma, TypeORM; stop when both sides change one table), decision
                   records renumbered, regenerate, verify-merge on the uncommitted result (an error stops;
                   --accept-lost records a Lost-Accepted: trailer), and the commit of the merge's paths only,
                   with the trailers Merge-Base:, Trunk: and Landed:; any other changed path blocks it.
                   --dry-run previews, --abort undoes; refused (exit 2) on a dirty tree, another operation in
                   progress, no committer known to git, an unknown trunk, or a git older than 2.40 with a base
                   git would not compute
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --explain        check follows the violations with the reason of each rule they report, once per rule, as
                   explain gives it without its examples ("explanations" in JSON); with github and gitlab, each
                   annotation carries the reason of its rule, a pull request showing an annotation on its own
  --behaviour      docs writes the pages of what the tests state (docs/behaviour/) alone, every other generated
                   document left as it is: what the pre-commit hook runs when a spec is staged; with --check,
                   those pages alone are compared
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one but one recorded by 0.82.0 or earlier, recorded again as
                   the kit reads it now: run it once the shape of a version is the one to store; docs --check
                   fails while a declared version is not recorded, or recorded by 0.82.0 or earlier
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do
  --module         generate writes the files of the layers into that module of the model of the context
                   (declared first with generate module), <module>/domain/ to <module>/presentation/, and
                   their specs into test/unit/<module>/, finds the files it reads in the module that holds
                   them and writes the imports to where they are; required in a context that declares
                   modules, what the modules share staying at the level of the context

Kinds
  context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]... [--preset identity]
  module <context> <module> [--purpose "<what it holds>"] [--classification <core|supporting|generic>] [--term "<Term>=<meaning>"]...
  aggregate <context> <Name> [--event-sourced] [--term "<Term>=<meaning>"]...
  builder <context> <Aggregate>
  test-world <context> [Name]
  entity <context> <Name> [--term "<Term>=<meaning>"]...
  value-object <context> <Name> [--term "<Term>=<meaning>"]...   (alias: vo)
  property <context> <ValueObject>
  vocabulary <context> <Name> --value <value> [--value <value>]...
  state-machine <context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]... [--term "<Term>=<meaning>"]...
  domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...
  error <context> <Refusal> <factory> [--code CODE] [--term "<Term>=<meaning>"]...   (alias: refusal)
  domain-error <context> <Name> [--code CODE]
  domain-service <context> <Name> [--term "<Term>=<meaning>"]...
  repository <context> <Aggregate> [--tenant-scoped] [--personal <column>,<column>... [--subject <column>] [--erasure pseudonymise|row] [--retention <column>:<n><d|m|y>]]
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
  erasure-handler <context>
  event-handler <context> <Aggregate> <Fact> [--phase before-commit|after-commit] [--name <Name>] [--term "<Term>=<meaning>"]...
  projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...   (alias: projector)
  job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--term "<Term>=<meaning>"]...
  background-job <context> <Name> --command <UseCaseName> [--term "<Term>=<meaning>"]...
  process <context> <Name> [--term "<Term>=<meaning>"]...   (alias: process-manager)
  acl <context> <upstreamOrSystemName>
  e2e <context> <UseCaseName> [--event <eventType>]
  acceptance <story> ["<title>"]
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
