# Generator kinds

`npx ddd-ts-kit generate <kind> ... --json`. Common options: `--term "<Term>=<meaning>"`
(repeatable), `--local-only`, `--dry-run`, `--force`. The authoritative list is
`npx ddd-ts-kit --help`; `npx ddd-ts-kit generate --help --json` gives it as data, with the
shared files each kind writes (`writesShared`, `shared`, `sharedWhen`).

| Kind | Arguments | Lands in |
|---|---|---|
| `context` | `<name> --classification <core\|supporting\|generic> [--purpose "<two sentences>"] [--upstream <ctx>[:pattern]]...` | `contexts/<name>/`: `CONTEXT.md`, published language, barrel (or module file), route list; config, composition root, context map |
| `aggregate` | `<ctx> <Name>` | `domain/aggregates/`, builder, spec |
| `entity` | `<ctx> <Name>` | `domain/entities/`, spec |
| `value-object` (`vo`) | `<ctx> <Name>` | `domain/value-objects/`, spec |
| `domain-event` | `<ctx> <Aggregate> <Fact>` | `domain/events/`, named `<ctx>.<aggregate>.<fact>`, spec |
| `domain-error` | `<ctx> <Name> [--code CODE]` | `domain/errors/`, spec |
| `domain-service` | `<ctx> <Name>` | `domain/services/`, spec |
| `repository` | `<ctx> <Aggregate> [--tenant-scoped]` | port in `domain/repositories/`, adapter and mapper in `infrastructure/persistence/`, fake, contract suite |
| `command` | `<ctx> <UseCase> (--permission <aggregate>.<action> \| --public) [--aggregate <Name>]` | `application/commands/<use-case>/`, handler spec |
| `query` | `<ctx> <UseCase> (--permission <aggregate>.<action> \| --public) [--list]` | `application/queries/<use-case>/`, read port, in-memory reader, fake, spec |
| `port` | `<ctx> <Name>` | `application/ports/<name>.port.ts`, fake |
| `adapter` | `<ctx> <Port> [--kind external\|gateway] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts`, spec |
| `gateway` | `<ctx> <upstream> <Name>` | read contract in the upstream's published language, port, in-process adapter, fake, contract suite |
| `policy` | `<ctx> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec |
| `route` | `<ctx> <UseCase> --method <M> --path <p> [--command\|--query]` | `presentation/http/`, spec |
| `event-handler` | `<ctx> <Aggregate> <Fact>` | `application/event-handlers/`, spec |
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
