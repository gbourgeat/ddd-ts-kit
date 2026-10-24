# Generator kinds

`npx ddd-ts-kit generate <kind> ... --json`. Common options: `--term "<Term>=<meaning>"`
(repeatable), `--module <module>` (required in a context that declares modules of the model:
the files of each layer land in `<module>/domain/`, `<module>/application/`,
`<module>/infrastructure/` and `<module>/presentation/`, their specs in `test/unit/<module>/`), `--local-only`, `--dry-run`, `--force`. The authoritative list is
`npx ddd-ts-kit --help`; `npx ddd-ts-kit generate --help --json` gives it as data, with the
shared files each kind writes (`writesShared`, `shared`, `sharedWhen`).

| Kind | Arguments | Lands in |
|---|---|---|
| `context` | `<name> --classification <core\|supporting\|generic> [--purpose "<two sentences>"] [--upstream <ctx>[:pattern]]...` | `contexts/<name>/`: `CONTEXT.md`, published language, barrel (or module file), route list; config, composition root, context map |
| `module` | `<ctx> <module> [--purpose "<one sentence>"] [--classification <core\|supporting\|generic>]` | `contexts.<ctx>.modules` of the config, its row of `## Modules` in `CONTEXT.md`, the `--term` rows of the glossary; run again, it adds what is missing. Existing files move with `npx ddd-ts-kit move-to-module <ctx> <module> <path>...` |
| `aggregate` | `<ctx> <Name> [--event-sourced]` | `domain/aggregates/`, builder, spec; event-sourced: its birth event `<Name>Created` and apply method, the codec `infrastructure/persistence/<name>-events.mapper.ts`, a builder that replays a history; needs `stack.eventSourcing` on (`init --force --event-sourcing on`), refused otherwise |
| `entity` | `<ctx> <Name>` | `domain/entities/`, spec |
| `value-object` (`vo`) | `<ctx> <Name>` | `domain/value-objects/`, spec |
| `domain-event` | `<ctx> <Aggregate> <Fact>` | `domain/events/`, named `<ctx>.<aggregate>.<fact>`, spec; of an event-sourced aggregate, also the union, `appliers()` with an empty apply method, and the codec entry |
| `error` (`refusal`) | `<ctx> <Refusal> <factory> [--code CODE] [--term ...]` | under `"stack.refusals": "named"`: the class `domain/errors/<refusal>.error.ts` extending `DomainRefusal`, named with terms of the glossary and the qualifiers `invalid`, `unknown`, `already`, `too`, `no`, `missing`, `required`, its entry in `<context>.codes.ts` (the code, by default the refusal in constant case, unique in the context), the static factory (`for`, `with`, `because`, `on` or `at` then a capital letter: `forAccountId`) and its spec case, each created when absent; run again, nothing changes. Under `factories`: `<ctx> <Concept> <refusal>`, a static factory on `domain/errors/<concept>.error.ts`, the error class of the concept |
| `domain-error` | `<ctx> <Name> [--code CODE]` | one class per error in `domain/errors/`, spec: only in a project whose config says `"stack.refusals": "classes"` or nothing; refused under `named` and `factories`, which use `error` |
| `domain-service` | `<ctx> <Name>` | `domain/services/`, spec |
| `state-machine` | `<ctx> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]...` | `domain/state-machines/<aggregate>.state-machine.ts`, the vocabulary `<Aggregate>Status` (created, or extended), spec; the first state is initial |
| `repository` | `<ctx> <Aggregate> [--tenant-scoped] [--personal <column>,... [--subject <column>] [--erasure pseudonymise\|row]]` | port in `domain/repositories/`, adapter and mapper in `infrastructure/persistence/`, fake, contract suite; with `--personal`, the columns added to the storage, their `personalFields` declaration next to the mapper (`<name>.personal-fields.ts`) and, once per context, the erasure that reads it (port, adapter, fake, spec, listed in the copies of the platform); needs `stack.privacy` on |
| `command` | `<ctx> <UseCase> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--aggregate <Name>]` | `application/commands/<use-case>/`, handler spec |
| `query` | `<ctx> <UseCase> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--search]` | `application/queries/<use-case>/`, read port, in-memory reader, fake, spec |
| `port` | `<ctx> <Name>` | `application/ports/<name>.port.ts`, fake |
| `adapter` | `<ctx> <Port> [--kind external\|gateway] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts`, spec |
| `gateway` | `<ctx> <upstream> <Name>` | read contract in the upstream's published language, port, in-process adapter, fake, contract suite |
| `policy` | `<ctx> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec |
| `route` | `<ctx> <UseCase> --method <M> --path <p> [--command\|--query]` | `presentation/http/`, spec |
| `schema` | `<ctx\|shared-kernel> <Name>` | `presentation/http/shared/<name>.schema.ts` of the context, or `presentation/<name>.schema.ts` of the shared kernel: one shape declared once, shared by the routes that use it |
| `event-handler` | `<ctx> <Aggregate> <Fact> [--phase after-commit]` | `application/event-handlers/`, spec; default phase `before-commit` |
| `projection` (`projector`) | `<ctx> <Name> <event-type>` | `application/projections/<name>.projection.ts` with `@Projection('<ctx>.<name>')` and one `@On` method for the event (of the context itself or of a declared upstream), spec; declared style only |
| `job` | `<ctx> <Name> (--every <duration> \| --cron "<expression>" [--time-zone <zone>]) --command <UseCase>` | `application/scheduling/<name>.job.ts`, spec |
| `background-job` | `<ctx> <Name> --command <UseCase>` | `application/background/<name>.background-job.ts`, named `<ctx>.<name>` by its static `jobName`, its payload one field per input of the command (a `Date` as ISO text), spec through the queue of the test application; `--di tsyringe` only |
| `process` (`process-manager`) | `<ctx> <Name>` | `application/processes/<name>.process.ts`, its timeout job `application/background/<name>-timeout.background-job.ts`, specs (`givenProcess`); `--di tsyringe` only |
| `integration-event` | `<ctx> <Aggregate> <Fact> [--version <n>]` | declaration in `published-language/`, publisher, spec |
| `integration-handler` (`consumer`) | `<ctx> <upstream> <event-type>` | `application/integration/handlers/<name>.integration-handler.ts`, consumer `<ctx>.<name>`, spec |
| `acl` | `<ctx> <upstream-or-system>` | `infrastructure/anti-corruption/<name>.translator.ts`, spec |
| `builder` | `<ctx> <Aggregate>` | `test/builders/` |
| `test-world` | `<ctx> [Name]` | `test/worlds/<name>.world.ts`: `a<Name>World({ now, idPrefix, given })`, the test application (or the buses) with every fake of `test/fakes/`, each returned under the name of its port; the arrangement several specs share |
| `e2e` | `<ctx> <UseCase> [--event <eventType>]` | `test/e2e/<use-case>.e2e.spec.ts` (needs the route, or an integration event handler that sends the command: the spec publishes its event) |
| `service` | `<ctx>` | `src/apps/<ctx>/main.ts`: the context run alone, a start script, a compose service |
| `worker` | | `src/apps/worker/main.ts`: a process for the scheduled jobs and the queues, a start script, a compose service |
| `adr` | `"<title>" [--deviation <what>] [--reason "<why>"]` | `docs/adr/NNNN-<slug>.md` |

Output of every kind: `{ dryRun, created, updated, skipped, next, todos, notes }`. `next` is
the list of `TODO(domain)` places as `file:line`, the glossary first; `todos` adds their text.
