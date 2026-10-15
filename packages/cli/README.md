**English** · [Français](README.fr.md)

# ddd-ts-kit

Bootstrap, scaffold, document and verify Domain-Driven Design and Clean Architecture projects
in TypeScript. One binary: `init` creates the project, `generate` writes every piece of
boilerplate at its canonical place, `docs` keeps the architecture documentation current,
`describe`, `status` and `todo` read the project back as facts, `check` proves that the code
still follows [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
`init` also installs the quality pipeline: ESLint with `@ddd-ts-kit/eslint-plugin`,
dependency-cruiser, knip, coverage thresholds, git hooks and the CI of GitHub or GitLab.

The generator and the checker share one definition of the canonical tree, and a test generates
every kind for every stack and requires zero violation: they cannot disagree.

The main commands fall into two families. The first writes the project: `init` once, `generate` for
each piece, `docs`, `sdk` and `depcruise-config` for what is derived from the code and the
config, and three migrations that move a project from an older form to the current one. The
second reads the project back without changing it: `check` judges it, `list` and `describe` state
what it holds, `status` and `todo` say what is left to do, `affected` says what a pull request has
to run.

![The commands of the CLI around a project: on the left the ones that write it (init, generate, docs, sdk and depcruise-config, the three migrations), in the middle the project (ddd-ts-kit.config.json, the bounded contexts and the platform under src/, the generated documents), on the right the ones that read it back (check and check-file, list and describe, status and todo, affected)](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-commands-and-project.svg)

No runtime dependency. Node 22.12 or later.

```
npx ddd-ts-kit init
npx ddd-ts-kit generate context billing --classification core --term "Invoice=A request for payment"
npx ddd-ts-kit generate aggregate billing Invoice
npx ddd-ts-kit generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue --grant accountant --term "Issue=To make an invoice final"
npx ddd-ts-kit generate route billing IssueInvoice --method POST --path /invoices
npx ddd-ts-kit check
```

`init` ends by saying what to run next: `pnpm install`, then `pnpm run verify` (`npm install`,
then `npm run verify` with `--package-manager npm`), then the recommended steps of the method, in
order ([methodology](../../docs/guides/methodology.md)); [which command, when](../../docs/guides/commands.md)
gives the command of each moment of a project and the reference of every flag. A new project passes that whole gate before
anything is generated, with no context, with one and with several: the end-to-end suite installs
it for real and runs it, on both package managers and on every proven stack. After the install the
CLI is the one the project pins: `pnpm exec ddd-ts-kit <command>`, or `npx ddd-ts-kit <command>`.

Every command accepts `--json` (machine-readable output, errors included) and `--cwd <dir>`.
Commands other than `init` look for `ddd-ts-kit.config.json` in the directory and its parents.
Exit codes: `0` success, `1` violations, stale documentation or, under `--strict`, a commit over
its limits, `2` wrong usage (the message says what to do).

## init

```
ddd-ts-kit init [--http express|fastify|hono|nest|none]
                [--validation zod|class-validator|typebox|standard-schema|none]
                [--di tsyringe|nest|manual] [--tests vitest|jest]
                [--orm drizzle|knex|prisma|typeorm|custom|none]
                [--database postgres|mysql|sqlite|none]
                [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis]
                [--http-cache none|varnish] [--storage local|s3|none] [--audit on|off]
                [--errors none|sentry] [--logger stdout|pino|winston]
                [--style declared|explicit] [--assembly barrel|discovery]
                [--dependencies signature|listed] [--refusals factories|classes]
                [--routes controllers|functions] [--value-objects throwing|result]
                [--literals named|free] [--values classes|free] [--tenancy none|shared-table]
                [--queue database|redis|memory]
                [--schemas shared|per-route]
                [--package-manager npm|pnpm]
                [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                [--import-extension none|js] [--sdk]
                [--context <name>:<core|supporting|generic>]...
                [--preset identity]...
                [--dry-run] [--force]
```

Works in an empty directory or an existing project. An existing file is never replaced without
`--force`; it is reported as skipped. `init` also writes the generated contracts as the scripts
of the project write them for a project without a route or an integration event of its own
(`openapi/openapi.yaml`, `docs/integration/asyncapi.yaml` and `event-catalog.md`; JSON under
`"openapi": { "format": "json" }` of the config), so that the first commit holds them and
`docs:check` passes at once; a contract that is already there is
left alone, `--force` included. An existing `package.json` is merged: missing scripts and
dependencies are added, yours are kept and mentioned in the notes. Run again later, `init` keeps
the stack recorded in the config.

`init --force` on a project that is already initialised rewrites the files `init` owns and keeps
the config: the contexts and their upstreams, the rules, the limits, the deviations and every
other key stay as written, and the stack changes only where a flag names a choice
(`init --force --logger pino` changes the logger; a combination the recorded stack cannot take
is refused as for a new project). The composition root, the proof that each context wires alone
and the registry of permissions are rewritten from their templates, then the declared contexts
are wired into them again; what another generator had added to a file of the platform (the
value of a gateway, the settings of a job) is not, and a note says so. A config that cannot be
read is replaced.

The pipeline uses free tools only. `--ci-extras` adds jobs that need a paid plan on a private
repository, or report into a merge request only in a paid tier: `codeql`, `dependency-review`
(GitHub), `gitlab-sast`, `gitlab-secret-detection`, `gitlab-dependency-scanning` (GitLab). The
list is recorded as `ci.extras` in the config; an unknown name, or a job of a platform `--ci` does
not cover, is refused. The table of every tool and its conditions:
[pipeline/README.md](../../pipeline/README.md#free-by-default-paid-on-request).

An import of a file of the project is written without an extension
(`@/contexts/billing/domain/aggregates/invoice.aggregate`): `init` records
`"importExtension": "none"`, and `--import-extension js` asks for the `.js` of the emitted file
instead. A config without the key is read as `js`, so a project generated before the key
existed keeps its spelling. See [docs/CONFIG.md](../../docs/CONFIG.md).

Defaults: `express`, `zod`, `tsyringe` (`nest` with `--http nest`, and only then), `vitest`,
`drizzle` on `postgres`, `outbox` when there is an ORM, `swagger`, `github`, `jwt`, `rbac`, no broker,
the cache in the process, files in a local directory (`--storage local`), the audit trail `on` when there is an ORM, unexpected failures reported
nowhere (`--errors none`), JSON lines on the standard output (`--logger stdout`), and the
`declared` style with a `barrel` wherever the declarations are read: with `--di tsyringe`.

**Package manager.** `pnpm` unless `--package-manager npm`: every script, pipeline, hook, the
Dockerfile, the guidance and the agent permissions are written in the dialect of the one chosen,
recorded under `stack.packageManager`. pnpm is pinned in `package.json` and provided by corepack;
`pnpm-workspace.yaml` says that no dependency runs a build script unless allowed by name. Both are
proven by a real install of a generated project, its build and its `verify`. The kit is installed
from the registry either way.

**Pipelines.** A pull or merge request runs the unit specs, the integration specs and the lint of
the contexts its change reaches through the context map ([`ddd-ts-kit affected`](#affected)); types,
architecture, import graph, dead code, end to end, build and documents always run on the whole
project, and the default branch and the nightly schedule run everything.

**Two styles.** In the `declared` style each class says what it is with a decorator of
`@ddd-ts-kit/kernel/declarations` (`@Requires` or `@Public` on a command or a query,
`@CommandHandler`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`,
`@Policy`, `@Repository`, `@Gateway`, `@Adapter`), a context has no `<context>.module.ts`, and the
composition root assembles it in one line. In the `explicit` style every binding is written in the
module file of the context: `builder.bind(Port).toClass(Adapter, [Ports])`,
`builder.command(Message).requires(...).handledBy(Handler, [Ports])`, `builder.job(name, schedule)`.
`--style declared` is refused with `--di manual` and `--di nest`: the declarations are plain
metadata, and only `@ddd-ts-kit/di` (on tsyringe) turns them into bindings.
`--assembly` says how a declared context reaches the composition root: `barrel` (the default) is one
generated file per context, `<context>.declarations.ts`, static, followed by a bundler, by knip and
by dependency-cruiser; `discovery` writes `await discoverContext(...)` instead, with the knip entry
and the dependency-cruiser exception the discovered files need (publishers and jobs included: they
are discovered like the rest), and inlines `@ddd-ts-kit/di` in the two vitest configs, so that the
files it imports itself are compiled by the runner. Discovery is accepted behind a broker: a
context listens on the subscriber `EventSubscribers.forContext(name)` hands it, in either assembly.
A config written before `stack.style` existed is explicit.

The same use case in both styles. In the declared style, the command and its handler carry their
decorator, and the handler's constructor says what it needs. The body of the handler is the one
`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue` writes,
before its `TODO(domain)` is answered; the input of the command is filled in:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { type Actor, AggregateRoot, AuthorizedCommand, type Clock, type IdGenerator, Repository } from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

declare class Invoice extends AggregateRoot {
  static create(id: string, now: Date): Invoice;
}

// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}

// application/authorization/billing.permissions.ts
export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue invoice' },
});

// application/commands/issue-invoice/issue-invoice.command.ts
@Requires(billingPermissions['invoice.issue'])
export class IssueInvoiceCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  // each parameter is typed by one class, which is also its injection token
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<string> {
    const invoice = Invoice.create(this.ids.next(), this.clock.now());

    await this.invoiceRepository.save(invoice);

    return invoice.id;
  }
}
```

In the explicit style, the same classes carry no decorator, and the module file of the context
binds each of them, with its permission and the ports it is given:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { defineContextModule } from '@ddd-ts-kit/di';
import { AggregateRoot, AuthorizedCommand, Clock, type CommandHandler, IdGenerator, Repository } from '@ddd-ts-kit/kernel';

// the classes of the declared sample, without their decorators
declare class Invoice extends AggregateRoot {}
declare class IssueInvoiceCommand extends AuthorizedCommand<string> {}
declare class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(invoiceRepository: InvoiceRepository, ids: IdGenerator, clock: Clock);
  execute(command: IssueInvoiceCommand): Promise<string>;
}
declare class InMemoryInvoiceRepository implements InvoiceRepository {
  findById(id: string): Promise<Invoice | undefined>;
  save(invoice: Invoice): Promise<void>;
}

export abstract class InvoiceRepository extends Repository<Invoice> {}

export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue invoice' },
});

// billing.module.ts: every binding of the context, one line each
export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.bind(InvoiceRepository).toClass(InMemoryInvoiceRepository).as('repository');
    builder
      .command(IssueInvoiceCommand)
      .requires(billingPermissions['invoice.issue'])
      .handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);
  },
});
```

`check` holds both forms: `authz/declared` reports a command that says neither who may send it
nor that it is public, `declarations/role-declared` a role file of the declared style without its
decorator.

**A port is an abstract class and its own injection token.** `application/ports/<name>.port.ts`
and `domain/repositories/<name>.repository.ts` hold one abstract class each. Generated code holds
no `token()`, no UPPER_SNAKE injection constant, no `<context>.ports.ts` and no
`platform/tokens.ts`: a constructor parameter typed by a port class names what is injected
(`private readonly clock: Clock`), kernel ports are value imports wherever they are named in a
list or a binding and type imports where they only type a parameter, an adapter `implements`
its port.

Instead of an interface, a token constant and an injection by name:

```ts
export interface IPaymentGateway {
  charge(invoiceId: string, amountInCents: number): Promise<void>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway'); // ports/no-token-constant

constructor(@inject(PAYMENT_GATEWAY) private readonly payments: IPaymentGateway) {}
```

write one abstract class, which is both the contract and the token:

<!-- checked sample -->
```ts
import { Adapter } from '@ddd-ts-kit/kernel/declarations';

// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(invoiceId: string, amountInCents: number): Promise<void>;
}

// infrastructure/external/remote-payment-gateway.adapter.ts: implements the port, never extends it
@Adapter(PaymentGateway, { kind: 'external' })
export class RemotePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string, amountInCents: number): Promise<void> {
    // TODO(platform): call the payment provider with invoiceId and amountInCents
  }
}

// a handler names the port by the type of its parameter: nothing else says what is injected
export class SettleInvoiceHandler {
  constructor(private readonly payments: PaymentGateway) {}

  async settle(invoiceId: string, amountInCents: number): Promise<void> {
    await this.payments.charge(invoiceId, amountInCents);
  }
}
```

`ports/abstract-class`, `ports/implements-never-extends`, `ports/no-token-constant` and
`ports/value-import` hold this form, in `check` and in ESLint.

**The constructor states the dependencies.** In the declared style a generated class lists
nothing in its decorator (`@CommandHandler(IssueInvoiceCommand)`): each constructor parameter
is typed by one class, its token (`declarations/constructor-injection`). `generate`, `docs` and
the `dev` script read the signatures, with the zero-dependency scanner of the checker and no
compiler, and write `injected(Class, [Tokens])` statements in the generated file of each
context: the barrel `<context>.declarations.ts`, or `<context>.dependencies.ts` under
discovery. `@ddd-ts-kit/di` injects from there. `emitDecoratorMetadata` is never relied on: it
is absent with standard decorators and under `tsx`. `init` writes
`"stack.dependencies": "signature"`; a config without the key is `listed`, the 0.1 form
(`@CommandHandler(M, [Ports])`), which keeps working untouched, and
`--dependencies listed` asks for it. The explicit style stays explicit: its module file lists
what each class is given. Every generated file exports one class, interface or function and is named
after it.

![How a declared context reaches the composition root: the role files carry their decorator and type their constructor parameters by classes; generate, docs and the dev script read those signatures and write the barrel, one export per role file and one injected statement per class that takes something; the composition root includes the barrel with contextModule and @ddd-ts-kit/di injects from it; check and docs --check report a barrel that no longer matches the role files](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-declared-barrel.svg)

An excerpt of the barrel of the `notification` context of the example application, as the CLI
writes it (never by hand):

```ts
// src/contexts/notification/notification.declarations.ts
import { injected } from '@ddd-ts-kit/kernel/declarations';
import { WithdrawReminderHandler } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';
export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
export * from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';

injected(WithdrawReminderHandler, [ReminderRepository]);
injected(KnexReminderRepository, [KnexContext, ExecutionScope, Clock]);
```

and the one line of the composition root that adds the whole context:
`contextModule('notification', notificationDeclarations)` in `src/platform/compose-application.ts`.

**Domain errors are built by factories.** `init` writes `"stack.refusals": "factories"`: a
context has one error class per concept, extending `ConceptError` of the kernel, and
`generate error <context> <Concept> <refusal>` adds a static factory to it. The `errors/*`
rules hold that form. `--refusals classes`, or a config without the key, keeps one class per
error built with `new`, as 0.1 and 0.2 wrote them; `error-factories` moves a project from one
to the other.

The older form, under `"stack.refusals": "classes"`: one class per error.

<!-- checked sample -->
```ts
import { DomainError } from '@ddd-ts-kit/kernel';

// domain/errors/slot-taken.error.ts
export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(readonly calendarId: string) {
    super(`The slot of calendar ${calendarId} is already held.`);
  }
}

const refusal = new SlotTakenError('calendar-1');
```

The form `init` writes: one class per concept of the glossary, one factory per refusal, which
`generate error scheduling Appointment slotTaken` adds.

<!-- checked sample -->
```ts
import { ConceptError } from '@ddd-ts-kit/kernel';

// domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('SLOT_TAKEN', `The slot of calendar ${calendarId} is already held.`, { calendarId });
  }
}

const refusal = AppointmentError.slotTaken('calendar-1');

// what catches it tells the refusal by its class and its code, and reads its facts
if (AppointmentError.is(refusal, 'SLOT_TAKEN')) {
  console.log(refusal.facts.calendarId);
}
```

**A route is a controller class.** `init` writes `"stack.routes": "controllers"`: each route is
one class with one method, in a folder of its own, behind the guards of its route group, and a
declared context lists no route: its controllers reach the application through its generated
file. `--routes functions`, or a config without the key, keeps one `defineRoute` function per
route, listed in `<context>.routes.ts`, as 0.1 to 0.3 wrote them; `controllers` moves a
project from one to the other, a context at a time.

**A shape is declared once.** `init` writes `"stack.schemas": "shared"`: a command route answers
its identifier with `acceptedSchema` of `@ddd-ts-kit/http`, one `Accepted` component in the
contract, and `generate schema <context> <Name>` (or `schema shared-kernel <Name>`) writes a
shape several routes use, which the contract documents once and every route refers to. The
`schema/*` rules hold that form. `--schemas per-route`, or a config without the key, keeps one
schema per route, an identifier answer included, as 0.1 to 0.5 wrote them.

**A value object throws its refusals.** `init` writes `"stack.valueObjects": "throwing"`:
`generate value-object` writes a `create` that returns the value object or throws the refusal of
its concept, and a spec that asserts it with `expectRefusal(() => ..)`. `--value-objects result`,
or a config without the key, keeps a `create` returning a `Result` that the caller unwraps, as 0.1
to 0.5 wrote it; `value-objects` moves a project from one to the other.

**Domain events leave with the save.** A generated command handler builds or loads its aggregate,
calls one intention method, `await repository.save(aggregate)` and returns: no `pullEvents()`, and
no `DomainEventDispatcher` in a handler or in a repository adapter, which only persists. The events
the aggregate recorded are dispatched once the save resolves, inside the unit of work of the
command: by the kernel module on tsyringe, by `dispatchingOnSave` around each repository in
`platform/create-platform.ts` with hand wiring (`domain-events/dispatched-on-save`).

Instead of pulling the events and dispatching them in the handler:

```ts
async execute(command: IssueInvoiceCommand): Promise<void> {
  const invoice = await this.invoiceRepository.findById(command.invoiceId);

  invoice.issue(this.clock.now());
  await this.invoiceRepository.save(invoice);
  await this.dispatcher.dispatch(invoice.pullEvents()); // domain-events/dispatched-on-save
}
```

write the save, and nothing after it:

<!-- checked sample -->
```ts
import { type Actor, AggregateRoot, AuthorizedCommand, type Clock, type CommandHandler, ConceptError, Repository } from '@ddd-ts-kit/kernel';

declare class Invoice extends AggregateRoot {
  /** Makes the invoice final and records InvoiceIssued, which waits in the aggregate. */
  issue(now: Date): void;
}

declare class InvoiceError extends ConceptError {
  static notFound(invoiceId: string): InvoiceError;
}

export abstract class InvoiceRepository extends Repository<Invoice> {}

export class IssueInvoiceCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}

export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<void> {
    const invoice = await this.invoiceRepository.findById(command.invoiceId);

    if (invoice === undefined) {
      throw InvoiceError.notFound(command.invoiceId);
    }

    invoice.issue(this.clock.now());

    // InvoiceIssued is dispatched once this save resolves, inside the unit of work of the command
    await this.invoiceRepository.save(invoice);
  }
}
```

`--events in-memory` together with an ORM is refused unless `--allow-no-outbox "<reason>"` is given:
it records a `deviations` entry (`stack.events`) and writes the decision record it points to. The generated
persistence of the four ORMs is written for PostgreSQL; `custom` starts on in-memory adapters
held to the contract suites, for you to replace. The choices are recorded under `stack` in the
config, `docsUi`, `ci` and `logger` included.

| Written | Content |
|---|---|
| `ddd-ts-kit.config.json` | stack, contexts, rule severities ([docs/CONFIG.md](../../docs/CONFIG.md)) |
| `package.json` | scripts and dependencies of the stack (below); `build` is the compiler, then `ddd-ts-kit build-aliases` |
| `tsconfig.json`, `tsconfig.build.json` | strict, NodeNext, `rootDir` `.` and `outDir` `dist`, and `paths`: the one declaration of the import alias (`@/*` to `./src/*`, `$test/*`, `$scripts/*`, and `$generated/*` with Prisma), derived from `importAlias` (`--import-alias '$<name>/'`, `@/` by default; `#<name>/` and `@<name>/` are refused with the reason); the build config extends the other and declares no `paths`; `experimentalDecorators` (and `emitDecoratorMetadata`) only for nest or class-validator, whose decorators are legacy ones: the declarations and the aspects serve both modes |
| `src/main.ts` | composition root: tracing first (error reporting second with `--errors sentry`), config, persistence, application (`log`, `traceConsumers: config.tracing.consumers`, `resilience`, `jobs: { start: config.runJobs, settings: jobSettings(process.env) }`), outbox relay, HTTP server; on `SIGTERM` or `SIGINT` it closes the server, stops the relay, stops the application, closes the persistence and shuts the tracing down |
| `src/platform/` | one export per file, each named after it, in one folder per concern. At its root: `tracing.ts`, `compose-application.ts` and `job-settings.ts` (`jobSettings(environment, context?)`: one line per job, `JOB_<CONTEXT>_<JOB>_ENABLED=false` switches one off). `config/` (`app-config.ts`, `load-config.ts`, `config-error.ts`, `read-tracing.ts`: fail-fast on `DATABASE_URL`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_SCRUB_MESSAGES`, the `OUTBOUND_*` policy, `RUN_JOBS` and the tracing variables below); `observability/` (`create-logger.ts`, see `--logger`; `create-metrics.ts`: a `NoopMetrics` behind a `TODO(platform)`); `resilience/` (`resilience-settings.ts`, `default-resilience.ts`, `adapter-aspects.ts`: retry with backoff and a timeout for `external` and `gateway`, `own-policy.ts` for an adapter that states its own, `self-governed.ts`); `events/`, `database/`, `auth/`, `audit/`, `redis/` (below); `http/` (`start-http-server.ts`, `with-documentation.ts`: `/docs` and `/openapi.json`, or `/openapi/<name>.json` per document of a split contract, off in production unless `API_DOCS=true`; `openapi-documents.ts`, the split written by `ddd-ts-kit docs` from `openapi.documents`). With `--di tsyringe`: `compose-application.ts` (`composeApplication(persistence, options, contexts?)`: `kernelModule({...})`, the platform module, the authorization module, the contexts; installs the aspect runtime), `lay-foundations.ts` (one execution scope, clock, id generator, logger, metrics, instrumentation and audit, built before any module), `platform.module.ts` (what replaces the in-process defaults of the kernel: unit of work, processed-event store, the storage class, `OutboxStore`, `EventSubscribers` behind a broker, `ErrorMapper`, and `builder.around(['external', 'gateway'], ...)`, the resilience of every adapter that leaves the process), `platform-test.module.ts` (what a handler spec lists next to its context: the storage class bound to a factory that throws), `buses/create-command-bus.ts` and `create-query-bus.ts` (outermost first: `errorReportingMiddleware`, `loggingMiddleware`, `metricsMiddleware`, the permission, the span of the use case, the audit entry, then the unit of work of a command). With `--di manual` or `nest`: `compose-application.ts`, `platform.ts` (`interface Platform`, with `jobs: JobScheduler` and `adapter`, which wraps what a module file instantiates), `create-platform.ts`, `jobs/configured-job-scheduler.ts` (applies `job-settings.ts` to what a module registers) |
| tracing | wired once, by the platform (`tracing/platform-only`): no `decorate` hook, no `decorate-bindings.ts`. `tracing.ts` starts `initTracing` of `@ddd-ts-kit/tracing/node` before any other module, on what `config/read-tracing.ts` validates: `OTEL_EXPORTER_OTLP_ENDPOINT` (a URL; left out, no span leaves the process), `TRACE_SAMPLE_RATIO` (0 to 1) and `TRACE_CONSUMERS` (`continue`, the default: a consumed event stays in the trace of its publication; `link`: each delivery starts a trace linked to it). With `--di tsyringe`: `lay-foundations.ts` builds `traceApplication({ consumers })`, `compose-application.ts` hands it to `kernelModule({ instrumentation })` (one span per use case, repository call, domain event, publication, consumer and job) and gives the outbox relay `tracedPublisher(bus)`. With hand wiring: `create-platform.ts` applies the members of `traceApplication()` itself (`useCase` on both buses, `domainEvents`, `publisher`, `binding` around every adapter, `job`, `executionScope`, `errorReporter`), with `tracedSubscriber` and `tracedPublisher` around the provider. With an HTTP stack, in both families, `auth/http-boundary.ts` sets `around: tracedRoutes()`: one `SERVER` span per request, named by its route |
| `--logger` | `src/platform/observability/create-logger.ts`, one per choice: `stdout` (the default) is the `StdoutLogger` of `@ddd-ts-kit/aspects`, JSON lines, credentials not redacted; `pino` is `createPinoLogger` of `@ddd-ts-kit/pino` (dependencies `pino` and `pino-pretty`); `winston` is `createWinstonLogger` of `@ddd-ts-kit/winston`; these two redact the credential keys of the kernel. Every entry carries `traceLogFields(scope)`: the correlation id, origin, actor and tenant of the work in progress and the ids of the active trace. `LOG_LEVEL`, `LOG_FORMAT` (`json`, the default, or `pretty`; with `stdout`, which has no pretty format, `pretty` is refused when the configuration is loaded) and `LOG_SCRUB_MESSAGES` (`[message removed]` in place of the message of a logged error that is not a `DomainError`) are validated in `config/load-config.ts`. Stopping the application flushes the error reporter, then the logger, last: `container.stop()` does it on tsyringe, `compose-application.ts` flushes explicitly with hand wiring. The tools and the tests compose the application without `log` and write nothing |
| `src/platform/auth/` | `create-authenticator.ts` (`--authn jwt`: `JwtAuthenticator` on `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI`; `--authn keycloak`: `keycloakAuthenticator` on `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE` and the optional `KEYCLOAK_CLIENT_ID`; `--authn none`: `development-header-authenticator.ts`, which reads `x-development-actor` and throws in production), `principal-of.ts`, `security-schemes.ts`, `offline-authenticator.ts`, `http-boundary.ts` (`resolvePrincipal` answering a `Session`, `executionScope`, `errorMapper` and `onError`, spread into the mount options: every request runs inside the execution scope, with its correlation id), `create-authorizer.ts` and the files of the model (`roles.ts`, with the role `system` every system actor holds; `attribute-policies.ts`; `relationship-schema.ts`, `create-tuple-store.ts` and its contract spec, `relation-tuples.ts`, `relate-system-actors.ts`, `permission-mapping.ts` and `permissions.ts`; `custom-authorizer.ts`, its `authorizerContract` spec and `permissions.ts`), `authorization.ts` (`authorizationModule` with tsyringe) or `use-case-protection.ts` (the guard of the hand-wired buses), `access-policies.ts`, and with `--audit off` `log-decisions.ts` (one log entry per decision, ids and codes only). Without an HTTP stack there is no authenticator and no boundary |
| `--representations negotiated`, `--forms on` | `src/platform/http/presentation-of.ts` (`Representations.standard()` with `negotiated`, and `fieldDeciderOf` over the `Access` of the application), spread into the HTTP boundary and given to the contract script; with `--forms on`, `src/platform/http/with-forms.ts` adds `formRoutes` to the routes and `scripts/openapi.ts` writes `openapi/forms/<operationId>.json`. Both are the default with an HTTP stack; `json` and `off` leave them out ([docs/CONFIG.md](../../docs/CONFIG.md)) |
| `--audit on` | `src/platform/audit/`: `create-audit.ts` (the trail, the `onDecision` of the authorization, the refusals of the guards at the edge given to the HTTP boundary as `onGuardRefusal`, the middleware before the unit of work, the integration events subscribed under the consumer name `audit`), `audited-events.ts` (the registry `generate integration-event` adds to), `audit.module.ts`, and with an HTTP stack the read side: `audit.permissions.ts` (`audit:trail.read`), `search-audit-entries.query.ts`, its handler, `search-audit-entries.route.ts` (`GET /audit/entries`: cursor pages, filters `actorId`, `action`, `outcome`, `correlationId`). It is a capability of the platform, not a bounded context: no model, one protected query over the `AuditReader` port, bounded by the tenant of the actor (with `--tenancy shared-table`, by the tenant of the work through `TenantAuditReader`: platform staff read across tenants only inside `acrossTenants`). The refusals of a caller without a credential are not recorded. A scheduled job is audited like a request: origin `schedule`, actor `system:<context>.<job>`. With knex the two tables and their append-only triggers are created by the first migration; with drizzle the tables are in `schema.ts` and `npm run db:audit-guard` prints the trigger statements for a custom migration; with prisma, typeorm, `custom` or no ORM the trail is an `InMemoryAuditTrail` behind a `TODO(platform)`. The test databases leave the audit schema out of `reset()` |
| `--tenancy shared-table` | recorded as `stack.tenancy`; Knex or Drizzle only. Every `generate repository` is tenant-scoped (as `--tenant-scoped`), through `tenantTable` and `ownTenantTable` or `tenantCondition` and `ownTenantCondition`; the outbox keeps the tenant of each event (`createOutboxTables(knex, { tenant: true })` and `KnexOutboxStore`'s `tenant: true`, or `tenantOutboxTable`), so consumers run in it; `tenancy/scoped-statement` judges the adapters. Row-level security, schema per tenant and database per tenant are refused, with what to wire by hand ([Multitenancy](../../docs/concepts/multitenancy.md)) |
| `--queue database\|redis\|memory` | recorded as `stack.queue`. `database` (the default on Knex or Drizzle with tsyringe): `createJobTable` and `createProcessTable`, or `jobsTable` and `processesTable`, in the `messaging` schema, `Persistence` gains `jobs` and `processes`, and the platform module rebinds `JobStore` and `ProcessStore` to them, so a job enqueued by a command is written in its transaction; `redis` (with `--cache redis`): `RedisJobStore` on the connection of the cache, the processes in the database; `memory` (the default otherwise): nothing is written, the kernel module keeps both in the process. Refused off tsyringe, `database` with another ORM, `redis` without the cache |
| `--cache redis` | `src/platform/redis/open-redis.ts` (`RedisServices`: the cache bound to the kernel `Cache`, the limiter to `RateLimiter`, the lock to `Lock`, which keeps a scheduled job to one instance, the relay signal as the `wakeOn` of the outbox relay with `relayWakeUpMiddleware` on the command bus), `http/refusal-for.ts` (one sliding window per caller address, 429 `application/problem+json` with `retry-after`; `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`), `GET /health/ready` on the HTTP server, `REDIS_URL` validated, a compose service `cache` running Dragonfly with a healthcheck. Without a server (tools, tests without `REDIS_URL`) the same ports stay in the memory of the process |
| `--http-cache varnish` | a compose service `varnish` (Varnish 9.1.0, reaching the API on `host.docker.internal`) with its VCL in `docker/varnish/default.vcl` (only answers whose `Cache-Control` allows them by `max-age` or `s-maxage` are kept, filed under their `xkey` tags, purged by `PURGE` from the machine of Varnish or with `VARNISH_PURGE_KEY`, `x-cache: HIT\|MISS`), `VARNISH_URL` and `VARNISH_PURGE_KEY` validated, `cacheTags: { header: CacheTagHeader.xkey }` in the HTTP boundary, and the outbox relay of `main.ts` and of every `generate service` entry point publishing through `PurgingPublisher` with `VarnishCachePurger` (the end-to-end application records the purges in `purges`); on `--di manual` and `nest` the platform gains `cacheInvalidation`; with `--tenancy`, the tags of the answers and the purges are filed under the tenant (`perTenant`) and the tenant of a request is read from `x-tenant-id`. Needs an HTTP framework and `--events outbox`: a purge is a row of the outbox |
| `--errors sentry` | unexpected failures reported to Sentry or GlitchTip (one protocol, only the DSN differs) through the kernel `ErrorReporter`, bound to `@ddd-ts-kit/sentry`. `src/platform/errors.ts` (`initSentry` on the validated configuration, then `reportProcessFailures`), the second import of `main.ts`, of `apps/<context>/main.ts` and of `apps/worker/main.ts`, right after `tracing.ts`; `errors` handed to `composeApplication`, which gives it to the kernel module on tsyringe (`errorReporter`, flushed by `container.stop()` before the logger, `errorReportingMiddleware` first on both buses, the default scheduler observing with `reportFailedRuns`) or to `createPlatform` by hand (the same middleware, `onRun: reportFailedRuns(errors)`, `platform.errors`, flushed two seconds at most when the application stops); `reportHttpErrors` in `auth/http-boundary.ts` for every request answered 5xx; `DeadLetterReports` on the `onFailure` hook of a provided broker (`createEventProvider(config, errors)`, with `observing` around each consumer) and of the outbox relay. `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (default: `NODE_ENV`), `SENTRY_RELEASE` and `SENTRY_SCRUB_MESSAGES` validated in `config/load-config.ts` as `errorReporting`: without a DSN the application starts and reports nothing; a DSN that is not a URL refuses the start. Dependencies `@ddd-ts-kit/sentry` and `@sentry/node`. A compose profile `errors` running GlitchTip 6.2.6 with its own PostgreSQL and Valkey (`GLITCHTIP_PORT`, loopback only, development bootstrap), and a section of the generated README saying how to read its DSN. The tools and the tests compose the application without a reporter. It goes with every other choice of the stack; with `--errors none` nothing of this is written |
| `--authn keycloak` | a compose service `keycloak` (Keycloak 26.8.0, `start-dev --import-realm`, profile `identity`) and `docker/keycloak/<project>-realm.json`: the API client, a public client `<project>-local` with the direct grant, its audience and `tenant_id` mappers, the realm role `admin`, and the demo users `demo-admin` and `demo-user`, for local development only |
| `--storage local\|s3` | recorded as `stack.storage`: where the content of files lives, never in the database. `src/platform/config/read-files.ts` and `src/platform/files/open-files.ts`, one per choice: `local`, a directory in development (`FILES_DIRECTORY`, `.data/files`) and the signed links answered by the application under `/files` (`FILES_PUBLIC_URL` and `FILES_SIGNING_SECRET` required in production); `s3`, a bucket of any provider of the S3 protocol through `@ddd-ts-kit/s3` (the `S3_*` variables, MinIO in the compose stack); the memory of the process in the tests and the tools, either way. With `--di tsyringe`: `files/bind-files.ts`, `files/files.module.ts` and `files/staging-uploads.ts`; with hand wiring `files/create-files.ts`; with an HTTP stack `files/file-routes.ts`. They bind `FileStorage`, `FileKeys`, `FileScanner` and `FileStaging`, register the hourly purge of staged files and stage the file a command carries before its transaction; `generate file-upload` needs them. `--storage none` writes none of this ([File storage](../../docs/concepts/file-storage.md)) |
| `src/platform/events/` | `event-provider.ts` (`bus`, `forConsumer(name)`, `start()`, `close()`), `in-process-events.ts`, and for `--broker` `create-event-provider.ts`: `RabbitMqEventBus` (`AMQP_URL`), `KafkaEventBus` (`KAFKA_BROKERS`, with `aggregate-key-of.ts` for per-aggregate order), `NatsEventBus` (`NATS_URL`) or `RedisStreamsEventBus` of `@ddd-ts-kit/redis/event-bus` (`REDIS_URL`: Redis, Dragonfly or Valkey), each with one subscriber per consuming context (`forConsumer`), `assertTopology` at start, its address validated and a compose service with a healthcheck; or `custom-event-bus.ts` with its `eventBusContract` spec. `start-outbox-relay.ts` with the outbox. `--broker redis` with `--cache redis` is one server and one compose service, `cache`; alone, the service is `streams` |
| `src/platform/database/` | `persistence.ts` (`interface Persistence`: unit of work, outbox and processed-event stores of the ORM package, the storage handle), `open-persistence.ts`, `persistence-over.ts`, `inert-persistence.ts`, the connection (`connect-to-database.ts`, `create-client.ts` or `create-data-source.ts`), `schema.ts`, `open-test-database.ts` (PostgreSQL in process, or the server named by a URL). The storage class a repository adapter names in its dependency list: `database.ts` with drizzle and prisma (`abstract class Database extends` the context type of the ORM package), `KnexContext` of `@ddd-ts-kit/knex`, `TypeOrmContext` of `@ddd-ts-kit/typeorm` |
| migration tooling | `drizzle.config.ts`, `knexfile.js` and `migrations/00000000000000_initial.js`, `prisma/schema.prisma` and `prisma.config.ts`, or `data-source.ts` |
| `scripts/openapi.ts`, `scripts/events.ts` | write `openapi/openapi.yaml` (one file per document of `openapi.documents`), `docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md`, in JSON under `openapi.format: json`; `--check` fails on a difference |
| `docker-compose.yml`, `.env.example`, `Dockerfile`, `.dockerignore` | the database with a healthcheck and a named volume, `jaegertracing/jaeger:2.22.0` behind the `observability` profile (its UI and its OTLP port bound to 127.0.0.1), ports from `.env`; a multi-stage, non-root image with production dependencies only |
| `vitest.e2e.config.ts`, `test/e2e/support/` | `start-application.ts` (the whole application on a free port, on an in-process database unless `DATABASE_URL` is set, no job run by time), `create-credentials.ts`, `auth-environment.ts`, `test-environment.ts`, `story-of.ts` (`storyOf(trace)`: a trace without the calls an adapter makes on itself, the form `expectSpanTree` asserts) |
| `docs/context-map.md`, `docs/integration/README.md` | see `docs` |
| `test/architecture/extractable.spec.ts` | written with the first context: boots each context alone on the kernel and the platform, its jobs included |
| `eslint.config.mjs` | the `dddTsKit` preset of `@ddd-ts-kit/eslint-plugin`, typed linting on the project's tsconfig |
| `.dependency-cruiser.cjs` | the import graph rules, generated from the config (see `depcruise-config`) |
| `biome.json` | the formatter: Biome with its linter and its import organiser off, line width 120; `npm run format` writes, `npm run format:check` checks, and what the CLI generates is already formatted |
| `knip.json` | dead code: entry points are `main.ts` and `apps/*/main.ts`, the scripts, the specs and the fakes, the module files in the explicit style, the role files under discovery (jobs and publishers included) |
| `vitest.config.ts` | unit and integration projects, the coverage thresholds read from `ddd-ts-kit.config.json` (`governedCoverage`), per context and layer, in the standard decorator mode `decorators()` of `@ddd-ts-kit/testing/vitest`, which compiles the files holding a decorator with the compiler of the project (Vitest does not lower standard decorators; it lowers legacy ones itself, so a project with `experimentalDecorators` gets no plugin), and under `--assembly discovery` `server.deps.inline: ['@ddd-ts-kit/di']` |
| `lefthook.yml`, `commitlint.config.mjs` | pre-commit (ESLint, the format check and `check` on the staged files, `check --commit-size --staged`, which never blocks), pre-push (types, unit tests) and commit-msg hooks (`npm run hooks:install`), conventional commits |
| `--ci github` | `.github/workflows/ci.yml`, `pr-title.yml`, `copilot-setup-steps.yml` (Node and the dependencies, installed before the Copilot cloud agent starts), `.github/dependabot.yml`, `.github/branch-protection.md`, `renovate.json`; `codeql.yml` with `--ci-extras codeql` |
| `--ci gitlab` | `.gitlab-ci.yml` (architecture findings as a Code Quality report through `check --format gitlab`), `.gitlab/merge-request-settings.md`, `renovate.json` |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*.md`, `.github/instructions/*.instructions.md` | how to run it; a slim guide in `AGENTS.md`, which Codex, Copilot and most coding agents read and `CLAUDE.md` imports (commands, how to read less, the map of the rules, generated files, compiler note, the skills of the plugin: `/ddd-ts-kit:start`, `glossary`, `use-case`, `document`, `quality-gate`) and the invariants in seven rule files, `domain.md`, `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md`, `platform.md` and `tests.md`, each scoped by a `paths` frontmatter, and the same seven for GitHub Copilot, each scoped by `applyTo` |
| `.github/copilot/settings.json` | the plugin of the kit, declared for GitHub Copilot (`extraKnownMarketplaces`, `enabledPlugins`): its cloud agent installs it, the Copilot CLI and VS Code recommend it; an existing file keeps what it holds and gains the two entries |
| `.claude/settings.json` | permissions only: the checks and generators run without asking, `.env` files are unreadable (`.env.example` stays readable), the three generated documents are not edited by hand, `git push`, `npm publish` and any edit of the files that hold the rules and the pipeline (`ddd-ts-kit.config.json`, `eslint.config.mjs`, `biome.json`, `.dependency-cruiser.cjs`, `knip.json`, `lefthook.yml`, `.gitlab-ci.yml`, `.github/workflows/**`, `.claude/settings.json`, `.github/copilot/settings.json`) ask first |
| `.gitignore` | `node_modules`, `dist`, `coverage`, `.env`, `*.tsbuildinfo` and `.ddd-ts-kit/`, where `worker-scope` writes |

`--ci both` writes the two pipelines, `--ci none` neither (and no `renovate.json`). The pipeline
files are copies of the assets of the repository's `pipeline/` directory, shipped in
`templates/pipeline/`; a test fails when a copy differs from its source by more than its
documented placeholders.

An existing `.claude/settings.json` is never overwritten: the missing permissions are appended
to its lists, everything else is kept, and the notes of the command list what was added. The
`.env` rule relies on the gitignore semantics of permission patterns: `Read(./.env.*)` is
denied and `Read(!./.env.example)`, a negation placed after it in the same list, takes the
example file back out.

Every `.ts` file `init` and `generate` write imports by the alias (`@/platform/errors`),
never by a relative path; the barrel and a published-language index re-export by it too.

Scripts: `dev` (`tsx watch`, which resolves an alias from the `paths` of `tsconfig.json`,
with `.env` loaded by `--env-file-if-exists` and tracing preloaded),
`build` (the compiler, then `ddd-ts-kit build-aliases`), `start` (plain `node` on `dist/`), `typecheck`, `lint`, `lint:fix`, `test`, `test:e2e`, `check:arch`, `depcruise`,
`deadcode`, `quality`, `openapi:generate|check`, `events:generate|check`, `docs:generate|check`,
`db:generate`, `db:migrate`, `infra:up`, `infra:down`, `hooks:install`, `start:<context>` and
`start:worker` once `generate service` and `generate worker` wrote their entry, the `ci:*` scripts the
pipelines call, `test:coverage` (every spec once, each context and layer held to the thresholds of
`ddd-ts-kit.config.json`) and `verify`, which chains the whole baseline: typecheck, lint,
`format:check`, `test:coverage`, end-to-end tests, `check:arch`, `depcruise`, `deadcode`,
`docs:check`.

`package.json` carries two compilers: `typescript ~6.0.3`, which the tools load as a library,
and `@typescript/native` (`npm:typescript@~7.0.2`), which `build` and `typecheck` call by path
(`node node_modules/@typescript/native/bin/tsc`). `npx tsc` would run the older one.

`init` and `generate context` start with the language: the first entry of `next` is the glossary
of the context to fill in.

### Presets

`--preset identity` (on `init`, or on `generate context`; once per project) writes a whole bounded
context instead of an empty one: who the people of the application are, the organisations they
belong to and in which role. Accounts are provisioned from the identity provider at the first
sign-in (no password is kept), organisations (the tenants under `--tenancy shared-table`),
members with roles of a declared vocabulary, invitations by token with an expiry, delegations of
rights for a period; permissions, policies, the published language (member joined, role changed,
account deactivated...), a search, controllers, specs with builders and fakes, the adapters of
the ORM, and the port to the administration API of the identity provider, kept in line at least
once by the consumers of the published facts, with a Keycloak adapter given as a recipe (proven
against a server that answers as Keycloak does, not against Keycloak in the pipeline). Nobody
changes their own role or acts above it, whatever a delegation lends; a deactivated account
leaves its organisations; an address the provider did not verify provisions no account. On `init` without a `--context` of its name, the context `identity` is declared
`generic`. Every signed-in person holds the permissions of the context whatever `--authz` says:
the grant `'identity:*'` of `platform/auth/signed-in-grants.ts`, answered by
`SignedInGrantsAuthorizer` before the model in `createAuthorizer`. With tenants, the tables of
the context belong to none, under a decision record the preset writes, and with `--authn
keycloak` the authenticator reads the `organization` claim as the tenants of the person
(another authenticator gets a next step saying what to map). The preset is written for
`declared` with `signature` dependencies, `factories`, `throwing` value objects, `controllers`,
Knex or Drizzle on PostgreSQL, Zod or class-validator, Express or Fastify, and a token verifier
(`jwt` or `keycloak`); another stack is refused with what to change, and so is a second context
written from the same preset. Why, and which other contexts deserve one:
[Bootstrap with well-designed contexts](../../docs/guides/bootstrap-with-well-designed-contexts.md).

## generate (alias g)

```
ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]
ddd-ts-kit generate --help --json
```

One run of `generate` does five things, in this order, and writes nothing when the first one
refuses:

![One run of generate command: the name is checked against the glossary of the context (refused with exit code 2 and the --term to add when a word is not defined), the files are written from the templates, the new pieces are registered between marker comments, the derived documents are refreshed, and the places that need a business decision are printed as file:line](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-generate-one-run.svg)

In the example application, a use case named with a word its glossary does not define is refused,
and the message says how to go on:

```
$ npx ddd-ts-kit generate command notification ArchiveNotification --permission notification.archive --aggregate Notification
error: "ArchiveNotification" uses "archive", which the glossary of src/contexts/notification/CONTEXT.md does not define.
  fix: Either use an existing term (Notification, Send, Recipient, Contact, Confirmation, Reminder, Plan, Due, Withdraw, Mailer, Kind, Request, Rescheduling, Cancellation, Read, Search), or add the term in the same command: --term "Archive=<what it means for the business>". The glossary is written before the code (rule language/glossary-term).
```

With the term given in the same command (and `--dry-run`, which says what it would write):

```
$ npx ddd-ts-kit generate command notification ArchiveNotification --permission notification.archive --aggregate Notification \
    --term "Archive=To set a sent notification aside, out of the default search" --dry-run
would create src/contexts/notification/application/commands/archive-notification/archive-notification.command.ts
would create src/contexts/notification/application/commands/archive-notification/archive-notification.handler.ts
would create src/contexts/notification/test/unit/archive-notification.handler.spec.ts
would update src/contexts/notification/CONTEXT.md
would update src/contexts/notification/application/authorization/notification.permissions.ts
would update src/contexts/notification/notification.declarations.ts

Next, in this order: the language of the context first, then the business decisions only you can make
  src/contexts/notification/application/commands/archive-notification/archive-notification.command.ts:9  declare the input of "archive notification" as a constructor with the actor first, ...
  src/contexts/notification/application/commands/archive-notification/archive-notification.handler.ts:16  decide what "archive notification" does to a Notification: ...
  src/contexts/notification/test/unit/archive-notification.handler.spec.ts:38  replace each entry below by a test named after the business behaviour of "archive notification": ...
```

| Kind | Arguments | Writes |
|---|---|---|
| `context` | `<name> --classification <c> [--purpose "<two sentences>"] [--term ...]... [--upstream <ctx>[:relationship]]... [--preset identity]` | `CONTEXT.md` with its glossary, `published-language/index.ts`, config entry, registration in `platform/compose-application.ts` and in `test/architecture/extractable.spec.ts`; on tsyringe, with HTTP, `presentation/http/<name>.routes.ts` (a function of the two buses, in both styles); declared: the barrel `<name>.declarations.ts`; explicit and hand wiring: `<name>.module.ts`. `application/authorization/<name>.permissions.ts` is born with the first permission, or at once when `platform/auth/permissions.ts` lists the permission sets (rebac, custom). With `--preset`, the context is then written whole from that preset, its classification and purpose those of the preset unless the flags say otherwise ([Presets](#presets)) |
| `aggregate` | `<context> <Name> [--event-sourced]` | aggregate, builder, spec in given / when / then; with `--event-sourced`, an aggregate on `EventSourcedAggregate` whose state is the replay of its events, born with its `Created` domain event, the codec of its stored events in `infrastructure/persistence/<name>-events.mapper.ts`, a builder that replays a history and a spec given events, and a note naming the `EventSourcedRepository` its repository adapter delegates to |
| `builder` | `<context> <Aggregate>` | `test/builders/<name>.builder.ts`, a class extending `Builder` |
| `entity` | `<context> <Name>` | entity, spec |
| `value-object` (`vo`) | `<context> <Name>` | value object, spec |
| `vocabulary` | `<context> <Name> --value <value> [--value <value>]...` | `domain/vocabularies/<name>.vocabulary.ts`: an object `as const` of the values, keyed by each value in PascalCase, and the union type of the same name; run again, adds the values the file does not hold |
| `domain-event` | `<context> <Aggregate> <Fact>` | event named `<context>.<aggregate>.<fact>`, spec |
| `error` (`refusal`) | `<context> <Concept> <refusal> [--code CODE] [--term ...]...` | a static factory `<refusal>` on `domain/errors/<concept>.error.ts`, the class of the errors of that concept (created when absent, extending `ConceptError`), and its case in `test/unit/<concept>.error.spec.ts`. The factory is added after the last one; run again, the command changes nothing. `<Concept>` is a term of the glossary (`--term` adds it). The code is the name of the refusal in constant case, with the concept before it when the name is one word or a code of the kit (`Appointment notFound` sets `APPOINTMENT_NOT_FOUND`); `--code` takes one of the forms `errors/factory-name` accepts. Refused: a name such as `create` or `error1`, and a code already set in the context |
| `domain-error` | `<context> <Name> [--code CODE]` | one class per error with a stable code, spec: the form of a project whose config says `"stack.refusals": "classes"` or nothing. Refused under `factories`, with the `generate error` command to run instead |
| `domain-service` | `<context> <Name>` | service, spec |
| `state-machine` | `<context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]...` | the vocabulary `<Aggregate>Status` (created from `--value`, two states at least, or given the values it misses), `domain/state-machines/<aggregate>.state-machine.ts` (`<aggregate>Lifecycle`: every value a state, the first one initial, the transitions asked, a `TODO(domain)` for the refusal of the concept error) and `test/unit/<aggregate>.state-machine.spec.ts` (each transition where it leads, a refusal from a state it does not leave); the aggregate is left to use it |
| `repository` | `<context> <Aggregate> [--tenant-scoped]` | the port `domain/repositories/<name>.repository.ts` (`abstract class <Name>Repository extends Repository<<Name>>`), the adapter of the project's ORM (`implements` the port) with its mapper and table (or model), a fake, one `repositoryContract` spec run on both, registration |
| `command` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--aggregate <Name>]` | `<use-case>.command.ts` on `AuthorizedCommand` (plain `Command` when public), `<use-case>.handler.ts` (it builds the aggregate, saves it and answers: the events leave with the save), spec through the bus with the refusal of an actor who lacks the permission, registration with `.requires(...)` or `.public()` (and the repository when missing). A generated command answers `void` or the identifier of its aggregate, so no `<use-case>.result.ts` is written |
| `query` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--search]` | `<use-case>.query.ts` on `AuthorizedQuery` (plain `Query` when public), `<use-case>.result.ts`, `<use-case>.handler.ts`, the read port `application/ports/<use-case>-reader.port.ts` (an abstract class), its in-memory adapter, fake, spec, registration on the query bus. With `--search` (needs `--permission`): a kernel `PageRequest` in the query, the item, the sort and `Page<Item>` in the result file, a handler that asks `Access.scope` and hands the scope to the read port, an in-memory reader paging by offset or cursor |
| `port` | `<context> <Name>` | `application/ports/<name>.port.ts`, one abstract class, and its fake |
| `route` | `<context> <UseCaseName> --method <GET\|POST\|PUT\|PATCH\|DELETE> --path <p> [--command\|--query] [--group <Name>] [--mapper] [--serializer] [--cache public\|private\|no-store]` | under `"stack.routes": "controllers"`: a controller class in `presentation/http/<resource>/<use-case>/` (the resource is the first segment of the path), depending on `CommandBus` or `QueryBus`, behind the route group of its resource, written with it when it is new (`<resource>.routes.ts`: prefix, tag, `Authenticated`); a public use case stands in no group and says `guards: [Public]`; with class-validator one class per file (`<use-case>.params.ts`, `.body.ts`, `.answer.ts`, `.accepted.ts`, `.line.ts`); `--mapper` and `--serializer` add a request mapper and a serializer the controller is given; a spec; no registration in a declared project, a controller built by hand in `<context>.routes.ts` (the module file with hand wiring) in an explicit one. Under `"functions"`: a `defineRoute` function, its spec, its registration in `<context>.routes.ts`, and `<use-case>-<role>.dto.ts` classes |
| `controller` | the same arguments as `route` | the controller class, whatever `stack.routes` says: for a project of function routes that writes its next route as a class. `--cache` writes its cache policy: `private` (a `GET` of a caller, `max-age=0`, `must-revalidate`, strong `ETag`), `public` (a `GET` of a public use case, `max-age` 1m, `s-maxage` 5m, tagged with the resources of its path), `no-store`; refused on a write, and `public` behind a route group |
| `file-upload` | `<context> <UseCaseName> --path <p> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--method POST\|PUT] [--group <Name>]` | an upload: a controller that declares the file it receives (its size and media types in the contract, checked as it streams), the command that carries it as a `FileUpload`, staged by the command bus before the transaction, the handler that records it and promotes it with the commit, and their specs. Refused without `stack.storage` or without an HTTP stack, with the `init --force --storage local` to run |
| `route-group` (`group`) | `<context> <Name> [--prefix <path>] [--group <ParentName>] [--public \| --role <role>]` | `presentation/http/<name>.routes.ts`: an empty class carrying `@RouteGroup`, behind `Authenticated` unless `--public` or `--role` says otherwise (`HasRole(Role.Admin)`, the role read from the vocabulary of the platform, `<platformDir>/auth/role.ts`, which gets it when it does not hold it); with `--group` it refines that group and inherits from it |
| `guard` | `<context> <Name>` | `presentation/http/guards/<name>.guard.ts`: a declared guard class to fill, and its spec |
| `representation` | `<context> <UseCase> <xml\|csv\|media/type>[,...]` | adds `produces` to the `@Controller` of the use case, and `consumes: ['application/xml']` to one that receives a body when XML is asked; says when CSV needs a page or a streamed list, and when `stack.representations` is not `negotiated` |
| `form` | `<context> <UseCase>` | adds `const form = defineForm<Infer<typeof body>>({ ... })` before the `@Controller` of a use case that receives a body, and `form` to its options: the hints of its form at `GET /forms/<operationId>` |
| `schema` | `<context\|shared-kernel> <Name>` | `presentation/http/shared/<name>.schema.ts` of the context, or `presentation/<name>.schema.ts` of the shared kernel: one shape of the contract declared once (a zod schema with `.meta({ id })`, a class-validator class, or a schema wrapped by `sharedSchema`), to fill; the routes use it whole, nested or in part |
| `integration-event` | `<context> <Aggregate> <Fact> [--version n]` | `defineIntegrationEvent` declaration in the published language (its payload in `<event>.v<n>.payload.ts` with class-validator or a schema of your own), index export, the publisher `application/integration/publishers/<event>.publisher.ts`, spec, registration, a line of `platform/audit/audited-events.ts` |
| `integration-handler` (`consumer`) | `<context> <upstreamContext> <eventType>` | `application/integration/handlers/<name>.integration-handler.ts`, a class `<Name>IntegrationHandler` depending on `CommandBus`, its spec, its idempotent subscription under the consumer name `<context>.<name>`; refused unless the upstream is declared |
| `event-handler` | `<context> <Aggregate> <Fact> [--phase before-commit\|after-commit]` | reaction to a domain event of the context, spec, subscription; before the commit of the unit of work by default, after it with `--phase after-commit` (an effect no transaction covers, at most once), and the spec runs the reaction in that phase |
| `projection` (`projector`) | `<context> <Name> <event-type>` | a projector in `application/projections/<name>.projection.ts`, declared with `@Projection('<context>.<name>')` and one `@On(definition)` method for the integration event, which the context itself or a declared upstream publishes, and its spec; declared style only. It keeps one read model: its port is received in the constructor |
| `job` | `<context> <Name> (--every <duration> \| --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName>` | `application/scheduling/<name>.job.ts`, a class `<Name>Job implements ScheduledJob` that sends the command, as `systemActor('<context>.<name>')` when it is protected, with `execution.scheduledAt` when the command takes it; `test/unit/<name>.job.spec.ts`, which runs the job (by name on tsyringe, `application.jobs.runNow`; `job.run(occurrence)` with hand wiring) and asserts the command it sent; its registration; its switch in `platform/job-settings.ts`; the grant of its system actor (below) |
| `background-job` | `<context> <Name> --command <UseCaseName>` | `application/background/<name>.background-job.ts`, a class `<Name>BackgroundJob implements BackgroundJob<<Name>Payload>` named by its static `jobName` `<context>.<name>`, that sends the command as `execution.actor` when it is protected, followed by one field of `<Name>Payload` per other parameter of the constructor of the command (strings, numbers, booleans, literals and lists of them as written, a `Date` as its ISO text; anything else is refused); `test/unit/<name>.background-job.spec.ts`, which enqueues it with a payload of every field as a user holding the permission and runs what is due; its registration (`@Background()`, or `builder.backgroundJob(..)` in the module file). `--di tsyringe` only |
| `process` (`process-manager`) | `<context> <Name>` | `application/processes/<name>.process.ts` (its state, `processName`, `timeoutJob`, `isState`, a first step that arms a deadline, a step that ends it in time, the step of the deadline), `application/background/<name>-timeout.background-job.ts`, which delivers its timeouts through `ProcessRunner`, and the specs of both (`givenProcess`, the queue of the test application). `--di tsyringe` only |
| `acl` | `<context> <upstreamOrSystemName>` | translator in `infrastructure/anti-corruption/`, spec |
| `e2e` | `<context> <UseCaseName>` | `test/e2e/<use-case>.e2e.spec.ts` driving the route of the use case: 401 without a credential, 403 without the permission, the documented status with it; for a command, one more test asserts the trace of the request, exact on names and structure, with `installTestTracing()` and `expectSpanTree(storyOf(trace), [...])` of `@ddd-ts-kit/tracing/testing` (`POST /invoices`, then `command IssueInvoiceCommand`, then `repository InvoiceRepository.save`); needs the route |
| `policy` | `<context> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec; declared: the class carries `@Policy(permission, { name })` and nothing else is written; explicit: registration in `platform/auth/access-policies.ts` |
| `gateway` | `<context> <upstreamContext> <Name>` | the read contract in the upstream's published language (`<name>.contract.ts`, an abstract class and the token of the upstream value), the port `application/ports/<name>-gateway.port.ts`, an in-process adapter in `infrastructure/external/` bound `.as('gateway')`, a fake, one contract suite; refused unless the upstream is declared |
| `adapter` | `<context> <Port> [--kind external\|gateway] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts` for an existing port, its spec, and on tsyringe its binding `builder.bind(<Port>).toClass(Remote<Port>).as(<kind>).with(ownPolicy(retry(...), timeout(...)))`; with `--decorators`, on every stack, the class carries `@Retry` and `@Timeout` of `@ddd-ts-kit/aspects/decorators` on its one outbound method and is bound `.with(ownPolicy())`. Explicit: a port that is already bound, or hand wiring, gets a note instead of a binding. Declared: the class carries `@Adapter(<Port>, { kind, aspects })`, or `@Gateway(<Port>, { aspects })` in `remote-<port>.gateway.ts` with `--kind gateway`, and a port that already has a declared adapter is refused |
| `service` | `<context>` | `src/apps/<context>/main.ts` (kernel, platform, that context only, with its jobs: `jobSettings(process.env, '<context>')`), script `start:<context>`, a compose service behind the `services` profile, the knip entry, `deployable: true` in the config. The Dockerfile takes the entry as build argument `ENTRY` |
| `worker` | none | `src/apps/worker/main.ts`: the modules of `main.ts`, no HTTP server, no outbox relay, the jobs started whatever `RUN_JOBS` says, a graceful stop; script `start:worker`, a compose service `worker` behind the `services` profile, the knip entry, `"worker": true` in the config, and `RUN_JOBS` defaulting to `false` from then on, so the API stops running the jobs the worker runs. With several instances the lock has to be a real one: `--cache redis` binds the Redis lock, without it the generated README says the limit. A context named `worker` is refused |
| `adr` | `"<title>" [--deviation <what>] [--reason "<why>"]` | `docs/adr/NNNN-<slug>.md`; with `--deviation`, the `deviations` entry of the config that points to it |

- **The declared style, kind by kind.** No token anywhere: a list names port classes. `command`
  and `query` put `@Requires(<permissions>[...])` or `@Public()` on the message and
  `@CommandHandler(Message)` or
  `@QueryHandler(Message, [<UseCase>Reader])` on the handler; `repository` writes
  `@Repository(InvoiceRepository, [<storage>, ExecutionScope, Clock])`, the storage being
  `Database` of the platform (drizzle, prisma), `KnexContext` or `TypeOrmContext`; the in-memory
  adapter of a read port is `in-memory-<name>-reader.repository.ts`, a role file with
  `@Repository(<UseCase>Reader)`; `integration-handler` writes
  `@IntegrationEventHandler(definition, { consumer })` and is refused when the
  upstream does not declare the event; `event-handler` and the publisher of `integration-event`
  write `@DomainEventHandler(Event)`, attached under the `eventName` the event class declares (the publisher with
  `[IntegrationEventPublisher, IdGenerator]`), and both are found like any role file: the
  composition root lists no publisher; `job` writes `@Scheduled('<context>.<name>', schedule)`;
  `policy` writes a class with `@Policy(permission, { name })` and registers nothing; `gateway`
  writes `@Gateway(<Name>Gateway, [<Name>Contract])` and binds the upstream value in the marker
  regions of `platform/platform.module.ts` and `platform/platform-test.module.ts`: a value or a
  factory is what a decorator cannot say; `route` adds its function to
  `presentation/http/<context>.routes.ts`. A handler spec builds its test application from
  `platformTestModule`, `contextModule('<context>', <context>Declarations)`, an authorization
  module and fakes (`fake(InvoiceRepository, new FakeInvoiceRepository())`).
- **The explicit style, kind by kind.** The same files without decorators, and one line of the
  module file each: `builder.bind(InvoiceRepository).toClass(DrizzleInvoiceRepository, [Database, ExecutionScope, Clock]).as('repository')`,
  `builder.command(IssueInvoiceCommand).requires(...).handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock])`,
  `builder.on(definition, { consumer }).handledBy(Handler, [CommandBus])`,
  `builder.job('<context>.<name>', schedule).handledBy(<Name>Job, [CommandBus])`; a publisher and
  a domain event handler are bound under themselves and subscribed in the `start` region. With
  hand wiring (`--di manual`, `--di nest`) the module file is a function of the `Platform`:
  `platform.adapter(new DrizzleInvoiceRepository(...), { kind: 'repository', context, token })`,
  which gives the repository its span and the dispatch of what it saves,
  `platform.commands.register(Message, new Handler(...), { context })`,
  `platform.jobs.register({ name, schedule, run })`.
- **Jobs.** The schedule is validated when the job is generated, by the rules of the scheduler
  (`parseJobSchedule` of the kernel, pinned by a test): a duration (`15m`, `2s`, digits alone are
  milliseconds) or a five-field cron expression, with an IANA time zone; `--time-zone` without
  `--cron` is refused, and so is a job without `--command`, a command that does not exist (with the
  command that creates it) and a command whose constructor needs more than the actor and the
  instant the work is for: a job only says that the time has come, the handler finds what to act
  on. Parameters that are optional or have a default are left out of the call.
- **The grant of a job.** A job whose command is protected sends it as `system:<context>.<name>`,
  which has no right unless the model gives it one. `generate job` writes the grant where the model
  makes it one line, in a `system-grants` marker region, and `next` points at that line:
  `--authz rbac`, the id of the permission under the role `system` of `platform/auth/roles.ts`,
  the role `createAuthorizer` gives every system actor (`systemRole`); `--authz abac`, a
  `permit('system-<job>', [permission], ({ actor }) => actor.id === 'system:<job>')` rule in
  `platform/auth/attribute-policies.ts`; `--authz rebac`, the tuple
  `context:<context>#operator@system:system:<job>` in `platform/auth/relate-system-actors.ts`,
  written to the tuple store when the application starts, as long as the schema still lets a
  `system` subject operate a context. With `--authz custom`, a removed region, a remodelled
  relationship schema or a permission the generator cannot read, nothing is written and the job
  file carries the `TODO(domain)` naming the actor and the permission.
- **The barrel is derived.** `<context>.declarations.ts` holds one `export *` per role file, sorted
  by path, then one `injected(Class, [Tokens])` per class whose constructor takes something,
  read from its signature, with the imports they need. Every `generate`, and `docs`, rewrite it;
  `docs --check` and `check` (`declarations/barrel-current`) report one that a role file written
  by hand left behind or whose constructor changed since, naming the class
  (`stale  src/contexts/billing/billing.declarations.ts: the dependency list of IssueInvoiceHandler is stale: ...`).
  The `dev` script loads `ddd-ts-kit/dist/refresh-declarations.js` before the application, on
  every start and reload of `tsx watch`: a port added to a constructor is injected on the
  reload that follows the save. The same module is the binary `ddd-ts-kit-refresh-declarations`.
  It is laid out as Biome lays it out at a line width of 120; a project that formats at another
  width leaves `**/*.declarations.ts` and `**/*.dependencies.ts` out of its formatter.
- **Deny by default.** `command` and `query` are refused without `--permission` or `--public`. A new
  permission joins `<context>.permissions.ts`; its words are checked against the glossary like any
  other name. With `--authz rebac` the requirement names the context as its resource, a starting
  point to replace by the element the right bears on. With `--authz rbac`, `--grant <role>` gives
  the permission to the role in `platform/auth/roles.ts` (the role joins `role.ts` when it is
  new); without it, a `next` step says the grant is left to do (`authz/granted`).
- `route` hands `actorOf(context.principal)` to a protected use case and sets `security` (the scheme
  of `--authn`, or `false` for a public one). `integration-handler` carries `systemActor('<context>.<name>')`
  for the command it builds; behind a broker it listens on the subscriber of its context
  (`EventSubscribers.forContext`), its mark and its work in one unit of work.
- A generated repository adapter only persists: it takes `ExecutionScope` and `Clock`, never
  `ActorContext` nor a dispatcher, and stamps `created_at`, `created_by`, `updated_at`, `updated_by` with `stampCreation` and `stampUpdate`;
  the table uses `auditColumns` of the ORM package (the five fields are written out for Prisma).
  The sample fact of an aggregate is `registeredAt`, since `created_at` is the audit column.
  `repository --tenant-scoped` (drizzle and knex), and every repository of a project whose
  `stack.tenancy` is `shared-table`, adds `tenantColumn`, names the tenant on the insert and reaches
  the table through the helpers of the ORM package (`tenantTable` and `ownTenantTable` on Knex,
  `tenantCondition` and `ownTenantCondition` on Drizzle), with a spec that one tenant does not see
  another's rows. With another ORM the regular adapter is written and a note says what to add.
- `adapter --decorators` is accepted on every stack: the aspects decorators serve the standard
  mode and the legacy one a `tsconfig.json` with `experimentalDecorators` imposes.
- `route` of a `--search` query reads the page with `pageQuerySchema` and answers `pageSchemaOf` and
  `pageResponse`. A subscription of an integration event handler that is not a `builder.on` is
  written in the `start` region with `idempotent(...)` around `inEventScope(...)`.
- **The language first.** The name of an aggregate, entity, value object, domain service, domain
  event, command or query is refused when one of its words is not covered by a term of the
  `## Ubiquitous language` table of the context (plural, past participle and -ing forms are
  recognised). `--term "<Term>=<meaning>"`, repeatable, adds the rows in the same command.
  Technical words (`Manager`, `Helper`, `Data`, `Impl`, `Model`...) and an event fact that does
  not read as past tense are refused too. `--allow-name` overrides the three checks; `check`
  will still report what the glossary does not define.
- Generated code compiles as is and passes `check`, the ESLint preset, dependency-cruiser and knip
  at the default severities: one export per file, files far under 350 lines, `private` members,
  the blank-line layout. Every place that needs business knowledge carries a
  `// TODO(domain): ...` comment saying which decision is expected, and a place where an adapter is
  to be replaced a `// TODO(platform): ...` one; the only other comments say what the code cannot.
- Specs hold one real passing test where it can be written generically, and `it.todo` entries
  naming the behaviours to cover. No mock: fakes, builders, and the test application. On tsyringe a
  handler spec goes through `createTestApplication` of `@ddd-ts-kit/di` and observes the facts
  announced with the save with `application.domainEvents.on('<name>', ...)`; with hand wiring it
  goes through `createTestBuses()` of `@ddd-ts-kit/testing`, whose `dispatching(fake)` makes the
  save of a fake announce its events to `domainEvents`.
- `--json` prints `{ dryRun, created, updated, skipped, next, todos, notes }`. `next` lists the
  `TODO(domain)` places as `file:line`, the glossary first, then the lines a command wrote for the
  team to check (the grant of a job); `todos` adds their text.
- A kind that needs something else to compile either creates it (a missing repository or
  domain event) or stops with the command that creates it (a missing aggregate, use case or
  route).
- Registration goes between marker comments (`// ddd-ts-kit:<region>` ... `// /ddd-ts-kit:<region>`,
  HTML comments in Markdown). Remove a marker and the generator prints what to add by hand.
- Every `generate` refreshes the generated documentation and `.dependency-cruiser.cjs` when
  they exist; generating twice changes nothing.
- `--local-only` refuses, naming the files and writing nothing, when the run would write outside
  `<contextsDir>/<context>/` and `test/e2e/*.e2e.spec.ts`. `generate --help --json` prints every
  kind with its `usage`, `aliases`, `summary` and `writesShared`, plus `shared` and `sharedWhen`:
  what it writes outside its context, and when. Both serve a build split between workers (see
  `worker-scope`).
- A fake is an entry point for knip and may have no importer for dependency-cruiser: a port
  and its fake generated before a use case needs them fail neither analyzer. A domain service
  is kept alive by the spec generated with it.

Templates are plain files in `templates/<kind>/`, with `{{name.pascal}}`, `{{name.camel}}`,
`{{name.kebab}}`, `{{name.constant}}`, `{{context.kebab}}` placeholders and
`{{#if x}}` / `{{#unless x}}` blocks. An unknown placeholder is an error.

## docs

```
ddd-ts-kit docs [--check] [--stored-events]
```

Regenerates what is derived from the config and the code, and nothing else:

- `docs/context-map.md`, between `<!-- ddd-ts-kit:context-map -->` markers: a Mermaid diagram
  (one node per context styled by classification, one arrow per relationship from upstream to
  downstream labelled with the pattern) and the table of contexts with the first sentence of
  their purpose, upstreams, downstreams, published events and whether they are deployable alone. The text outside the markers is
  kept; on first creation the four written sections are laid out with hints.
- the generated lists of every `CONTEXT.md` (aggregates, published events, permissions, scheduled
  jobs as a table of name, schedule and command, relationships);
- the generated file of every declared context: the barrel `<context>.declarations.ts`, with
  what each constructor is injected, read from its signature, or under discovery
  `<context>.dependencies.ts`, which holds that alone;
- the reference of every `CONTEXT.md`: the facts of `describe`, as tables under `## Reference`,
  between `ddd-ts-kit:reference` markers; a `CONTEXT.md` that has no such section gets it after its
  last generated list;
- `docs/integration/README.md`, created once and never rewritten; its Provider section starts with
  the strategy of the chosen broker.

`--stored-events` also records in `stored-events.lock.json` the shape of each version of a stored
event declared in the codecs of `infrastructure/persistence/`, never rewriting a recorded version:
run it once the shape of a version is final.

`--check` writes nothing, names each stale file and each declared stored-event version not
recorded in `stored-events.lock.json`, and exits 1. The event catalog and the
AsyncAPI document need the code of the project to run, so they are produced by
`scripts/events.ts` (`npm run events:generate`, part of `npm run docs:generate`).

## sdk

```
ddd-ts-kit sdk [--check] [--dry-run]
```

Generates the typed client of each document of the OpenAPI contract, read from the committed
`openapi/*.yaml` (or `.json`): a workspace package under `clients/<document>` (`clients/api` for
the whole contract), with no runtime dependency. Each operation is a method of `createClient()`
and a function of its own; its outcome is typed by status, a refusal by the error codes the
contract lists for it (`x-error-codes`); a credential is given per security scheme. The first
run records `"sdk"` in the config (`init --sdk` does it for a new project) and wires the
project: the workspace, the `paths` entry of each client in `tsconfig.json`, the exclusions of
Biome and knip, the scripts `sdk:generate` and `sdk:build`, and `docs:generate`, `docs:check`,
`ci:docs`, `ci:build` extended. The package.json of a client keeps its version and the keys a
team adds. Under npm, while `package-lock.json` does not list a client yet, it says to run
`npm install` and commit the lock, which `npm ci` would refuse. `--check` writes nothing, names
each stale file (and a client the lock misses) and exits 1. The comparison with
openapi-typescript, hey-api and orval, and how to publish a client:
[docs/tools/client-sdk.md](../../docs/tools/client-sdk.md).

## depcruise-config

```
ddd-ts-kit depcruise-config [--check | --write]
```

Prints the dependency-cruiser configuration derived from `ddd-ts-kit.config.json`: layers,
published languages, declared upstreams, allowed packages, cycles and orphans. `--write` saves
it as `.dependency-cruiser.cjs`; `--check` exits 1 when the file is missing or stale, which is
what `npm run depcruise` runs first. Edit the config, not the file.

## value-objects

```sh
ddd-ts-kit value-objects [--dry-run]
```

Moves the value objects of a project from a `Result` to factories that return the value or
throw (`"stack.valueObjects": "throwing"`). What it rewrites, and what it leaves to a person, is
in [CONFIG.md](../../docs/CONFIG.md#stack).

## controllers

```sh
ddd-ts-kit controllers [<context>] [--dry-run]
```

Moves the function routes of a project, or of one context, to controller classes
(`"stack.routes": "controllers"`). For each `presentation/http/<name>.route.ts`:

- the controller is written to `presentation/http/<resource>/<name>/<name>.controller.ts`, the
  resource being the first segment of its path: the declaration keeps the method, the summary,
  the schemas, the one response with its description and the error codes; the handler becomes
  `handle`, with the actor read from the request and the answer returned without its status;
- one route group per resource is written (`<resource>.routes.ts`: its prefix, the tags of its
  routes, `Authenticated`, and `FORBIDDEN` when every route declared it); a route with
  `security: false` stands in no group and says `guards: [Public]`;
- the schema files named after the route follow it (`<name>-body.dto.ts` becomes
  `<name>.body.ts`), the others go to `shared/` under their name, and every import of a moved
  file is rewritten;
- the spec becomes `<name>.controller.spec.ts` and runs the controller without its guards;
- in a declared project the list `<context>.routes.ts`, its spec and its line in the
  composition root are removed; in an explicit one the list builds each controller by hand;
- the config says `controllers` once no function route is left in the contexts.

A context is turned whole or not at all. A route that is not written as
`export function <name>Route(<bus>): Route { return defineRoute(spec, async (input) => { .. }); }`,
that declares several responses, or whose handler answers anything else than
`{ status, body }` is named with the reason and its context is left as it is: function routes
keep running next to controllers. The command ends with what is left to a person: run the
formatter and `ddd-ts-kit docs`, move the helpers a controller kept to a request mapper or a
serializer, give the groups their guards, hold the guards in the specs.

## error-factories

```
ddd-ts-kit error-factories --plan
ddd-ts-kit error-factories --apply [--dry-run]
```

Moves a project from one class per error (`new SlotTakenError(..)`) to static factories on one
error class per concept (`AppointmentError.slotTaken(..)`), in two steps, because which concept
a refusal is about is a decision of the model.

`--plan` writes `error-factories.plan.json`: per context, one entry per class of
`domain/errors/` that extends `DomainError`, with its code, the concept proposed for it (the
aggregate its name starts or ends with, empty when none does) and the factory name that says
its code (`APPOINTMENT_NOT_FOUND` on `Appointment` gives `notFound`). Edit it: every entry
needs a `concept`, a term of the glossary.

`--apply` follows the plan and refuses an entry without a concept, a vague factory name or one
that does not say the code. It:

- writes `domain/errors/<concept>.error.ts`, a class extending `ConceptError` with one factory
  per class moved there: the parameters of the constructor, the message it gave to `super`, and
  as facts the parameters that are plain data (text, numbers, booleans, dates);
- removes each class and its spec, whose cases go under `describe('<factory>')` in
  `test/unit/<concept>.error.spec.ts`;
- rewrites every file under the source root and `test/`: `new X(..)` becomes
  `<Concept>Error.<factory>(..)`, `thenError(X)` and `thenError(X, code)` become
  `thenError('<CODE>')`, `toThrow(X)` and `expect.any(X)` become an assertion on the code,
  `toBeInstanceOf(X)` becomes `toMatchObject({ code })`, `e instanceof X` becomes
  `<Concept>Error.is(e, '<CODE>')`, an import of the class becomes the import of its concept
  class, and a type names the concept class. A class of the same name in two contexts goes to
  the concept of its own. Comments and strings are left alone;
- sets `"stack.refusals": "factories"` in the config.

It leaves, and says: a class that has members of its own, reads `this` in its constructor or
gives options to `super` (written by hand); a place where a class stood as a value it cannot
translate; a property of the error that became a fact (`error.personId` is now
`error.facts.personId`); a factory with more than three parameters. And always: which facts a
client may read (none is exposed), the factories that still take a sentence as only parameter,
and the facts to assert in the specs. Run the formatter afterwards. Run again, it finds nothing
left to move. `--json` answers `{ dryRun, moved, written, removed, manual }`.

## build-aliases

```
ddd-ts-kit build-aliases [--project <tsconfig>]
```

The second step of `npm run build`, after the compiler. The compiler emits an import alias as
it was written (`@/platform/errors`), and Node resolves no alias and completes no extension:
this command rewrites, in every `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts` and `.d.cts` under the
output directory of the tsconfig (`tsconfig.build.json` by default), each alias specifier into
the relative path of the emitted file it names, with its `.js` extension
(`../../platform/errors.js`), so that `node dist/src/main.js` runs with no loader and no flag.

```js
// dist/src/contexts/billing/domain/aggregates/invoice.aggregate.js, as the compiler emits it
import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';

// the same line after ddd-ts-kit build-aliases
import { InvoiceError } from '../errors/invoice.error.js';
```

It reads `importAlias` and `importExtension` of the config: `@/platform/errors` names
`platform/errors.js` under `none`, `@/platform/errors.js` names it under `js`, and no other
spelling is guessed.

- Rewritten: the specifier of `import ... from`, `export ... from`, a bare `import`,
  `import('...')` and `require('...')` with a string literal, `import.meta.resolve('...')`, and
  in declarations `import type`, `typeof import('...')` and `declare module '...'`.
- Exact: the file is scanned, not searched; a string that only looks like an import, in other
  code, a comment, a template or a regular expression, is left alone. Lines never move and the
  source maps are not touched.
- Idempotent: a second run rewrites nothing.
- It exits 2 and writes nothing when an alias names no emitted file, when it names a directory
  (an alias names one file: `.../published-language/index`), when it is written in the spelling
  the config does not ask for, when `import()` is given an alias completed at run time (a
  template with an interpolation, a concatenation), or when the output directory does not
  exist. Each refusal says the file, the line and what to write instead.
- A package is never touched, whatever its subpath ends with (`zod/v4/core.js`,
  `@scope/package/file.js`, `node:fs`).

`--json` answers `{ outDir, files, changed, specifiers }`. `ddd-ts-kit check` reports a script
that compiles without this step (`imports/alias-declared`). The whole mechanism:
[docs/tools/import-aliases.md](../../docs/tools/import-aliases.md).

## list

```
ddd-ts-kit list [--context <name>]
```

`--context` restricts the answer to one context. Contexts with their classification, glossary size, upstreams, aggregates, commands, queries,
domain events, published events, integration event handlers, scheduled jobs (name, schedule, the
command each sends; `jobs` in `--json`), builders, permissions, policies, gateways and whether the
context is deployable alone, then the end-to-end specs. In the declared style the use cases, the
handlers, the policies, the gateways and the adapters are read from the decorators: a command or a
query shows what it requires (or `public`), a handler its consumer name and its event, a policy its
permission, an adapter its port; `--json` adds them under `declarations`. In the explicit style the
jobs are read from the `builder.job(...)` and `platform.jobs.register(...)` lines of the module file.

## describe

```
ddd-ts-kit describe <context>
```

One context as facts read from the config and the source text, in both styles: use cases with
their permission (or `public`), routes (method, path, operation id, use case, schema names, error
codes, the media types they answer and read in besides JSON, their form), consumed and published events, ports with their adapters, policies, gateways with their
upstream, scheduled jobs, upstreams and downstreams. Field lists are not guessed: they are in
`openapi/openapi.yaml` and `docs/integration/event-catalog.md`. `docs` writes the same facts in
each `CONTEXT.md`.

`--json` prints one object:

| Key | Value |
|---|---|
| `name`, `classification`, `purpose`, `deployable`, `doc` | the context, its purpose (empty until written) and the path of its `CONTEXT.md` |
| `glossary`, `aggregates`, `domainEvents`, `permissions` | names |
| `upstreams`, `downstreams` | `{ context, relationship }` |
| `useCases` | `{ kind, name, permission, file }`, `kind` being `command` or `query` |
| `routes` | `{ method, path, operationId, useCase, permission, request: [{ part, schema }], responses: [{ status, schema }], errors, file }`, and `produces`, `consumes` (media types besides JSON) and `form` (`GET /forms/<operationId>`) when the route declares them |
| `consumedEvents` | `{ type, version, from, handler, consumer, file }` |
| `publishedEvents` | `{ type, versions, publishers }` |
| `ports` | `{ name, kind, adapters, file }`, `kind` being that of its binding (`repository`, `external`, `gateway`) |
| `policies` | `{ name, permission, file }` |
| `gateways` | `{ name, upstream, adapters, file }` |
| `jobs` | `{ name, schedule, command }` |
| `contracts` | `{ openapi, eventCatalog }`: where the field lists are |

## status, todo

```
ddd-ts-kit status
ddd-ts-kit todo [<context>]
```

`status` prints the `Next:` line of `docs/architecture/plan.md`, the rows of
`docs/architecture/slices.md` by status and by owner, and per context the `TODO(domain)`,
`TODO(platform)` and `it.todo` left, then those outside the contexts. A missing file is not an
error. `--json` prints `{ next, slices, remaining }`: `next` and `slices` are `null` when their
file is missing, `slices` holds `{ file, rows, byStatus, byOwner }`, `remaining` one
`{ context, domain, platform, test }` per context, and one with an empty `context` for what is
left outside them.

`todo` lists those markers as `file:line` with their kind and their text, in the project or in one
context; `--json` prints `{ count, remaining: [{ kind, context, file, line, text }] }`.

## worker-scope

```
ddd-ts-kit worker-scope <context> [--worktree <path>] [--branch <name>] [--dry-run]
```

Prepares the place of one worker of a build split by context: creates a git worktree of the
project (`../<project>-<context>` by default) on the branch `build/<context>`, writes
`.ddd-ts-kit/worker.json` in it (`{ "context": "<context>" }`; `init` ignores `.ddd-ts-kit/`), and
prints the briefing of the worker: its scope, the generators it may run, its slices still to do
from `docs/architecture/slices.md`, the published languages it consumes. An existing worktree is
kept and only the file is written again; `--dry-run` creates and writes nothing. It needs a git
repository with one commit at least. The worker then generates with `--local-only`.

## affected

```
ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
```

What a pull or merge request has to run, read from the context map and the paths that differ
between `--base` and `--head` (`HEAD` by default; the merge base is used when the clone has it).
Each changed path reaches something:

- a path under a declared context reaches that context and every context downstream of it, since
  their code may read its published language; a path under its `test/` alone reaches that
  context alone, since no other context may import its tests;
- a document reaches nothing that runs: a Markdown file at the root, anything under `docs/`,
  `openapi/`, `.claude/`, `.github/instructions/` or `.github/copilot/` (the documents gate
  always runs);
- anything else reaches everything: the platform, the shared kernel, `main.ts`, the config, the
  lockfile, the pipeline, a directory of `src/contexts/` the config does not declare.

Without `--base`, or when git cannot tell what changed (an unknown ref, a shallow clone without
the base), everything is selected: that is what the default branch and the nightly run get. The
selection is never narrower than the declared relationships, because `context/declared-relationship`
keeps every import between contexts inside them, and that rule runs on the whole project in every
pipeline.

![A change in the scheduling context of the example application: scheduling is selected, and so are notification and analytics, which are downstream of it in the context map; identity, upstream, is left to the default branch](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-affected-selection.svg)

In the example application, a branch that changes one aggregate of `scheduling`:

```
$ npx ddd-ts-kit affected --base main
Affected contexts: scheduling, notification, analytics (the changed contexts and the contexts downstream of them in the context map).
Specs: src/contexts/scheduling/**/*.spec.ts src/contexts/notification/**/*.spec.ts src/contexts/analytics/**/*.spec.ts !src/contexts/**
Left to the default branch: src/contexts/identity/

$ npx ddd-ts-kit affected --base main --format github
scope=contexts
contexts=scheduling,notification,analytics
args=--passWithNoTests
lint=--ignore-pattern src/contexts/identity/
```

`--format github` writes `key=value` lines for `$GITHUB_OUTPUT`, `--format env` the same keys in
upper case behind `AFFECTED_` for a GitLab `dotenv` report, `--json` the selection as data
(`{ scope, reason, contexts, specs, leftOut }`). `contexts` is what the test runner reads as
`DDD_TS_KIT_AFFECTED`, `args` what a partial run adds to it, `lint` what it adds to ESLint; the
generated pipelines wire all three.

## check

```
ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab]
                 [--changed-since <git-ref>] [--self]
ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
ddd-ts-kit check --commit-size [--staged] [--strict]
```

Each violation has a rule id, a severity, a file, a line, a message and a `fix`: one sentence
saying what to do instead. Exit code 1 when there is at least one error. Suppose that the
`Reminder` aggregate of the example application read the system clock in its domain: an `isDue()`
at line 63 that calls `Date.now()`, where the real one receives the instant as `isDue(asOf: Date)`.
`check` would report:

```
$ npx ddd-ts-kit check src/contexts/notification/domain
src/contexts/notification/domain/aggregates/reminder.aggregate.ts:64  error  purity/no-system-clock
  Date.now() is used in the domain layer.
  fix: Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock.

1 error, 0 warnings, 0 suppressions in 772 files.
```

The `fix` is the change to make. Instead of that hypothetical method:

```ts
isDue(): boolean {
  return this.state.status === ReminderStatus.Planned && this.state.dueAt.getTime() <= Date.now();
}
```

write:

<!-- checked sample -->
```ts
import { Clock, FixedClock } from '@ddd-ts-kit/kernel';

// domain: the instant is a parameter, as in the Reminder aggregate of the example
export class Reminder {
  constructor(private readonly dueAt: Date) {}

  isDue(asOf: Date): boolean {
    return this.dueAt.getTime() <= asOf.getTime();
  }
}

// application: the handler takes the instant from the Clock port
export class SendDueRemindersHandler {
  constructor(private readonly clock: Clock) {}

  isDueNow(reminder: Reminder): boolean {
    return reminder.isDue(this.clock.now());
  }
}

// a test fixes the time
const handler = new SendDueRemindersHandler(new FixedClock(new Date('2026-03-02T09:00:00Z')));
const due = handler.isDueNow(new Reminder(new Date('2026-03-01T09:00:00Z'))); // true
```

`ddd-ts-kit explain <rule-id>` prints the same kind of bad and good example for every rule.

- `paths` and `--changed-since` limit what is reported, not what is analysed.
  `--changed-since` runs `git diff --name-only --relative <ref>...` in the project.
- `--format github` prints `::error file=...,line=...::` annotations.
- `--format gitlab` prints a GitLab Code Quality report: one issue per violation, `major` for
  an error and `minor` for a warning, with a fingerprint that does not depend on the line.
- Severities come from `rules` in the config (`error`, `warn`, `off`). Default `error`, except
  `test/no-mocks`, `test/builder-required`, `clean/function-size`, `clean/no-noise-comment`,
  `clean/no-flag-argument`, `standard/no-parallel-interface` and, held by ESLint,
  `application/command-query-separation` (`warn`). `any` in a test file is
  always a warning.
- `limits: { "maxParameters": 3, "maxFunctionLines": 30 }` in the config sets
  `clean/function-size`. `maxFunctionLines` goes from 1 to 100: a value above is read as 100 and
  reported by `config/valid`, and a function of more than 100 lines is an `error` whatever the
  severity of the rule (only `off` silences it). `clean/file-size` (350 lines) is not configurable.
- `onePerFile: { "allow": [{ "file": "<path or glob>", "reason": "<why these exports are one thing>" }] }`
  exempts files from the count of `clean/one-export-per-file`, never from its file name check;
  `*` matches inside one path segment, `**` across segments; an entry without a reason is ignored
  and reported by `config/valid`.
- `domainAllowedPackages`, `applicationAllowedPackages` and `publishedLanguageAllowedPackages`
  extend what the inner layers may import. `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`,
  `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` and `@ddd-ts-kit/tracing`
  stay refused in `domain/` and `application/` even when a list names them.
- `standardInterfaces: { "<DeclaredName>": "<kernel interface to use instead>" }` in the config
  adds names to `standard/no-parallel-interface` over its defaults; the value `false` drops a
  default name.
- Suppress one line with `// ddd-ts-kit-disable-next-line <rule-id> -- ADR-0007: <reason>`. Without a
  reason the comment is itself a violation, and so is a reason that names no existing decision record. On the first line of a file it also covers
  file-level violations.
- `--clean-only` runs the rules that judge a file on its own (`clean/stepdown`,
  `clean/function-size`, `clean/no-commented-out-code`, `clean/no-noise-comment`,
  `clean/no-escape-hatch`, `clean/no-hash-private`, `clean/blank-lines`, `clean/braces`,
  `clean/one-export-per-file`, `clean/file-size`) on any directories, without a project or a config.
- `--self` replays the rule fixtures shipped with the CLI and exits 0 when every rule behaves
  as expected.

| Rule | Detects |
|---|---|
| `layer/domain-purity` | in `domain/`: a package outside `domainAllowedPackages`, any Node built-in, another layer, another context; any entry of `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` or `@ddd-ts-kit/tracing`, allowed or not; `@ddd-ts-kit/kernel/declarations`, although the kernel is allowed: the domain declares nothing |
| `layer/application-inward` | in `application/`: `infrastructure/`, `presentation/`, the platform, a package outside the allow-list, a Node built-in; any entry of `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` or `@ddd-ts-kit/tracing`, allowed or not, with where the concern belongs (the composition root, a bus middleware, an adapter, a port) |
| `layer/presentation-no-infrastructure`, `layer/infrastructure-no-presentation` | the forbidden import, inside one context |
| `context/published-language-only` | an import of another context outside its `published-language/` |
| `context/declared-relationship` | an import of a published language whose context is not a declared upstream |
| `context/published-language-is-a-contract` | `published-language/` importing anything but its allow-list and other published languages |
| `context/no-cycle` | a cycle in the declared upstreams, with its path |
| `tree/closed` | a directory outside the canonical tree and `extraDirectories`; a source file outside a role directory; in the declared style `<context>.declarations.ts` is accepted at the root of a context |
| `tree/context-doc` | a missing `CONTEXT.md`, a missing section, a classification that contradicts the config |
| `naming/suffix` | a file without the suffix of its role, or not in kebab-case. `application/scheduling/` holds `*.job.ts`; a use case folder accepts `*.result.ts` next to its message and its handler; `presentation/http/<context>.routes.ts`, named after its context instead of a role, is accepted in both styles |
| `naming/one-concept-per-file` | several exported classes in an aggregate, entity, value object, event, command, query, handler, event handler, integration event handler or job file; in the declared style, several classes carrying a declaration decorator in one role file |
| `naming/search-not-list` | in a context, a method named `list` or `list<Something>` in a port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`), in a class of `infrastructure/` or in a fake of `test/fakes/`; under `application/queries/`, a folder or a file named `list`, `list-...` or `list....`, or a class named `List` or `List<Something>`. Properties and `listAccessible` (required by the `Authorizer` port) are not judged. Name them `search...`: `generate query <context> Search<Things> --search` |
| `naming/business-name` | in `domain/` and `application/` of a context and in the shared kernel outside `presentation/`, a variable, loop variable, destructured binding, parameter or property named with a generic word (`target`, `data`, `item` and the other words of the list, which `businessNames` of the config changes); the fix names the concept an initializer builds or reads when the text says it, and `npx eslint --fix` renames it |
| `test/spec-required` | an aggregate, value object, domain service, handler, domain event handler, integration event handler or job without a spec (a `*.result.ts` needs none) |
| `test/no-mocks` | `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins, or a mocking library in a context's tests |
| `test/builder-required` | an aggregate without `test/builders/<name>.builder.ts` |
| `events/name-format` | an event name that is not `<context>.<aggregate>.<fact>` in kebab-case with the right context |
| `events/name-declared-once` | a class of `domain/events/` without `static readonly eventName`, or whose `readonly name` writes the name again instead of reading it |
| `events/defined-in-published-language` | `defineIntegrationEvent` outside a published language, without a payload, twice for one version; an event described by hand |
| `language/glossary-term` | a class of the model named with a word the glossary of its context does not define; an empty glossary; under `"stack.refusals": "factories"`, an error class of `domain/errors/` too |
| `language/declared-vocabulary` | a string literal whose value is a value of a closed vocabulary the project declares (an object `as const` exported with the union type of its name, a permission set of `definePermissions`), outside the file that declares it, in the place that speaks its language (its context; the platform and the route groups for the platform; everywhere for a permission id or the shared kernel); tests, published languages and the relationship schema are not judged; under `"stack.literals": "named"` |
| `language/no-technical-name` | `Manager`, `Helper`, `Util`, `Utils`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` in a type declared under `domain/` or in a use case folder |
| `purity/no-system-clock` | `new Date()` without argument, `Date.now()`, `performance.now()` in `domain/` or `application/` |
| `purity/no-ambient-randomness` | `Math.random`, the random source of `crypto`, an id library |
| `purity/no-environment` | `process.env` and friends, `console`, `fetch`, file system and network modules |
| `clean/stepdown` | a private method before the last public one or above its first caller; a non-exported function above its first use |
| `clean/function-size` | more parameters or body lines than the limits (constructors are exempt from the parameter limit, module files and `describe` callbacks from the line limit); any function of more than 100 lines, those included, reported as an `error` |
| `clean/no-commented-out-code` | comment lines shaped like statements |
| `clean/no-noise-comment` | banners, closing-brace labels, authors and dates, empty `@param` and `@returns`, a comment that only repeats the declared name, a `TODO` without owner or reference |
| `clean/no-escape-hatch` | `any`, a non-null assertion, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` or `eslint-disable` without a reason |
| `clean/no-flag-argument` | a `boolean` parameter on a public method of a domain class or on `execute` |
| `clean/no-hash-private` | a `#name` class member: field, method, accessor, static |
| `clean/blank-lines` | an approximation of the layout ESLint and the formatter hold: a `return` whose previous line is neither blank, nor an opening brace, nor a `case` label; a blank line right after an opening brace or right before a closing one |
| `clean/braces` | an `if`, `else`, `for`, `while` or `do` whose body has no braces or shares a line with them, an `else` on a line of its own; an approximation of what ESLint (`curly`) and the formatter hold |
| `clean/one-export-per-file` | under the source root, tests apart: more than one exported class, interface or function that the allowances do not explain (the types of the signature of the main export, a type and a value sharing one name, a type with its constructors, the accessors of one private state, `onePerFile.allow`); a file not named after its main export in kebab-case (`invoice.aggregate.ts` for `Invoice`); an `index.ts` or a `<context>.declarations.ts` that holds anything but re-exports |
| `clean/file-size` | a file of more than 350 lines, sources and tests; a path with a segment `generated` and declaration files are exempt |
| `composition/only-in-module` | `new X`, or `bind(..).toClass(X, ..)` and `rebind(..).toClass(X, ..)`, of a class imported from `infrastructure/`, outside the module file, `main.ts`, the platform and tests; in a file importing `@ddd-ts-kit/di`, a call of `contextModule`, `discoverContext` or `.include(` outside those places and `apps/<context>/main.ts` |
| `imports/alias-only` | under the source root, `test/` and `scripts/`: an `import`, `export ... from` or `import()` with a relative specifier, the same directory included (the fix names the alias to write; `eslint --fix` writes it); an alias specifier with a `.` or `..` segment |
| `imports/extension` | under the source root, `test/` and `scripts/`: with `importExtension` `none`, an alias specifier that ends with `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` or `.cts`, or that names a directory holding an `index.ts`; with `js` (or no key), an alias specifier that does not end with `.js` (the fix names the specifier to write; `eslint --fix` writes it). A package subpath is never judged |
| `imports/alias-declared` | an `importAlias` that is not `@/` or `$<name>/`, or that is `$test/`, `$scripts/`, `$generated/`; a `paths` entry of `tsconfig.json` missing or different from what `importAlias` gives (the fix gives the entry); another `paths` entry under an alias; a `baseUrl`; a `tsconfig.build.json` whose `paths` differ; `paths` of `knip.json` mapping an alias; a script that compiles (`tsc` without `--noEmit`) and does not run `ddd-ts-kit build-aliases` afterwards; a script running `tsx --tsconfig` on another file; a `vitest` config at the root without `tsconfigPaths: true`, a `jest` config without the derived `moduleNameMapper` entries, or `.dependency-cruiser.cjs` without `tsConfig`; `module` and `moduleResolution` of `tsconfig.json` (or of a `tsconfig.build.json` that sets its own) that are not what `importExtension` gives: `ESNext`, `Bundler` and `customConditions` holding `node` under `none`, and under `js` a written value that is not a Node resolution; a jest mapping whose pattern does not end as the imports do. A project without `package.json` is not judged |
| `config/valid` | unknown upstream, classification, relationship, rule id, `guard` mode or `importExtension`; a context missing on disk or in the config; a `commit` limit that is not a positive integer |
| `config/suppression-needs-reason` | a suppression without a rule id or a reason (kept as an alias next to `governance/recorded-deviation`, which judges the reason) |
| `authz/declared` | in a module file, `builder.command(X)` or `builder.query(X)` without `.requires(` or `.public(` in its chain, unless the message class carries `@Requires` or `@Public` of `@ddd-ts-kit/kernel/declarations`; with manual or nest wiring, a command or query class absent from every `requires(X, ...)` and `publicUseCase(X)` of the module file and of `application/authorization/`; a `defineRoute` without `security` (the route type refuses it already, and an empty list too: this is the text-level net for a definition built loosely); in the declared style, the exported class of a `*.command.ts` or `*.query.ts` file carrying neither `@Requires` nor `@Public` |
| `authz/granted` | with `stack.authz` `rbac`, a permission of a context's `definePermissions` that neither `platform/auth/roles.ts` nor `platform/auth/signed-in-grants.ts` grants by name (by the entry of its set, its id or `<context>:*`); the super-admin `*` does not count (a warning) |
| `authz/in-application` | `presentation/`: a test on roles, `isAdmin`, the import of an authorizer or of `Access`; `infrastructure/`: `authorize(` or `check(` on an authorizer or access, `ForbiddenError`; `domain/`: any import of `@ddd-ts-kit/auth`, of the actor types of the kernel (`Actor`, `ActorContext`, `Session`, `ExecutionContext`, the authorized messages), a read of `.roles` or `.permissions` on an actor. The request glue of `@ddd-ts-kit/auth` (`actorOf`, `sessionOf`, `resolveSession`, `SessionAuthenticator`) is free in `presentation/`. `presentation/` and `infrastructure/`: the import of `Requires`, `Public` or `Policy` from `@ddd-ts-kit/kernel/declarations`, or of the ports `Access` and `PolicyAccess` from `@ddd-ts-kit/auth`; they are free in `application/` |
| `authz/actor-explicit` | in `domain/` and `application/`: `ActorContext`, `ExecutionScope` (as a type or as a value: the class is the token of a dependency list), `AsyncLocalStorageExecutionScope`, `ScopedActorContext`, `AsyncLocalStorage`; `.current()` or `.require()` on an actor context or on something named `scope`, `scopes` or `...executionScope`; an import of `stampCreation`, `stampUpdate` or `tenantScopeOf` |
| `authz/fields-by-schema` | under `application/queries/`: `roles.includes(`, `.some(`, `.every(`, `.find(`, `.indexOf(`, a comparison with a `role`, `isAdmin` |
| `aspects/outside-in` | an import of `@ddd-ts-kit/aspects/decorators` outside `infrastructure/` of a context and the platform directory: `presentation/`, the module file, `published-language/`, the shared kernel, `main.ts`, any other source (`domain/` and `application/` are reported by the two `layer/*` rules instead) |
| `tracing/platform-only` | an import of `@ddd-ts-kit/tracing` or of an `@opentelemetry/*` package outside the platform directory, `main.ts` and `apps/`, tests included |
| `tenancy/scoped-statement` | with `stack.tenancy` other than `none`, in `infrastructure/` of a context, tests aside: on Knex the executor used other than as an argument (`executor()(`, `executor().from(`, `executor().raw(`, `const db = ...executor();`) and any `.raw(`; on Drizzle, statement by statement, a read, update or delete on the executor whose where has no `tenantCondition(` nor `ownTenantCondition(` (inline or in the local it is given), an insert whose row has no `tenantScopeOf(`, a relational query (`executor().query`), a raw `execute(`, or the executor held in a variable; on both, a read model store built without its `tenant` option. A where built by another function is not followed |
| `standard/no-parallel-interface` | a class, interface or type alias declared as `ILogger`, `AppLogger`, `LoggerService`, `LoggerInterface`, `IMetrics`, `MetricsService`, `ICache`, `CacheService`, `UserContext`, `CurrentUser`, `AuthContext`, `RequestContext` (outside `presentation/` and the platform), `UserSession`, `AuthSession`, `SessionData`, `PaginatedResult`, `PageResult`, `PaginatedResponse`, `Paginated`, `PaginationParams`, `PageParams`, `AuditLog`, `AuditLogEntry`, `AuditRecord`, `IJobScheduler`, `JobSchedulerService`, `CronScheduler`, `TaskScheduler`, `IScheduledJob`, `CronJob`, `ScheduledTask`, `BackgroundJob`, `IErrorReporter`, `ErrorReporterService`, `ErrorTracker`, `ExceptionReporter`, `CrashReporter`, `CacheInvalidator`, `CacheInvalidationService`, `CachePurgeService`, `CdnPurger`, `I` followed by a standard name (`IClock`, `IIdGenerator`, `IUnitOfWork`, `ISession`, ...) or a name of `standardInterfaces`; a class that implements or extends the standard interface is an adapter and is not reported |
| `events/outbox-required` | `stack.events` other than `outbox` with an ORM and no `stack.events` deviation; in `domain/` and `application/`, the import of a broker client or of a bus or relay implementation; a publisher depending on more than `IntegrationEventPublisher`; a platform module that hands out a publisher and never names `OutboxPublisher` |
| `events/consumer-idempotent` | an integration event handler class (`application/integration/handlers/*.integration-handler.ts`) that neither carries `@IntegrationEventHandler` nor is registered in its module file under a consumer name; an `@IntegrationEventHandler` whose `consumer` is not a non-empty string literal; a free `on(` or `consume(` without `processed`; a consumer name used twice, in declarations and registrations alike |
| `domain-events/dispatched-on-save` | a call of `pullEvents()` in `application/` or `infrastructure/` of a context; `DomainEventDispatcher` imported, listed as a dependency or received by a constructor in `application/commands/`, `application/queries/` or a repository adapter. The module file, the tests, the platform and `main.ts` are left alone |
| `domain-events/transactional-before-commit` | a domain event handler (a class of `application/event-handlers/*.event-handler.ts` or `application/integration/publishers/*.publisher.ts`, or any class carrying `@DomainEventHandler`) that runs before the commit and depends on `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` or `EventBus` of the kernel, on a port of `application/ports/` that is not a persistence port (no adapter under `infrastructure/persistence/`, or one anywhere else under `infrastructure/`), on anything imported from `infrastructure/`, another context, the platform or a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`; an after-commit handler (`phase: 'after-commit'` in its decorator, or in the third argument of every `.on(` of the module file that mentions it) depending on `IntegrationEventPublisher`. `check-file` leaves the adapters of a port to the whole check |
| `event-sourcing/state-in-apply` | in a class of `domain/aggregates/` extending `EventSourcedAggregate`, a write to something of `this` (assignment, increment, mutating call) outside the constructor, static methods, `apply<Fact>` methods and `restore`; `this.record(..)` inside an apply method |
| `event-sourcing/past-tense` | in a file of `domain/aggregates/` holding an event-sourced aggregate, a name imported from `domain/events/` whose fact (the words after the name of the aggregate) holds no past participle, or only one spelled like its imperative at its head (`SetPrice`) |
| `event-sourcing/store-behind-repository` | `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` or `InMemoryEventStore` imported in `domain/` or `application/` |
| `event-sourcing/projection-never-appends` | in `application/projections/` or a file declaring `@Projection`, `EventStore` or `EventSourcedRepository` imported; in a projection declared `{ feed: 'event-store' }`, anything of `domain/repositories/` too |
| `event-sourcing/upcaster-required` | a `defineStoredEvent` whose `encode` names no type, or a type not declared in the file, or a type it reaches that the file does not declare; a version above 1 without an upcaster from each version below; a version below the last one recorded in `stored-events.lock.json`, or a recorded version whose shape changed. `ddd-ts-kit docs --stored-events` records new versions and never rewrites one; `docs --check` fails while a declared version is unrecorded |
| `context/extractable` | a module file importing another context outside its published language; persistence importing another context's infrastructure or naming its schema; a handler importing another context's repository; `export let` or an exported `new Map`, `Set`, `WeakMap` at module level; `deployable: true` without `apps/<context>/main.ts`; in the declared style, a role file importing anything of a port file of another context |
| `governance/recorded-deviation` | a `ddd-ts-kit-disable` or `eslint-disable` comment whose reason names no `ADR-<number>` with a file `docs/adr/<number>-*.md`; a rule set to `off` (or to `warn` below its default), an extra directory, an extra allowed package, a `guard` other than `enforce` or `stack.events` off the outbox, without a `deviations` entry `{ what, adr, reason }` pointing to an existing record |
| `declarations/role-declared` | declared style only: a role file (other than `*.command.ts` and `*.query.ts`, held by `authz/declared`; `*.job.ts` under `application/scheduling/` with `@Scheduled` and `*.publisher.ts` with `@DomainEventHandler` are roles) exporting no class with the decorator of its suffix and folder, or one carrying another declaration; a declared class in a file that is not a role file; a `consumer` or `name` option that is missing, empty, a variable, a concatenation or a template with a substitution; any declaration decorator on a class under `domain/` |
| `declarations/barrel-current` | declared style only: with `stack.assembly: barrel`, a missing `<context>.declarations.ts` or one that differs from one `export *` per role file sorted by path followed by one `injected(Class, [Tokens])` per class whose constructor takes something (read from the signatures, with their imports); with `discovery`, a barrel that still exists, and a `<context>.dependencies.ts` that differs from those `injected` statements (absent is accepted while it would hold none). The message names the missing role file or the class whose list is stale. It needs the tree, so `check-file` does not run it |
| `declarations/constructor-injection` | declared style only, in a role file: on a class whose decorator lists nothing, a constructor parameter that is optional, has a default value, is a rest parameter or is destructured, has no type, or is typed by anything but one class name (type arguments aside): a union, an intersection, an array, a qualified name, a type of the language, an interface, a type alias, an enum or an unexported class of the file or of the file of the project it is imported from; a class that inherits its constructor from a class the project cannot read. Under `stack.dependencies: signature`, a decorator that carries a list although the constructor can be read: one that repeats it, one that differs |
| `ports/abstract-class` | in a port file (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`): a class that is not `abstract`; a member that is not an abstract method or property (`static readonly tokenKey = '<text>'` apart): a constructor, a body, an initializer, a `private`, `protected` or `#` member; an exported `interface` (a `type` alias, a data shape, is not reported) |
| `ports/implements-never-extends` | a class carrying `@Repository(P)`, `@Gateway(P)` or `@Adapter(P)`, or given to `bind(P).toClass(C)` or `rebind(P).toClass(C)`, without `implements P` or with `extends P`; under `infrastructure/`, a class extending a class imported from a port file |
| `ports/no-token-constant` | a call of `token` imported from a `@ddd-ts-kit/*` package; `Symbol(..)`, `Symbol.for(..)` or a string literal as the first argument of `bind`, `rebind`, `resolve`, `fake` or `override` in a file importing `@ddd-ts-kit/di`; an UPPER_SNAKE_CASE name in a dependency list; a file named `*.ports.ts` or `tokens.ts` |
| `ports/no-concrete-dependency` | a dependency list naming a class imported from `infrastructure/` or from `test/fakes/` of a context; in the declared style, a constructor parameter of a declared class that lists nothing, typed by such a class |
| `ports/value-import` | a class named in a dependency list, or given to `bind` or `rebind`, imported with `import type` or `import { type X }` |
| `scheduling/job-triggers-use-case` | in `application/scheduling/*.job.ts`: an exported class that does not implement `ScheduledJob`; a `run` that sends no command (no `.execute(` call); a repository in the dependency list or the constructor; an import from `domain/aggregates/`, `domain/entities/`, `domain/services/` or `infrastructure/`. A `builder.job(..)` registration of a class that lives elsewhere |
| `scheduling/job-name` | the first argument of `@Scheduled(..)` or `.job(..)` that is not a string literal `<context>.<job-name>` in lower-case kebab-case with the context of its file; a `systemActor(..)` of a job file passing another name; one job name used twice in the project |
| `errors/code-unique` | under `"stack.refusals": "factories"`, in the `domain/errors/` of a context: a code set a second time, by a factory (`refusal('CODE', ..)`) or by a class (`readonly code = 'CODE'`), with the file and line of the first. The same code in two contexts is not reported |
| `schema/presentation-only` | under `"stack.schemas": "shared"`: in the shared kernel outside `presentation/`, an import of a validation library; in `domain/`, `application/`, `infrastructure/`, `published-language/` and the shared kernel outside `presentation/`, an import of a file of `presentation/` of the shared kernel |
| `schema/no-duplicate-shape` | under `"stack.schemas": "shared"`, in the presentation layer of one context, or in it and `presentation/` of the shared kernel: a DTO class or an object schema (`z.object`, `v.object`, `Type.Object`) declaring the shape of another one, with the place of the original (the shared kernel, then `presentation/http/shared/`); two contexts are not compared, and request parameters and shapes still carrying a `TODO(domain)` of the generator are not judged |
| `errors/known-code` | under `"stack.refusals": "factories"`, in a `*.route.ts`: a code of the `errors` list that no refusal of the context of the route sets, that no class outside the contexts sets, and that is not a code of the kit |
| `domain/value-object-class` | under `"stack.values": "classes"`: in `domain/value-objects/` of a context or a `*.vo.ts` of the shared kernel outside `presentation/`, no exported class or a second one, a class that extends neither `ValueObject` nor another value object of the project, a public constructor, a concrete class without a static method, an exported function, arrow constant or object literal (inline, listed or by default); in `domain/` and in the shared kernel outside `presentation/`, an exported function that answers a record of data: data entries, no spread, nothing a call of the model built |

More ids belong to `@ddd-ts-kit/eslint-plugin`, which reads the syntax tree where this
checker reads text: `domain/aggregate-encapsulation`, `domain/value-object-immutability`,
`domain/no-generic-error`, `application/handler-shape`,
`application/command-query-separation` and `clean/no-magic-number` among them (`ddd-ts-kit rules`
lists them all). `rules` and `explain` show them as "checked by
@ddd-ts-kit/eslint-plugin", the config accepts them under `rules`, and `check --rule` on one of
them answers with `npm run lint`. One id, `clean/formatted`, belongs to the formatter: `rules`
and `explain` show it as "checked by Biome", and `check --rule` on it answers with
`npm run format:check`.

`guard` in the config (`enforce`, `advise` or `off`) tells the editor hook of the plugin how to
react to a violation after a write: refuse it, only report it, or stay silent. `check` ignores
it, apart from validating its value.

### Commit size

`check --commit-size [--staged] [--strict]` counts the files and lines about to be committed
(tracked changes since HEAD and untracked files; the index only with `--staged`) against `commit`
in the config (`{ "maxFiles": 20, "maxLines": 600 }` by default). Generated documents, lockfiles,
`.dependency-cruiser.cjs`, `docs/context-map.md`, declaration barrels and
`.ddd-ts-kit/worker.json` are not counted; an untracked file over 1 MB counts no line. It names the
slices the changes belong to: a use case, a layer of a context, the platform. Advisory: exit code
0, unless `--strict` and over the limits. Outside a git repository it says so and exits 0. The
generated `lefthook.yml` runs it on the index at each commit, without blocking.

### Limits

The checker reads sources with a small lexer and a shallow reading of declarations, not with a
compiler. It follows relative specifiers, the aliases of the project (`importAlias`, `$test/`,
`$scripts/`, `$generated/`) and bare packages, and classifies files by their path: an alias
import is judged by every boundary rule exactly as the relative path to the same file.

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
- `composition/only-in-module` sees `new` and `toClass` on imported names; a factory function
  or a re-exported adapter escapes it.
- `events/name-format` checks the shape and the context prefix, not the grammar of the fact.
- `test/spec-required` and `test/builder-required` check that the file exists, not its content.
- `authz/*`, `events/*` and `context/extractable` match names and shapes: an aliased import, a
  route definition built from a variable or a spread, an ownership test (`invoice.ownerId ===
  actor.id`), a schema name in raw SQL, a cross-context transaction and a mutable exported array
  or object go unseen; the content of `apps/<context>/main.ts` is not judged.
- `governance/recorded-deviation` checks that the decision record exists, not what it says; a
  deviation entry that justifies nothing any more is not reported, and `limits` and
  `standardInterfaces` are not governed.
- `authz/actor-explicit` knows no type: `.current()` or `.require()` without argument on a
  concept of the domain named `scope` is reported, an execution scope held under another name
  is not, and `stampCreation`, `stampUpdate` and `tenantScopeOf` are seen only when imported
  under their own name.
- `aspects/outside-in` and the outside packages of the `layer/*` rules are matched on the
  import specifier: a decorator or a client re-exported by a file of an allowed place goes unseen.
- `standard/no-parallel-interface` compares whole declared names with a table and does not read
  the glossary: a domain concept legitimately called `AuditLog` or `CurrentUser` is reported
  (drop the name in `standardInterfaces` or record a suppression), a copy under any other name
  is not, and the exemption of a class reads the names after `implements` and `extends`, not
  what they resolve to.
- A declaration decorator is seen when it sits on a top-level class and its own name is imported
  from `@ddd-ts-kit/kernel/declarations` in the same file. An aliased import (`Requires as Needs`),
  a namespace import, a decorator re-exported by another module, applied by a helper or called as
  a function, and one on a class expression or a nested class go unseen (ESLint follows aliases
  and namespaces). The `consumer` and `name` options are read only in an object literal written in
  the decorator call: held in a variable, spread or built by a function, they are reported as not
  being a string literal.
- `authz/declared` follows one direct import of the message from a module file.
- `context/extractable` tells a port by its file (`domain/repositories/*.repository.ts`,
  `application/ports/*.port.ts`): a port of another context reached through a re-export is not seen.
- `composition/only-in-module` reports every `.include(` of a file importing `@ddd-ts-kit/di`
  outside the composition places, whatever the receiver.
- `declarations/barrel-current` compares text exactly (line endings aside): a reformatted barrel
  is stale. It does not check that the composition root imports the barrel.
- `clean/blank-lines` holds the cheap part of the layout, the `return` and the padded block; the
  blank line after a group of declarations, around `if`, `for`, `try` and a multiline statement
  and between class members is held by ESLint (`@stylistic`), which is authoritative and fixes it.
- `clean/braces` reads control statements as text: a method or a property named `if`, `for`,
  `while`, `else` or `do` is told apart by what follows it, not by a syntax tree. ESLint (`curly`)
  is authoritative for the braces and the formatter for where they go.
- `clean/formatted` is listed and explained, never judged: the formatter of the project, Biome,
  decides it (`npm run format:check`).
- `clean/one-export-per-file` reads declarations as text: the types of a signature are the
  exported interfaces and types whose name occurs in the text of the main export, a closed family
  is recognised by return type annotations and by the names of module-level bindings. A file the
  two analyzers judge differently is ESLint's to decide; what neither explains goes to
  `onePerFile.allow`.
- The 100-line ceiling of `clean/function-size` is judged on the functions this checker reads:
  an arrow function and the callback of a `describe` are held by ESLint (`clean-function-ceiling`).
- The `ports/*` rules read a dependency list where it is written as an array literal: the last
  argument of a declaration decorator, the second of `.toClass(..)` and `.handledBy(..)`. A list
  held in a constant or built by a function is not read. `bind`, `rebind`, `resolve`, `fake` and
  `override` are binding calls only in a file that imports `@ddd-ts-kit/di`.
  `ports/implements-never-extends` reads the bound class through one direct relative or alias
  import; a class of a package or behind a barrel is not judged.
- The constructor of a declared class is read as text, by the scanner of the checker: the
  constructor of the exported class that carries the decorator of its role file, its own or
  the nearest one it inherits through imports of the project. A type imported from a package
  is trusted to be a class (the compiler judges the generated file, which imports it as a
  value); a type reached through a barrel is trusted too. A constructor overloaded by
  signatures without a body, or built by a mixin, is not read: write one plain constructor.
  `declarations/barrel-current` compares text exactly, so the generated file is never
  reformatted by hand.
- `scheduling/job-triggers-use-case` takes any `.execute(` call in `run` for a command sent; a job
  that executes something else, or sends its command from a helper, is misjudged.
  `scheduling/job-name` compares literal names: a job registered under a computed name is reported
  for its name and escapes the uniqueness check.
- `domain-events/transactional-before-commit` reads dependencies where they are written: an array
  literal (the decorator, `.toClass(Handler, [..])` in the file of the class or in the module file)
  and the type of a constructor parameter, resolved through the imports of that file. A name that
  is not imported, a kernel port imported under another name and an effect reached without a
  dependency (a module-level client) are not seen. An explicit-style handler is matched to its
  `.on(` registrations by its class name or by a variable assigned from `new <Class>(`; an adapter
  is a class that `implements` the port under the name the port file exports.
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
npx vitest run packages/cli                     # the fast suite
npm run build && npm run ci:test:e2e            # the slow suite: DDD_TS_KIT_E2E=1, one file after the other
node packages/cli/dist/bin.js check --self
npm run clean:self --workspace ddd-ts-kit       # the clean/* rules on this package
npm run clean:packages --workspace ddd-ts-kit   # the same rules on the sources of every other package
```

The slow suite lives in `test/e2e/`, in its spec files and their support files; but for the
`first-minute` specs it generates every project with every kind, a job on an interval and one on a cron expression with a
time zone, `adapter --decorators`, `generate service` and `generate worker` included. It runs in
the process, without a container:

- `zero-violation.spec.ts` (also part of the fast suite): the 39 stacks of `STACKS` in
  `test/e2e/stacks.ts`, the three loggers and both wiring families with `--errors sentry` among
  them, pass `check` and `docs --check` as generated.
- `typecheck.spec.ts`: the 36 of them the workspace can compile (jest, prisma and typeorm
  apart) type-check against the sources of the workspace packages.
- `proven-stacks.spec.ts`: the eight projects of `PROVEN` are installed as a published kit would be and held to
  everything their own pipeline runs: `check` with zero violation and zero warning, ESLint with the
  preset (the test first reads from `eslint --print-config` that the rules of ports, scheduling,
  file shape and layout are on), dependency-cruiser with the generated configuration, knip, their
  specs (each job run, by `runNow` on tsyringe, and held to the command it sent, a decorated adapter, the
  extraction of every context), their end-to-end specs (401 without a token, 403 without the
  permission, 2xx with it, with tokens signed in the test, and the trace of the request as one
  tree), their build (the worker and the extracted service included) and their generated
  documents. They are the default stack, which is declared; declared with
  `--authz rebac --broker rabbitmq --ci gitlab`; declared with `--orm knex --assembly discovery`,
  alone and behind `--broker nats` with `--errors sentry` (no DSN is configured: nothing is
  reported, the wiring is linted, built and run); the explicit style on the default stack and on
  `--authz rebac --broker rabbitmq --ci gitlab`; and hand wiring (`--di manual`) on
  `--authz abac --orm knex` and on
  `--http fastify --orm knex --broker rabbitmq --cache redis --errors sentry --logger winston`.
- `first-minute.spec.ts`, `first-minute-proven.spec.ts`, `first-minute-no-context.spec.ts` and
  `first-minute-two-contexts.spec.ts`: a
  project is green from its first minute, before anything is generated. The first runs the quick
  start of the root README line by line as it is written, on pnpm and, in the words the README
  gives for it, on npm: `init` alone, the install and the `verify` the note of `init` names (also
  held to the README and the `CLAUDE.md` of the project), then a context, a second one downstream
  of it, a use case with its route, `docs:generate`, with a `verify` at each step; and the
  sequence the defect of 0.1.0 was reported with, contexts asked of `init`. The second does the
  same on the seven other proven stacks, one package manager each in turn: no context, one, two
  with an upstream, a first use case. Both install for real from the packed kit and run in the
  package manager jobs of the pipeline (`ci:test:managers`). The last two take every stack the
  workspace can run, installed as a published kit would be, with no context and with two: no
  finding of the four analyzers, specs that pass, a build, and the contracts `init` wrote equal to
  what the scripts of the project generate.
- `package-managers.spec.ts`: one project per package manager on the default stack and on NestJS
  with Prisma, every kind generated, installed for real from the packed kit: the frozen install of
  a pipeline, the build, `verify`, and `affected` from the installed CLI.
- `first-class.spec.ts`: the first-class stack, `--validation class-validator --orm knex --authn
  keycloak --authz rebac --cache redis --http-cache varnish --audit on --errors sentry --logger pino --style declared`
  (legacy decorator mode), three times, with `--broker redis` (one server for the cache and the
  event bus), `--broker nats` and `--broker kafka`: the same analyzers before and after the
  business decisions of `test/first-class-proof.ts`, a failed job and a dead-lettered event
  reported to the reporter in memory of the test application, then a list narrowed by
  relationships, the audit trail read through its route, the correlation id of a request followed
  to the published event, that event carried from one context to the handler of another, and the
  whole of it asserted as one trace with `expectSpanTree`.
- `error-reporting.spec.ts`: `--errors sentry` in both wiring families (declared on tsyringe
  behind RabbitMQ and the outbox, by hand without a database), installed as a published kit
  would be: the same analyzers without a finding, the three entry points built with the reporter
  as their second import, then a spec written into the project
  (`fixtures/reported-failures.spec.ts.txt`) that makes a query fail behind its route: one
  report on an `InMemoryErrorReporter`, named after the query, and one flush when the
  application stops; a `NoopErrorReporter` and a working application without `SENTRY_DSN`; and,
  with a DSN naming an endpoint of the loopback interface opened by the spec, exactly one event
  sent by the real SDK, carrying the environment, the release and the actor id, and neither the
  credential nor the query string of the request. No Sentry or GlitchTip server is involved.
- `violations.spec.ts` and `new-rule-violations.spec.ts`: in a project of the default stack, one
  deliberate violation at a time has to be caught by the analyzer that holds the rule: a generic
  error in the domain (ESLint), a domain importing its infrastructure (dependency-cruiser), an
  unused export (knip), a stale barrel (the checker and `docs --check`), and by both the checker
  and ESLint a command that says nobody may send it, a handler that no longer declares itself, an
  event handler named after another event, then `ports/abstract-class`,
  `ports/implements-never-extends`, `ports/no-token-constant`, `ports/no-concrete-dependency`,
  `ports/value-import`, `clean/no-hash-private`, `clean/blank-lines` (a glued `return` and a padded
  block), `clean/braces`, `clean/one-export-per-file`, `clean/file-size`, the 100-line ceiling of
  `clean/function-size`, `scheduling/job-triggers-use-case` and `scheduling/job-name`; two jobs
  under one name are caught by the checker.

Events, cache and database stay in the process unless `DDD_TS_KIT_TEST_REDIS_URL`,
`DDD_TS_KIT_TEST_NATS_URL`, `DDD_TS_KIT_TEST_KAFKA_BROKERS`, `DDD_TS_KIT_TEST_AMQP_URL` and
`DDD_TS_KIT_TEST_DATABASE_URL` (first-class stack only, migrated by the test) name real services:
the event then really crosses the broker.
