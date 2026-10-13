# Generator kinds

`npx ddd-ts-kit generate <kind> ... --json`. Common options: `--term "<Term>=<meaning>"`
(repeatable), `--local-only`, `--dry-run`, `--force`. The authoritative list is
`npx ddd-ts-kit --help`; `npx ddd-ts-kit generate --help --json` gives it as data, with the
shared files each kind writes (`writesShared`, `shared`, `sharedWhen`).

| Kind | Arguments | Lands in |
|---|---|---|
| `context` | `<name> --classification <core\|supporting\|generic> [--purpose "<two sentences>"] [--upstream <ctx>[:pattern]]...` | `contexts/<name>/`: `CONTEXT.md`, published language, barrel (or module file), route list; config, composition root, context map |
| `aggregate` | `<ctx> <Name> [--event-sourced]` | `domain/aggregates/`, builder, spec; event-sourced: its birth event `<Name>Created` and apply method, the codec `infrastructure/persistence/<name>-events.mapper.ts`, a builder that replays a history |
| `entity` | `<ctx> <Name>` | `domain/entities/`, spec |
| `value-object` (`vo`) | `<ctx> <Name>` | `domain/value-objects/`, spec |
| `domain-event` | `<ctx> <Aggregate> <Fact>` | `domain/events/`, named `<ctx>.<aggregate>.<fact>`, spec; of an event-sourced aggregate, also the union, `appliers()` with an empty apply method, and the codec entry |
| `error` (`refusal`) | `<ctx> <Concept> <refusal> [--code CODE]` | a static factory on `domain/errors/<concept>.error.ts`, the error class of the concept (created when absent), and its spec case; run again, nothing changes |
| `domain-error` | `<ctx> <Name> [--code CODE]` | one class per error in `domain/errors/`, spec: only in a project whose config says `"stack.refusals": "classes"` or nothing |
| `domain-service` | `<ctx> <Name>` | `domain/services/`, spec |
| `repository` | `<ctx> <Aggregate> [--tenant-scoped]` | port in `domain/repositories/`, adapter and mapper in `infrastructure/persistence/`, fake, contract suite |
| `command` | `<ctx> <UseCase> (--permission <aggregate>.<action> \| --public) [--aggregate <Name>]` | `application/commands/<use-case>/`, handler spec |
| `query` | `<ctx> <UseCase> (--permission <aggregate>.<action> \| --public) [--search]` | `application/queries/<use-case>/`, read port, in-memory reader, fake, spec |
| `port` | `<ctx> <Name>` | `application/ports/<name>.port.ts`, fake |
| `adapter` | `<ctx> <Port> [--kind external\|gateway] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts`, spec |
| `gateway` | `<ctx> <upstream> <Name>` | read contract in the upstream's published language, port, in-process adapter, fake, contract suite |
| `policy` | `<ctx> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec |
| `route` | `<ctx> <UseCase> --method <M> --path <p> [--command\|--query]` | `presentation/http/`, spec |
| `schema` | `<ctx\|shared-kernel> <Name>` | `presentation/http/shared/<name>.schema.ts` of the context, or `presentation/<name>.schema.ts` of the shared kernel: one shape declared once, shared by the routes that use it |
| `event-handler` | `<ctx> <Aggregate> <Fact> [--phase after-commit]` | `application/event-handlers/`, spec; default phase `before-commit` |
| `projection` (`projector`) | `<ctx> <Name> <event-type>` | `application/projections/<name>.projection.ts` with `@Projection('<ctx>.<name>')` and one `@On` method for the event (of the context itself or of a declared upstream), spec; declared style only |
| `job` | `<ctx> <Name> (--every <duration> \| --cron "<expression>" [--time-zone <zone>]) --command <UseCase>` | `application/scheduling/<name>.job.ts`, spec |
| `integration-event` | `<ctx> <Aggregate> <Fact> [--version <n>]` | declaration in `published-language/`, publisher, spec |
| `integration-handler` (`consumer`) | `<ctx> <upstream> <event-type>` | `application/integration/handlers/<name>.integration-handler.ts`, consumer `<ctx>.<name>`, spec |
| `acl` | `<ctx> <upstream-or-system>` | `infrastructure/anti-corruption/<name>.translator.ts`, spec |
| `builder` | `<ctx> <Aggregate>` | `test/builders/` |
| `e2e` | `<ctx> <UseCase>` | `test/e2e/<use-case>.e2e.spec.ts` (needs the route) |
| `service` | `<ctx>` | `src/apps/<ctx>/main.ts`: the context run alone, a start script, a compose service |
| `worker` | | `src/apps/worker/main.ts`: a process for the scheduled jobs, a start script, a compose service |
| `adr` | `"<title>" [--deviation <what>] [--reason "<why>"]` | `docs/adr/NNNN-<slug>.md` |

Output of every kind: `{ dryRun, created, updated, skipped, next, todos, notes }`. `next` is
the list of `TODO(domain)` places as `file:line`, the glossary first; `todos` adds their text.
