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
npx ddd-ts-kit generate command billing IssueInvoice --aggregate Invoice --creates --permission invoice.issue --grant accountant --term "Issue=To make an invoice final"
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
its limits, `2` wrong usage (the message says what to do), `3` a command that writes files could
not write some of them where it ran (a path the sandbox of an agent protects): they are listed
under `unwritable`, every other file is written and none is deleted.

## init

```
ddd-ts-kit init [--http express|fastify|hono|nest|none]
                [--validation zod|class-validator|typebox|standard-schema|none]
                [--di tsyringe|nest|manual] [--tests vitest|jest]
                [--orm drizzle|knex|prisma|typeorm|custom|none]
                [--database postgres|mysql|sqlite|none]
                [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                [--authn jwt|keycloak|passport|none] [--authz rbac|abac|rebac|custom]
                [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis]
                [--http-cache none|varnish] [--storage local|s3|none] [--audit on|off]
                [--event-sourcing on|off] [--privacy on|off]
                [--errors none|sentry] [--logger stdout|pino|winston]
                [--style declared|explicit] [--assembly barrel|discovery]
                [--dependencies signature|listed] [--refusals named|factories|classes]
                [--routes controllers|functions|nest] [--value-objects throwing|result]
                [--literals named|free] [--values classes|free] [--tenancy none|shared-table]
                [--queue database|redis|memory]
                [--schemas shared|per-route]
                [--package-manager npm|pnpm]
                [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                [--import-extension none|js] [--sdk] [--agent-profile regulated|none]
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
dependencies are added, yours are kept and mentioned in the notes. The first time, the notes also
name each dependency the stack about to be written contradicts, and the flag that keeps it
(`package.json depends on fastify, and the project is written for --http express: pass --http
fastify to keep it.`), a dry run included: run `init --dry-run` first on an existing project.
Run again later, `init` keeps the stack recorded in the config.

`init --force` on a project that is already initialised rewrites the files `init` owns and keeps
the config: the contexts and their upstreams, the rules, the limits, the deviations and every
other key stay as written, and the stack changes only where a flag names a choice
(`init --force --logger pino` changes the logger; a combination the recorded stack cannot take
is refused as for a new project). The composition root, the proof that each context wires alone
and the registry of permissions are rewritten from their templates, then the declared contexts
are wired into them again, and the erasure of each context is listed again in the copies of the
privacy folder; what another generator had added to a file of the platform (the value of a
gateway, the settings of a job) is not, and a note says so. A config that cannot be
read is replaced.

The pipeline uses free tools only. `--ci-extras` adds jobs that need a paid plan on a private
repository, report into a merge request only in a paid tier, or spend API tokens on every run:
`codeql`, `dependency-review` (GitHub), `gitlab-sast`, `gitlab-secret-detection`,
`gitlab-dependency-scanning` (GitLab), `claude-review` and `claude-triage` (both platforms: Claude
Code reviews each pull or merge request and posts one comment that neither approves nor blocks,
and triages a failed run in three lines, read-only; the `gate` job never needs them), and `intent-to-spec` (GitHub: the story skill run
headless on each intent a merge accepts, its specification opened as a pull request). The list is
recorded as `ci.extras` in the config; an unknown name, or a job of a platform `--ci` does not
cover, is refused. The table of every tool, its cost and its conditions:
[pipeline/README.md](../../pipeline/README.md#free-by-default-paid-on-request).

An import of a file of the project is written without an extension
(`@/contexts/billing/domain/aggregates/invoice.aggregate`): `init` records
`"importExtension": "none"`, and `--import-extension js` asks for the `.js` of the emitted file
instead. A config without the key is read as `js`, so a project generated before the key
existed keeps its spelling. See [docs/CONFIG.md](../../docs/CONFIG.md).

Defaults: `express`, `zod` (`class-validator` with `--http nest`, as Nest validates), `tsyringe` (`nest` with
`--http nest`, and only then), routes written as controllers of the kit (Nest controllers with `--http nest`
on class-validator, `--routes nest`), `vitest`,
`drizzle` on `postgres`, `outbox` when there is an ORM, `swagger`, `github`, `jwt`, `rbac`, no broker,
the cache in the process, files in a local directory (`--storage local`), the audit trail `on` when there is an ORM, the requests of a data subject answered (`--privacy on`) when there is an ORM, no event store (`--event-sourcing off`), unexpected failures reported
nowhere (`--errors none`), JSON lines on the standard output (`--logger stdout`), and the
`declared` style with a `barrel` wherever the declarations are read: with `--di tsyringe`.

**Package manager.** `pnpm` unless `--package-manager npm`: every script, pipeline, hook, the
Dockerfile, the guidance and the agent permissions are written in the dialect of the one chosen,
recorded under `stack.packageManager`. pnpm is pinned in `package.json` and provided by corepack;
`pnpm-workspace.yaml` says that no dependency runs a build script unless allowed by name. Both are
proven by a real install of a generated project, its build and its `verify`. The kit is installed
from the registry either way.
The project forces the versions that close a vulnerability its stack still pins below the fix, in
`overrides` of `package.json` under npm and of `pnpm-workspace.yaml` under pnpm, which reads
nothing of `package.json`: qs `^6.16.0`, which Stryker asks for at 6.15.1 through
`typed-rest-client`, and under `--http nest` multer `^2.5.0`, which `@nestjs/platform-express`
asks for at 2.4.0. An override the project already sets for one of them is kept, and said.
The install scripts the stack needs are allowed by name: `@prisma/engines` under `--orm prisma`
(it downloads the schema engine that `prisma migrate` and `db:client` run) and
`@confluentinc/kafka-javascript` under `--broker kafka` (it downloads the prebuilt native client,
or builds it), in `allowScripts` of `package.json` under npm and in `allowBuilds` of
`pnpm-workspace.yaml` under pnpm. pnpm runs no build script of a dependency it is not told to;
npm 11 lists every install script not in `allowScripts` as not yet reviewed, still runs it in
11.19 with a warning, and says a later release blocks it. By name, because the version is known
once the install resolved the range, and npm drops an entry written with a range; a team that
reviews each version pins them after the first install (`npm install-scripts approve <package>`
turns a name into the installed version), which the regulated profile asks. An entry the project
has for one of them, a pin or a denial, is kept; a denial is said. The other install scripts an
install lists (esbuild, `@swc/core`, `unrs-resolver`, `protobufjs`, `@parcel/watcher`, lefthook,
the preinstall of `prisma`) are not needed by the kit: lefthook's installs the git hooks, which
`hooks:install` does.

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
`--assembly` says how a declared context reaches the composition root: `barrel` (the default) is
generated files, `<context>.declarations.ts` at the root of the context re-exporting the
declarations of each layer, static, followed by a bundler, by knip and by dependency-cruiser; `discovery` writes `await discoverContext(...)` instead, with the knip entry
and the dependency-cruiser exception the discovered files need (publishers and jobs included: they
are discovered like the rest), and inlines `@ddd-ts-kit/di` in the two vitest configs, so that the
files it imports itself are compiled by the runner. Discovery is accepted behind a broker: a
context listens on the subscriber `EventSubscribers.forContext(name)` hands it, in either assembly.
A config written before `stack.style` existed is explicit.

The same use case in both styles. In the declared style, the command and its handler carry their
decorator, and the handler's constructor says what it needs. The body of the handler is the one
`generate command billing IssueInvoice --aggregate Invoice --creates --permission invoice.issue` writes,
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

// billing.permissions.ts
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
compiler, and write `injected(Class, [Tokens])` statements in the generated files of each
context: the `<layer>.declarations.ts` of each layer, above the role folders whose classes it
registers, which `<context>.declarations.ts` re-exports, or `<context>.dependencies.ts` under discovery. `@ddd-ts-kit/di` injects from there. `emitDecoratorMetadata` is never relied on: it
is absent with standard decorators and under `tsx`. `init` writes
`"stack.dependencies": "signature"`; a config without the key is `listed`, the 0.1 form
(`@CommandHandler(M, [Ports])`), which keeps working untouched, and
`--dependencies listed` asks for it. The explicit style stays explicit: its module file lists
what each class is given. Every generated file exports one class, interface or function and is named
after it.

![How a declared context reaches the composition root: the role files carry their decorator and type their constructor parameters by classes; generate, docs and the dev script read those signatures and write the declarations of each layer, one export per role file of the layer and one injected statement per class that takes something, and a summary at the root of the context that re-exports them; the composition root includes the summary with contextModule and @ddd-ts-kit/di injects from it; check and docs --check report generated declarations that no longer match the role files](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-declared-barrel.svg)

An excerpt of the declarations of the `notification` context of the example application, as
the CLI writes them (never by hand): one file per layer, above the role folders whose classes it
registers, and a summary at the root of the context that only re-exports them.

```ts
// src/contexts/notification/application/application.declarations.ts
import { injected } from '@ddd-ts-kit/kernel/declarations';
import { WithdrawReminderHandler } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';

export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';
export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';

injected(WithdrawReminderHandler, [ReminderRepository]);

// src/contexts/notification/infrastructure/infrastructure.declarations.ts
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';

injected(KnexReminderRepository, [KnexContext, ExecutionScope, Clock]);

// src/contexts/notification/notification.declarations.ts
export * from '@/contexts/notification/application/application.declarations';
export * from '@/contexts/notification/infrastructure/infrastructure.declarations';
export * from '@/contexts/notification/presentation/presentation.declarations';
```

and the one line of the composition root that adds the whole context:
`contextModule('notification', notificationDeclarations)` in `src/platform/composition/compose-application.ts`.

**A refusal is a class of its own.** `init` writes `"stack.refusals": "named"`: each refusal of
a context is a class named after what is refused, extending `DomainRefusal` of the kernel, built
by static factories named after what the refusal is about, and its code is read from the closed
list of the codes of the context, `<context>.codes.ts`.
`generate error <context> <Refusal> <factory>` writes the class, its code and the factory. The
`errors/*` rules hold that form. Two earlier forms keep working: `--refusals factories`, one error class per concept extending
`ConceptError`, each refusal a static factory of it, as `init` wrote it before; and
`--refusals classes`, or a config without the key, one class per error built with `new`, as 0.1
and 0.2 wrote them. `error-factories` moves a project from either to `named`.

The form `init` writes, which `generate error scheduling SlotTaken forCalendar` starts:

<!-- checked sample -->
```ts
import { DomainRefusal } from '@ddd-ts-kit/kernel';

// scheduling.codes.ts: the closed list of the codes of the context
export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
} as const;

export type SchedulingCode = (typeof SchedulingCodes)[keyof typeof SchedulingCodes];

// domain/errors/slot-taken.error.ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal(`The slot of calendar ${calendarId} is already held.`, { calendarId });
  }
}

const refusal = SlotTaken.forCalendar('calendar-1');

// what catches it tells the refusal by its class, and reads its facts
if (SlotTaken.is(refusal)) {
  console.log(refusal.facts.calendarId);
}
```

Under `"stack.refusals": "factories"`: one class per concept of the glossary, one factory per
refusal, which `generate error scheduling Appointment slotTaken` adds.

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

The oldest form, under `"stack.refusals": "classes"`: one class per error.

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
to 0.5 wrote it; `value-objects` moves a project from one to the other. `generate property` writes
the laws of an existing value object as a spec on generated values, in either form, and adds
`fast-check` to the development dependencies when it is missing.

**Domain events leave with the save.** A generated command handler builds or loads its aggregate,
calls one intention method, `await repository.save(aggregate)` and returns: no `pullEvents()`, and
no `DomainEventDispatcher` in a handler or in a repository adapter, which only persists. The events
the aggregate recorded are dispatched once the save resolves, inside the unit of work of the
command: by the kernel module on tsyringe, by `dispatchingOnSave` around each repository in
`platform/composition/create-platform.ts` with hand wiring (`domain-events/dispatched-on-save`).

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
import { type Actor, AggregateRoot, AuthorizedCommand, type Clock, type CommandHandler, DomainRefusal, Repository } from '@ddd-ts-kit/kernel';

declare class Invoice extends AggregateRoot {
  /** Makes the invoice final and records InvoiceIssued, which waits in the aggregate. */
  issue(now: Date): void;
}

declare class UnknownInvoice extends DomainRefusal {
  readonly code: 'INVOICE_NOT_FOUND';
  static forInvoice(invoiceId: string): UnknownInvoice;
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
      throw UnknownInvoice.forInvoice(command.invoiceId);
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
| `src/platform/` | one export per file, each named after it, in one folder per concern, no file at its root (a project generated before the folders keeps them flat until `npx ddd-ts-kit platform-folders`). `composition/` (`compose-application.ts` and `lay-foundations.ts` in both families, then `platform.module.ts` and `platform-test.module.ts` on tsyringe, `platform.ts`, `platform-options.ts` and `create-platform.ts` wired by hand); `jobs/` (`job-settings.ts`, `jobSettings(environment, context?)`: one line per job, `JOB_<CONTEXT>_<JOB>_ENABLED=false` switches one off). `config/` (`app-config.ts`; `environment.ts`, the reader of the variables of the process, `env.url('DATABASE_URL')`, `env.integer('PORT', { fallback, min, max })`, `env.flag`, `env.oneOf`, which keeps every problem by variable name and reports them at once; `load-config.ts`, `config-error.ts`, `read-tracing.ts`: fail-fast on `DATABASE_URL`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_SCRUB_MESSAGES`, the `OUTBOUND_*` policy, `RUN_JOBS` and the tracing variables below); `observability/` (`tracing.ts`, the first import of every entry point; `errors.ts` with `--errors sentry`; `create-logger.ts`, see `--logger`; `create-metrics.ts`: a `NoopMetrics` behind a `TODO(platform)`); `resilience/` (`resilience-settings.ts`, `default-resilience-settings.ts`, `default-policy.ts`: retry with backoff and a timeout for `external` and `gateway`, `own-policy.ts` for an adapter that states its own, `adapters-with-own-policy.ts`, the set the default policy leaves alone); `events/`, `database/`, `auth/`, `audit/`, `redis/` (below); `event-sourcing/` and `privacy/` (below); `http/` (`start-http-server.ts`, `with-documentation.ts`: `/docs` and `/openapi.json`, or `/openapi/<name>.json` per document of a split contract, off in production unless `API_DOCS=true`; `openapi-documents.ts`, the split written by `ddd-ts-kit docs` from `openapi.documents`). With `--di tsyringe`: `compose-application.ts` (`composeApplication(persistence, options, contexts?)`: `kernelModule({...})`, the platform module, the authorization module, the contexts; installs the aspect runtime), `lay-foundations.ts` (one execution scope, clock, id generator, logger, metrics, instrumentation and audit, built before any module), `platform.module.ts` (what replaces the in-process defaults of the kernel: unit of work, processed-event store, the storage class, `OutboxStore`, `EventSubscribers` behind a broker, `ErrorMapper`, and `builder.around(['external', 'gateway'], ...)`, the resilience of every adapter that leaves the process), `platform-test.module.ts` (what a handler spec lists next to its context: the storage class bound to a factory that throws), `buses/create-command-bus.ts` and `create-query-bus.ts` (outermost first: `errorReportingMiddleware`, `loggingMiddleware`, `metricsMiddleware`, the permission, the span of the use case, the audit entry, then the unit of work of a command). With `--di manual` or `nest`: `compose-application.ts`, `platform.ts` (`interface Platform`, with `jobs: JobScheduler` and `adapter`, which wraps what a module file instantiates), `platform-options.ts`, `lay-foundations.ts` (the same foundations as on tsyringe, the log of the decisions or the audit sources included), `create-platform.ts` (the assembly: the domain events, the guard, the two buses, the event ports, the files and what wraps every adapter), `buses/create-command-bus.ts` and `create-query-bus.ts` (the same chains as on tsyringe, given the guard and the storage), `events/platform-events.ts` (the publisher, the subscribers and, behind Varnish, the purges), `jobs/configured-job-scheduler.ts` (applies `job-settings.ts` to what a module registers) |
| tracing | wired once, by the platform (`tracing/platform-only`): no `decorate` hook, no `decorate-bindings.ts`. `tracing.ts` starts `initTracing` of `@ddd-ts-kit/tracing/node` before any other module, on what `config/read-tracing.ts` validates: `OTEL_EXPORTER_OTLP_ENDPOINT` (a URL; left out, no span leaves the process), `TRACE_SAMPLE_RATIO` (0 to 1) and `TRACE_CONSUMERS` (`continue`, the default: a consumed event stays in the trace of its publication; `link`: each delivery starts a trace linked to it). With `--di tsyringe`: `lay-foundations.ts` builds `traceApplication({ consumers })`, `compose-application.ts` hands it to `kernelModule({ instrumentation })` (one span per use case, repository call, domain event, publication, consumer and job) and gives the outbox relay `tracedPublisher(bus)`. With hand wiring: `create-platform.ts` applies the members of `traceApplication()` itself (`useCase` on both buses, `domainEvents`, `publisher`, `binding` around every adapter, `job`, `executionScope`, `errorReporter`), with `tracedSubscriber` and `tracedPublisher` around the provider. With an HTTP stack, in both families, `auth/authentication/http-boundary.ts` sets `around: tracedRoutes()`: one `SERVER` span per request, named by its route |
| `--logger` | `src/platform/observability/create-logger.ts`, one per choice: `stdout` (the default) is the `StdoutLogger` of `@ddd-ts-kit/aspects`, JSON lines, credentials not redacted; `pino` is `createPinoLogger` of `@ddd-ts-kit/pino` (dependencies `pino` and `pino-pretty`); `winston` is `createWinstonLogger` of `@ddd-ts-kit/winston`; these two redact the credential keys of the kernel. Every entry carries `traceLogFields(scope)`: the correlation id, origin, actor and tenant of the work in progress and the ids of the active trace. `LOG_LEVEL`, `LOG_FORMAT` (`json`, the default, or `pretty`; with `stdout`, which has no pretty format, `pretty` is refused when the configuration is loaded) and `LOG_SCRUB_MESSAGES` (`[message removed]` in place of the message of a logged error that is not a `DomainError`) are validated in `config/load-config.ts`. Stopping the application flushes the error reporter, then the logger, last: `container.stop()` does it on tsyringe, `compose-application.ts` flushes explicitly with hand wiring. The tools and the tests compose the application without `log` and write nothing |
| `src/platform/auth/` | one folder per question: `authentication/` (who is calling), `authorization/` (what they may do, whatever the model) and the folder of the model `stack.authz` names (`roles/`, `attributes/`, `relationships/` or `custom/`). A project generated before the folders keeps its files flat: the generators read them there, `npx ddd-ts-kit doctor` says so and `npx ddd-ts-kit platform-folders` moves them with every import |
| `src/platform/auth/authentication/` | `create-authenticator.ts` (`--authn jwt`: `JwtAuthenticator` on `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI`; `--authn keycloak`: `keycloakAuthenticator` on `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE` and the optional `KEYCLOAK_CLIENT_ID`; `--authn passport`: `passportAuthenticator` of `@ddd-ts-kit/auth/passport` over `bearer-strategy.ts`, the strategy of `passport-jwt` on the key set `AUTH_JWKS_URI` publishes (`jwks-rsa`), `AUTH_ISSUER` and `AUTH_AUDIENCE`, which refuses a token without `exp` unless given `requireExpiry: false` and allows RS256, PS256 and ES256, the `DEFAULT_JWT_ALGORITHMS` of `JwtAuthenticator` but EdDSA, which `jsonwebtoken` cannot verify (an issuer that signs with EdDSA needs `--authn jwt`), and `actor-of-token.ts`, which reads its payload with `actorOfClaims`; `--authn none`: `development-header-authenticator.ts` and `development-actor-header.ts`, which read `x-development-actor` and throw in production), `principal-of.ts`, `security-schemes.ts`, `offline-authenticator.ts`, `http-boundary.ts` (`resolvePrincipal` answering a `Session`, `executionScope`, `errorMapper` and `onError`, spread into the mount options: every request runs inside the execution scope, with its correlation id). Without an HTTP stack there is no authenticator and no boundary, and no folder |
| `src/platform/auth/authorization/` | `create-authorizer.ts`, `authorization.ts` (`authorizationModule` with tsyringe) or `use-case-protection.ts` (the guard of the hand-wired buses), `access-policies.ts`, `role.ts` (the roles a credential carries, with roles or attributes, or once a guard names one), `permissions.ts` (the registry of every permission, with relationships or an authorizer of your own), `signed-in-grants.ts` once a context preset grants every signed-in person, and with `--audit off` `log-decisions.ts` (one log entry per decision, ids and codes only) |
| `src/platform/auth/<model>/` | `roles/roles.ts` (with the role `system` every system actor holds); `attributes/attribute-policies.ts`; `relationships/`: `relationship-schema.ts`, `create-tuple-store.ts` and its contract spec, `relation-tuples.ts`, `relate-system-actors.ts`; `custom/`: `custom-authorizer.ts` and its `authorizerContract` spec |
| `--representations negotiated`, `--forms on` | `src/platform/http/presentation-of.ts` (`Representations.standard()` with `negotiated`, and `fieldDeciderOf` over the `Access` of the application), spread into the HTTP boundary and given to the contract script; with `--forms on`, `src/platform/http/with-forms.ts` adds `formRoutes` to the routes and `scripts/openapi.ts` writes `openapi/forms/<operationId>.json`. Both are the default with an HTTP stack; `json` and `off` leave them out ([docs/CONFIG.md](../../docs/CONFIG.md)) |
| `--audit on` | `src/platform/audit/`: `create-audit.ts` (the trail, the `onDecision` of the authorization, the refusals of the guards at the edge given to the HTTP boundary as `onGuardRefusal`, the middleware before the unit of work, the integration events subscribed under the consumer name `audit`), `audited-events.ts` (the registry `generate integration-event` adds to), `audit.module.ts`, and with an HTTP stack the read side: `audit.permissions.ts` (`audit:trail.read`), then in `search-audit-entries/`: `search-audit-entries.query.ts`, its handler, `search-audit-entries.route.ts` or `.controller.ts` (`GET /audit/entries`: cursor pages, filters `actorId`, `action`, `outcome`, `correlationId`), which starts with the endpoint and takes what it receives and answers from `audit-entries-parameters.ts`, `audit-entries-filter-of.ts`, `audit-entry-view.ts`, `audit-entry-view-of.ts` and `audit-outcomes.ts`. It is a capability of the platform, not a bounded context: no model, one protected query over the `AuditReader` port, bounded by the tenant of the actor (with `--tenancy shared-table`, by the tenant of the work through `TenantAuditReader`: platform staff read across tenants only inside `acrossTenants`). The refusals of a caller without a credential are not recorded. A scheduled job is audited like a request: origin `schedule`, actor `system:<context>.<job>`. With knex the two tables and their append-only triggers are created by the first migration; with drizzle the tables are in `schema.ts` and `npm run db:generate` adds the trigger statements to the migration that creates the tables (`npm run db:audit-guard` prints them for a migration by hand); with prisma and typeorm the tables are models of `prisma/schema/schema.prisma` or entities of `schema.ts` (`auditPrismaModels`, `auditEntities` of `@ddd-ts-kit/audit`), written by `PrismaAuditTrail` and `TypeOrmAuditTrail`, and `npm run db:generate` (through `ddd-ts-kit prisma-generate` or `typeorm-generate`) adds the trigger statements to the migration that creates the tables, `npm run db:audit-guard` printing them for a migration by hand; the test databases install that guard; with `custom` or no ORM the trail is an `InMemoryAuditTrail` behind a `TODO(platform)`. The test databases leave the audit schema out of `reset()`. With the trail in a database and `--storage local` or `s3`, `audit.module.ts` (or the hand-wired composition) registers `audit.archive` on the first day of every month at 04:00 UTC: the entries older than twelve whole months move to the storage under `audit-archives/`, verified, read back and anchored (`ArchiveAuditEntries`); with `s3` it runs unless `JOB_AUDIT_ARCHIVE_ENABLED=false`, with `local` only with `JOB_AUDIT_ARCHIVE_ENABLED=true`, since the archive removes the entries from the database and the disk of the server may not last |
| `--event-sourcing on` | recorded as `stack.eventSourcing`, `off` unless asked: `Persistence` gains `eventSourcing` (`create<Orm>EventSourcing` in the `event_store` schema, whose five tables the schema file declares; the in-memory stores with `--orm none`), and `src/platform/event-sourcing/`: `create-event-sourcing.ts` (`EventSourcing`: the stores, the `SubjectKeyStore` wrapped by `auditedSubjectKeys` with `--audit on`, and the `PersonalDataCipher` over it) and, on tsyringe, `event-sourcing.module.ts` (binds `EventStore`, `SnapshotStore`, `CheckpointStore`, `SubjectKeyStore` and `PersonalDataCipher`, so an event-sourced repository adapter names them in its constructor; the hand-wired `Platform` carries them as `platform.eventSourcing`); `platform-test.module.ts` binds the in-memory stores, so a handler spec of an event-sourced aggregate needs no fake. `generate aggregate --event-sourced` is refused without it, with the `init --force --event-sourcing on` to run. Refused with `--orm custom`: the event store of the kit runs on PostgreSQL through the four ORM packages |
| `--privacy on` | recorded as `stack.privacy`, `on` when there is an ORM: `src/platform/privacy/`, with `data-subject-copies.ts` and `data-subject-exports.ts` (the ports, or the adapters by hand, of the contexts that extend `PersonalDataErasure` and `PersonalDataExport`, between markers; `generate repository --personal` lists the erasure and the export of a context there), `run-erasure.ts` (`runErasure(subject, { operator, correlationId, tenants? })`: an execution context of origin `cli` with the operator as actor, the key of the subject when the project has an event store, then `eraseDataSubject` of the kernel over the copies, `inEachTenant` with `--tenancy shared-table`, then `privacy.data-subject.erased` published through the outbox, once per tenant) and `run-export.ts` (`runExport(subject, { operator, correlationId, tenants? })`: `exportDataSubject` of the kernel over the exports, each wrapped by `auditedPersonalDataExport` with `--audit on`, `recordsInEachTenant` with `--tenancy shared-table`, one dated `PersonalDataExportDocument`), and the two scripts below. `docs/privacy/register.md`, the register of personal data `ddd-ts-kit docs` keeps (see `docs` below). A project without personal data takes `--privacy off` and pays nothing. No HTTP command erases yet: the two scripts are the entry points |
| `--tenancy shared-table` | recorded as `stack.tenancy`; the four ORMs. Every `generate repository` is tenant-scoped (as `--tenant-scoped`), through `tenantTable` and `ownTenantTable` (Knex), `tenantCondition` and `ownTenantCondition` (Drizzle), `tenantWhere` and `ownTenantWhere` (Prisma, TypeORM); the outbox keeps the tenant of each event (`createOutboxTables(knex, { tenant: true })` and `KnexOutboxStore`'s `tenant: true`, `tenantOutboxTable`, the `tenantId` field of the Prisma model and `PrismaOutboxStore`'s `tenant: true`, `outboxEntity({ tenant: true })`), so consumers run in it; `tenancy/scoped-statement` judges the adapters. Row-level security, schema per tenant and database per tenant are refused, with what to wire by hand ([Multitenancy](../../docs/concepts/multitenancy.md)) |
| `--queue database\|redis\|memory` | recorded as `stack.queue`. `database` (the default on Knex, Drizzle, Prisma and TypeORM, whatever the container): the tables of the ORM package (`createJobTable` and `createProcessTable`, `jobsTable` and `processesTable`, the `BackgroundJob` and `ProcessInstance` models, `jobEntity` and `processEntity`) in the `messaging` schema, `Persistence` gains `jobs` and `processes`, and the platform binds `JobStore` and `ProcessStore` to them (the platform module on tsyringe, `jobs/create-background-work.ts` where the platform is wired by hand or under Nest), so a job enqueued by a command is written in its transaction; `redis` (with `--cache redis`): `RedisJobStore` on the connection of the cache, the processes in the database; `memory` (the default with a custom persistence or none): nothing is written, both stay in the process. Refused: `database` with another ORM, `redis` without the cache |
| `--cache redis` | `src/platform/redis/open-redis.ts` (`RedisServices`: the cache bound to the kernel `Cache`, the limiter to `RateLimiter`, the lock to `Lock`, which keeps a scheduled job to one instance, the relay signal as the `wakeOn` of the outbox relay with `relayWakeUpMiddleware` on the command bus), `http/too-many-requests-for.ts` (one sliding window per caller address, 429 `application/problem+json` with `retry-after`; `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`), `GET /health/ready` on the HTTP server, `REDIS_URL` validated, a compose service `cache` running Dragonfly with a healthcheck. Without a server (tools, tests without `REDIS_URL`) the same ports stay in the memory of the process |
| `--http-cache varnish` | a compose service `varnish` (Varnish 9.1.0, reaching the API on `host.docker.internal`) with its VCL in `docker/varnish/default.vcl` (only answers whose `Cache-Control` allows them by `max-age` or `s-maxage` are kept, filed under their `xkey` tags, purged by `PURGE` from the machine of Varnish or with `VARNISH_PURGE_KEY`, `x-cache: HIT\|MISS`), `VARNISH_URL` and `VARNISH_PURGE_KEY` validated, `cacheTags: { header: CacheTagHeader.xkey }` in the HTTP boundary, and the outbox relay of `main.ts` and of every `generate service` entry point publishing through `PurgingPublisher` with `VarnishCachePurger` (the end-to-end application records the purges in `purges`); on `--di manual` and `nest` the platform gains `cacheInvalidation`; with `--tenancy`, the tags of the answers and the purges are filed under the tenant (`perTenant`) and the tenant of a request is read from `x-tenant-id`. Needs an HTTP framework and `--events outbox`: a purge is a row of the outbox |
| `--errors sentry` | unexpected failures reported to Sentry or GlitchTip (one protocol, only the DSN differs) through the kernel `ErrorReporter`, bound to `@ddd-ts-kit/sentry`. `src/platform/observability/errors.ts` (`initSentry` on the validated configuration, then `reportProcessFailures`), the second import of `main.ts`, of `apps/<context>/main.ts` and of `apps/worker/main.ts`, right after `tracing.ts`; `errors` handed to `composeApplication`, which gives it to the kernel module on tsyringe (`errorReporter`, flushed by `container.stop()` before the logger, `errorReportingMiddleware` first on both buses, the default scheduler observing with `reportFailedRuns`) or to `createPlatform` by hand (the same middleware, `onRun: reportFailedRuns(errors)`, `platform.errors`, flushed two seconds at most when the application stops); `reportHttpErrors` in `auth/authentication/http-boundary.ts` for every request answered 5xx; `DeadLetterReports` on the `onFailure` hook of a provided broker (`createEventProvider(config, errors)`, with `observing` around each consumer) and of the outbox relay. `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (default: `NODE_ENV`), `SENTRY_RELEASE` and `SENTRY_SCRUB_MESSAGES` validated in `config/load-config.ts` as `errorReporting`: without a DSN the application starts and reports nothing; a DSN that is not a URL refuses the start. Dependencies `@ddd-ts-kit/sentry` and `@sentry/node`. A compose profile `errors` running GlitchTip 6.2.6 with its own PostgreSQL and Valkey (`GLITCHTIP_PORT`, loopback only, development bootstrap), and a section of the generated README saying how to read its DSN. The tools and the tests compose the application without a reporter. It goes with every other choice of the stack; with `--errors none` nothing of this is written |
| `--authn keycloak` | a compose service `keycloak` (Keycloak 26.8.0, `start-dev --import-realm`, profile `identity`) and `docker/keycloak/<project>-realm.json`: the API client, a public client `<project>-local` with the direct grant, its audience and `tenant_id` mappers, the realm role `admin`, and the demo users `demo-admin` and `demo-user`, for local development only |
| `--storage local\|s3` | recorded as `stack.storage`: where the content of files lives, never in the database. `src/platform/config/read-files.ts` and `src/platform/files/open-files.ts`, one per choice: `local`, a directory in development (`FILES_DIRECTORY`, `.data/files`) and the signed links answered by the application under `/files` (`FILES_PUBLIC_URL` and `FILES_SIGNING_SECRET` required in production); `s3`, a bucket of any provider of the S3 protocol through `@ddd-ts-kit/s3` (the `S3_*` variables, MinIO in the compose stack); the memory of the process in the tests and the tools, either way. With `--di tsyringe`: `files/bind-files.ts`, `files/files.module.ts` and `files/staging-uploads.ts`; with hand wiring `files/create-files.ts`; with an HTTP stack `files/file-routes.ts`. They bind `FileStorage`, `FileKeys`, `FileScanner` and `FileStaging`, register the hourly purge of staged files and stage the file a command carries before its transaction; `generate file-upload` needs them. `--storage none` writes none of this ([File storage](../../docs/concepts/file-storage.md)) |
| `src/platform/events/` | `event-provider.ts` (`bus`, `forConsumer(name)`, `start()`, `close()`), `in-process-events.ts`, and for `--broker` `create-event-provider.ts`: `RabbitMqEventBus` (`AMQP_URL`), `KafkaEventBus` (`KAFKA_BROKERS`, with `aggregate-key-of.ts` for per-aggregate order), `NatsEventBus` (`NATS_URL`) or `RedisStreamsEventBus` of `@ddd-ts-kit/redis/event-bus` (`REDIS_URL`: Redis, Dragonfly or Valkey), each with one subscriber per consuming context (`forConsumer`), `assertTopology` at start, its address validated and a compose service with a healthcheck; or `custom-event-bus.ts` with its `eventBusContract` spec. `start-outbox-relay.ts` with the outbox. `--broker redis` with `--cache redis` is one server and one compose service, `cache`; alone, the service is `streams` |
| `src/platform/database/` | `persistence.ts` (`interface Persistence`: unit of work, outbox and processed-event stores of the ORM package, the storage handle), `open-persistence.ts`, `persistence-over.ts`, `inert-persistence.ts`, the connection (`connect-to-database.ts`, `create-client.ts` or `create-data-source.ts`), `schema.ts` (`MESSAGING_SCHEMA`, the schema of what the kit stores for the application), `open-test-database.ts` (PostgreSQL in process, or the server named by a URL; with Vitest each spec opens a copy of the cluster `test/support/test-database-template.ts`, the global setup of the run, initialised once, and creates its tables there; with drizzle from `table-statements.ts`, the SQL of the tables of `schema.ts`, since drizzle-kit writes migrations, not tables, its unique indexes included), `persistence.contract.spec.ts` (the outbox, processed-event, job and process stores as the platform wires them, held to the contracts of `@ddd-ts-kit/testing` with what the stack turns on: the tenant under `--tenancy`, the unit of work). The storage class a repository adapter names in its dependency list: `database.ts` with drizzle and prisma (`abstract class Database extends` the context type of the ORM package), `KnexContext` of `@ddd-ts-kit/knex`, `TypeOrmContext` of `@ddd-ts-kit/typeorm` |
| migration tooling | `drizzle.config.ts`, `knexfile.js` and `migrations/00000000000000_initial.js`, `prisma/schema/schema.prisma` (the client, the datasource and the tables of the platform; `generate repository` adds the file of each context, `prisma/schema/<context>.prisma`) and `prisma.config.ts`, or `data-source.ts`. A project that keeps the one `prisma/schema.prisma` of versions before 0.95 keeps it with its `prisma.config.ts` and its `db:client`, even under `--force`: `init` writes nothing under `prisma/schema/`, its notes give the steps of the move with the contexts of the project named, and `generate repository` refuses until the move |
| `scripts/openapi.ts`, `scripts/events.ts` | write `openapi/openapi.yaml` (one file per document of `openapi.documents`), `docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md`, in JSON under `openapi.format: json`; `--check` fails on a difference |
| `scripts/privacy-erase.ts`, `scripts/privacy-export.ts` | with `--privacy on`, the two requests of a data subject, answered from the command line on the sources with the variables of `.env` (`npm run privacy:erase -- <subject-id> [--operator <who-asks>]`, `npm run privacy:export -- <subject-id> > export.json`): the erasure destroys the key of the subject first when the project has an event store (`--event-sourcing on`: its stored events read as erased; audited with `--audit on`), then erases every copy listed in `src/platform/privacy/data-subject-copies.ts`; `privacy:purge` runs by hand what the job `privacy.purge-expired` runs every night at 03:00 UTC, the purge of what outlived its retention (`JOB_PRIVACY_PURGE_EXPIRED_ENABLED=false` switches the job off); the export gathers every record listed in `data-subject-exports.ts` into one dated JSON document (`format`, `subject`, `exportedAt`, `records`), the export of each context audited with `--audit on`, never the values (every run leaves its entry, a trial included: try it on a test subject). With `--tenancy shared-table`, `TENANTS` names the tenants, comma separated: a write of tenant data is never widened. Neither reaches backups, logs or a copy no context declared |
| `docker-compose.yml`, `.env.example`, `Dockerfile`, `.dockerignore` | the database with a healthcheck and a named volume, `jaegertracing/jaeger:2.22.0` behind the `observability` profile (its UI and its OTLP port bound to 127.0.0.1), ports from `.env`; a multi-stage, non-root image with production dependencies only |
| `vitest.e2e.config.ts`, `test/e2e/support/` | `start-application.ts` (the whole application on a free port, on an in-process database unless `DATABASE_URL` is set, no job run by time; `settled()` resolves once the outbox has relayed what the requests stored; `publish(events)` hands integration events of an upstream to its handlers, as the relay of that upstream would), `create-credentials.ts`, `auth-environment.ts`, `test-environment.ts`, `story-of.ts` (`storyOf(trace)`: a trace without the calls an adapter makes on itself, the form `expectSpanTree` asserts) |
| `docs/context-map.md`, `docs/integration/README.md` | see `docs` |
| `test/architecture/extractable.spec.ts` | written with the first context: boots each context alone on the kernel and the platform, its jobs included |
| `eslint.config.mjs` | the `dddTsKit` preset of `@ddd-ts-kit/eslint-plugin`, typed linting on the project's tsconfig |
| `.dependency-cruiser.cjs` | the import graph rules, generated from the config (see `depcruise-config`) |
| `biome.json` | the formatter: Biome with its linter and its import organiser off, line width 120; `npm run format` writes, `npm run format:check` checks, and what the CLI generates is already formatted |
| `knip.json` | dead code: entry points are `main.ts` and `apps/*/main.ts`, the scripts, the specs and the fakes, the module files in the explicit style, the role files under discovery (jobs and publishers included) |
| `vitest.config.ts` | unit and integration projects, the coverage thresholds read from `ddd-ts-kit.config.json` (`governedCoverage`), per context and layer, in the standard decorator mode `decorators()` of `@ddd-ts-kit/testing/vitest`, which compiles the files holding a decorator with the compiler of the project (Vitest does not lower standard decorators; it lowers legacy ones itself, so a project with `experimentalDecorators` gets no plugin), and under `--assembly discovery` `server.deps.inline: ['@ddd-ts-kit/di']` |
| `lefthook.yml`, `commitlint.config.mjs` | pre-commit (ESLint, the format check and `check` on the staged files, `check --commit-size --staged`, which never blocks, and `secrets`: gitleaks on the staged changes when its binary is on the path, one line and no refusal otherwise, the pipeline scanning the whole history anyway), pre-push (types, unit tests) and commit-msg hooks (`npm run hooks:install`), each run by the lefthook of the checkout it fires in (`lefthook: node_modules/.bin/lefthook`: a worktree without its dependencies fails the commit instead of skipping the checks), conventional commits |
| `--ci github` | `.github/workflows/ci.yml`, `pr-title.yml`, `copilot-setup-steps.yml` (Node and the dependencies, installed before the Copilot cloud agent starts), `.github/dependabot.yml`, `.github/branch-protection.md`, `renovate.json`; `codeql.yml` with `--ci-extras codeql`, `claude-review.yml` and `claude-triage.yml` with `--ci-extras claude-review,claude-triage`; `intent-to-spec.yml` with `--ci-extras intent-to-spec` |
| `--ci gitlab` | `.gitlab-ci.yml` (architecture findings as a Code Quality report through `check --format gitlab`), `.gitlab/merge-request-settings.md`, `renovate.json`; `.gitlab/claude-review.gitlab-ci.yml` with `--ci-extras claude-review,claude-triage` |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*.md`, `.github/instructions/*.instructions.md` | how to run it; a slim guide in `AGENTS.md`, which Codex, Copilot and most coding agents read and `CLAUDE.md` imports (commands, how to read less, the map of the rules, generated files, the verification commands with the lines each prints when it passes, to run before reporting done, the mistakes seen here, a section the team owns under the rule of two, compiler note, the skills of the plugin: `/ddd-ts-kit:start`, `glossary`, `use-case`, `document`, `quality-gate`) and the invariants in seven rule files, `domain.md`, `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md`, `platform.md` and `tests.md`, each scoped by a `paths` frontmatter, and the same seven for GitHub Copilot, each scoped by `applyTo` |
| `REVIEW.md` | the review policy of the project: the passes of a review (bugs, security, compliance against the design review of the row, the acceptance of the story, the records of `docs/adr/` and the rules), what Important means, at most five nits (a recurring one becomes a line of `AGENTS.md` under `## Mistakes seen here` or a rule of the config), what is not reported (generated files, what `npm run verify` refuses). Read by the `architecture-reviewer` agent on top of its method, by a human reviewer and by any review bot. Written once, for the team to edit: `--force` leaves it alone, `doctor` says when it is missing |
| `.github/copilot/settings.json` | the plugin of the kit, declared for GitHub Copilot (`extraKnownMarketplaces`, `enabledPlugins`): its cloud agent installs it, the Copilot CLI and VS Code recommend it; an existing file keeps what it holds and gains the two entries |
| `.claude/hooks/production-gate.mjs`, `.claude/hooks/change-reference.mjs` | with `--agent-profile regulated`: the two hooks of the profile, registered under `hooks.PreToolUse` of `.claude/settings.json`, written once for the team to edit (`--force` writes them again). The gate blocks a command that names the production environment with a release action unless `RELEASE_APPROVAL` names an approver and a change; the reference asks before an edit of a migration or of the containers, for the `Change: <id>` trailer of the commit ([Sandboxing coding agents](../../docs/guides/agent-sandbox.md#the-regulated-profile)) |
| `.claude/settings.json` | permissions (and, with `--agent-profile regulated`, the sandbox block below): the checks and generators run without asking, `.env` files are unreadable (`.env.example` stays readable), `git push`, `npm publish` and any edit of the files that hold the rules and the pipeline (`ddd-ts-kit.config.json`, `REVIEW.md`, `eslint.config.mjs`, `biome.json`, `.dependency-cruiser.cjs`, `knip.json`, `lefthook.yml`, `.gitlab-ci.yml`, `.github/workflows/**`, `.claude/settings.json`, `.github/copilot/settings.json`) ask first, and so does an edit of the generated contracts and of the lock of an acceptance (`openapi/**`, `docs/integration/asyncapi.*`, `docs/integration/event-catalog.md`, `test/acceptance/*.acceptance.lock.json`: an ask rule, since the sandbox of Claude Code would make a denied path read-only to `docs:generate` and `acceptance --lock` too; the guard of the plugin refuses a hand edit of them) and of what reaches production otherwise than through the code: the migrations of the ORM (`migrations/**` with drizzle, knex and typeorm, `prisma/migrations/**` with prisma, nothing with a custom persistence or none), `Dockerfile`, `docker-compose.yml` and `docker/**`. The compose file reads `.env` at the root, which the deny list already covers; nothing under `docker/` holds a secret |
| `.gitignore` | `node_modules`, `dist`, `coverage`, `.env`, `*.tsbuildinfo`, `.ddd-ts-kit/`, where `worker-scope` writes, and `.worktrees/`, where the worktrees live |

`--ci both` writes the two pipelines, `--ci none` neither (and no `renovate.json`). The pipeline
files are copies of the assets of the repository's `pipeline/` directory, shipped in
`templates/pipeline/`; a test fails when a copy differs from its source by more than its
documented placeholders.

`--agent-profile regulated` records `agents.profile` in the config, with or without `--force`
(`--agent-profile none` removes it), and writes the `sandbox` block of Claude Code next to the
permissions: enabled, failing when the sandbox is unavailable, no unsandboxed retry, the caches
the install of the stack writes as the only paths outside the project and the temporary directory
(`~/.npm`, or the store and the cache of pnpm, and `~/.cache/prisma` with Prisma), the npm
registry, the git host of the project (from `repository` of `package.json`, else the `origin`
remote) and the hosts the install scripts of the stack download from (`binaries.prisma.sh` with
Prisma, `github.com` and `release-assets.githubusercontent.com` with the Kafka client) as the only
hosts, the credential files (`~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.azure`) and the usual secret variables denied to every sandboxed command; a key the project
already set is kept, and a list it holds gains the entries the stack needs. It also prints, as a
note, that the owner runs the first install outside the agent (a path missing when a session
starts stays read-only to it) and then pins the install scripts of the stack to the versions read
(`npm install-scripts approve <package>...`, or `'<package>@<version>': true` in `allowBuilds`
under pnpm), a bump of one of them asking the same again, and the block of managed settings a project file
cannot set (`allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`,
`permissions.disableBypassPermissionsMode`, `strictKnownMarketplaces` with the marketplace of
the kit, `requiredMinimumVersion`), for the platform team to paste, and writes the two hooks of
the profile under `.claude/hooks/` ([Sandboxing coding agents](../../docs/guides/agent-sandbox.md#the-regulated-profile)).

An existing `.claude/settings.json` is never overwritten: the missing permissions are appended
to its lists, everything else is kept, and the notes of the command list what was added. The
`.env` rule relies on the gitignore semantics of permission patterns: `Read(./.env.*)` is
denied and `Read(!./.env.example)`, a negation placed after it in the same list, takes the
example file back out.

Every `.ts` file `init` and `generate` write imports by the alias (`@/platform/observability/errors`),
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
of the context to fill in. Both refuse a context named `schema`, on every ORM: on Prisma the models
of a context live in `prisma/schema/<context>.prisma`, and `prisma/schema/schema.prisma` is the
main file every context shares (`init --force` moves a project to Prisma).

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
the grant `'identity:*'` of `platform/auth/authorization/signed-in-grants.ts`, answered by
`SignedInGrantsAuthorizer` before the model in `createAuthorizer`. With tenants, the tables of
the context belong to none, under a decision record the preset writes and the declaration of the
context as the control plane of the tenants (`contexts.<name>.tenancy`, no suppression in its
adapters), and with `--authn keycloak` the authenticator reads the `organization` claim as the tenants of the person
(another authenticator gets a next step saying what to map). The preset is written for
`declared` with `signature` dependencies, `factories`, `throwing` value objects, `controllers` or `nest` routes (Nest controllers, read from their
signatures, on a Nest project),
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
would update src/contexts/notification/notification.permissions.ts
would update src/contexts/notification/application/application.declarations.ts

Next, in this order: the language of the context first, then the business decisions only you can make
  src/contexts/notification/application/commands/archive-notification/archive-notification.command.ts:9  declare the input of "archive notification" as a constructor with the actor first, ...
  src/contexts/notification/application/commands/archive-notification/archive-notification.handler.ts:16  decide what "archive notification" does to a Notification: ...
  src/contexts/notification/test/unit/archive-notification.handler.spec.ts:38  replace each entry below by a test named after the business behaviour of "archive notification": ...
```

| Kind | Arguments | Writes |
|---|---|---|
| `context` | `<name> --classification <c> [--purpose "<two sentences>"] [--term ...]... [--upstream <ctx>[:relationship]]... [--preset identity]` | `CONTEXT.md` with its glossary, `published-language/index.ts`, config entry, registration in `platform/composition/compose-application.ts` and in `test/architecture/extractable.spec.ts`; on tsyringe, with HTTP, `presentation/http/<name>.routes.ts` (a function of the two buses, in both styles); declared: the barrel `<name>.declarations.ts`; explicit and hand wiring: `<name>.module.ts`. `<name>.permissions.ts`, at the root of the context, is born with the first permission, or at once when `platform/auth/authorization/permissions.ts` lists the permission sets (rebac, custom). With `--preset`, the context is then written whole from that preset, its classification and purpose those of the preset unless the flags say otherwise ([Presets](#presets)) |
| `aggregate` | `<context> <Name> [--event-sourced [--birth <Event>]]` | aggregate, builder, spec in given / when / then; with `--event-sourced`, an aggregate on `EventSourcedAggregate` whose state is the replay of its events, born with its `Created` domain event (or the fact `--birth <Event>` names, checked against the glossary), the codec of its stored events in `infrastructure/persistence/<name>-events.mapper.ts`, a builder that replays a history and a spec given events, and a note naming the `EventSourcedRepository` its repository adapter delegates to; refused while `stack.eventSourcing` is `off`, with the `init --force --event-sourcing on` to run |
| `builder` | `<context> <Aggregate>` | `test/builders/<name>.builder.ts`, a class extending `Builder` |
| `test-world` | `<context> [Name]` | `test/worlds/<name>.world.ts` (the name defaults to the context): `a<Name>World({ now, idPrefix, given })`, the arrangement several specs of the context share. It reads the fakes of `test/fakes/` and the port each one implements, builds them, hands them to `given` so that the spec stores what it starts from, then to the test application (with `modules`, the authorization of the spec) or, wired by hand, wraps the repositories of the buses of `createTestBuses` with `dispatching`; it returns every fake under the name of its port. A fake that needs constructor arguments, or, under a container, stands for a port nothing binds or depends on yet, is left out with a note |
| `entity` | `<context> <Name>` | entity, spec |
| `value-object` (`vo`) | `<context> <Name>` | value object, spec |
| `vocabulary` | `<context> <Name> --value <value> [--value <value>]...` | `domain/vocabularies/<name>.vocabulary.ts`: an object `as const` of the values, keyed by each value in PascalCase, and the union type of the same name; run again, adds the values the file does not hold |
| `domain-event` | `<context> <Aggregate> <Fact>` | event named `<context>.<aggregate>.<fact>`, spec |
| `error` (`refusal`) | `<context> <Refusal> <factory> [--code CODE] [--term ...]...` | under `"stack.refusals": "named"`: the class `<Refusal>` in `domain/errors/<refusal>.error.ts`, extending `DomainRefusal` and reading its code from the list, its entry in `<context>.codes.ts` (the list `<Context>Codes` and its type `<Context>Code`, created when absent; the entry is added at the end), the static factory `<factory>` and its case in `test/unit/<refusal>.error.spec.ts`. Each is written when absent: run again, the command changes nothing; given another factory, it adds it to the class. `<Refusal>` is in PascalCase (a trailing `Error` is dropped), named with terms of the glossary and the qualifiers of a refusal, `invalid`, `unknown`, `already`, `too`, `no`, `missing` and `required` (`BookingTooLate`): a word the glossary does not define is refused, with the `--term` that adds it; `<factory>` starts with `for`, `with`, `because`, `on` or `at` (`forAccountId`), else the command refuses and proposes `for<Factory>`. The code is the refusal in constant case (`InsufficientFunds` sets `INSUFFICIENT_FUNDS`), `--code` gives another; refused: a code already set in the context. Under `factories` and `classes`, `<context> <Concept> <refusal>`: a static factory `<refusal>` on `domain/errors/<concept>.error.ts`, the class of the errors of that concept (created when absent, extending `ConceptError`), and its case in `test/unit/<concept>.error.spec.ts`. The factory is added after the last one; run again, the command changes nothing. `<Concept>` is a term of the glossary (`--term` adds it). The code is the name of the refusal in constant case, with the concept before it when the name is one word or a code of the kit (`Appointment notFound` sets `APPOINTMENT_NOT_FOUND`); `--code` takes one of the forms `errors/factory-name` accepts. Refused: a name such as `create` or `error1`, and a code already set in the context |
| `domain-error` | `<context> <Name> [--code CODE]` | one class per error with a stable code, spec: the form of a project whose config says `"stack.refusals": "classes"` or nothing. Refused under `named` and `factories`, with the `generate error` command to run instead |
| `domain-service` | `<context> <Name>` | service, spec |
| `state-machine` | `<context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]...` | the vocabulary `<Aggregate>Status` (created from `--value`, two states at least, or given the values it misses), `domain/state-machines/<aggregate>.state-machine.ts` (`<aggregate>Lifecycle`: every value a state, the first one initial, the transitions asked, a `TODO(domain)` for the refusal of the concept error) and `test/unit/<aggregate>.state-machine.spec.ts` (each transition where it leads, a refusal from a state it does not leave); the aggregate is left to use it |
| `repository` | `<context> <Aggregate> [--tenant-scoped] [--personal <column>,... [--subject <column>] [--erasure pseudonymise\|row] [--retention <column>:<n><d\|m\|y>]]` | the port `domain/repositories/<name>.repository.ts` (`abstract class <Name>Repository extends Repository<<Name>>`), the adapter of the project's ORM (`implements` the port) with its mapper and table (or model), a fake, one `repositoryContract` spec run on both, registration. On an event-sourced aggregate (its class extends `EventSourcedAggregate`) there is no table nor mapper: `event-store-<name>.repository.ts` delegates to `EventSourcedRepository` of the kernel over the `EventStore` and the `PersonalDataCipher` the platform binds, with the codec of `<name>-events.mapper.ts` (the snapshot policy left as a `TODO(domain)`), the fake is that adapter over the in-memory stores, and the contract suite runs on both (its stale-save case pending until a `mutate` that records an event is added); `--personal` is refused there, the personal values being sealed in the events. With `--personal`, the columns of the table that hold personal data: added to the storage and to the row type as nullable text (the mapper writes them empty until the aggregate carries them), declared next to the mapper in `<name>.personal-fields.ts` (`personalFields` of the kernel: the subject column, `id` unless `--subject` names the column that holds the id of the person, the fields, `pseudonymise` unless `--erasure row`), spelled as the erasure of the ORM reads them (SQL names on Knex and Prisma, properties on Drizzle and TypeORM); and, once per context, its erasure: the port `application/ports/<context>-personal-data-erasure.port.ts` (`extends PersonalDataErasure`), the adapter `<orm>-<context>-personal-data-erasure.repository.ts` over `<Orm>PersonalDataErasure` of the ORM package (confined to the tenant of the work with `--tenant-scoped`), its fake, bound where the context binds its adapters and listed in `src/platform/privacy/data-subject-copies.ts`, so that `npm run privacy:erase` reaches it; and its export: the port `<context>-personal-data-export.port.ts` (`extends PersonalDataExport`), the adapter `<orm>-<context>-personal-data-export.repository.ts` over `<Orm>PersonalDataExport`, its fake, bound the same way and listed in `data-subject-exports.ts`, so that `npm run privacy:export` hands it over; one spec, `test/integration/<context>-personal-data.spec.ts`, proves both on the test database. With `--retention <column>:<n><d|m|y>`, the declaration gains `retention`, counted from a column that dates the end of the relation and joins the storage as a nullable timestamp, empty while it lasts (a column the table keeps for itself, `registered_at` first, is refused: counted from the registration, the purge would erase people who are still customers) and the spec proves the purge of what outlived it. A second table of the context joins the declarations of both adapters. Refused without `stack.privacy` on (`init --force --privacy on`), with `--orm none` or `custom`, and before anything is written for a column that is not one, a column the table keeps for itself, a subject listed as personal or a mode that does not exist |
| `command` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--aggregate <Name> [--creates]]` | `<use-case>.command.ts` on `AuthorizedCommand` (plain `Command` when public), `<use-case>.handler.ts` (with `--aggregate` it receives the repository and writes nothing until its `TODO(domain)` is answered: a command changes an aggregate that exists; with `--creates` it builds the aggregate, saves it and answers its identifier: the events leave with the save), spec through the bus with the refusal of an actor who lacks the permission, registration with `.requires(...)` or `.public()` (and the repository when missing). A generated command answers `void` or the identifier of its aggregate, so no `<use-case>.result.ts` is written |
| `query` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--search]` | `<use-case>.query.ts` on `AuthorizedQuery` (plain `Query` when public), `<use-case>.result.ts`, `<use-case>.handler.ts`, the read port `application/ports/<use-case>-reader.port.ts` (an abstract class), its in-memory adapter, fake, spec, registration on the query bus. With `--search` (needs `--permission`): a kernel `PageRequest` in the query, the item, the sort and `Page<Item>` in the result file, a handler that asks `Access.scope` and hands the scope to the read port, an in-memory reader paging by offset or cursor |
| `port` | `<context> <Name>` | `application/ports/<name>.port.ts`, one abstract class, and its fake |
| `route` | `<context> <UseCaseName> --method <GET\|POST\|PUT\|PATCH\|DELETE> --path <p> [--command\|--query] [--group <Name>] [--mapper] [--serializer] [--cache public\|private\|no-store]` | under `"stack.routes": "controllers"`: a controller class in `presentation/http/<resource>/<use-case>/` (the resource is the first segment of the path), depending on `CommandBus` or `QueryBus`, behind the route group of its resource, written with it when it is new (`<resource>.routes.ts`: prefix, tag, `Authenticated`); a public use case stands in no group and says `guards: [Public]`; with class-validator one class per file (`<use-case>.params.ts`, `.body.ts`, `.answer.ts`, `.accepted.ts`, `.line.ts`); `--mapper` and `--serializer` add a request mapper and a serializer the controller is given; a spec; no registration in a declared project, a controller built by hand in `<context>.routes.ts` (the module file with hand wiring) in an explicit one. Under `"functions"`: a `defineRoute` function, its spec, its registration in `<context>.routes.ts`, and `<use-case>-<role>.dto.ts` classes |
| `controller` | the same arguments as `route` | the controller class, whatever `stack.routes` says: for a project of function routes that writes its next route as a class. `--cache` writes its cache policy: `private` (a `GET` of a caller, `max-age=0`, `must-revalidate`, strong `ETag`), `public` (a `GET` of a public use case, `max-age` 1m, `s-maxage` 5m, tagged with the resources of its path), `no-store`; refused on a write, and `public` behind a route group |
| `file-upload` | `<context> <UseCaseName> --path <p> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--method POST\|PUT] [--group <Name>]` | an upload: a controller that declares the file it receives (its size and media types in the contract, checked as it streams), the command that carries it as a `FileUpload`, staged by the command bus before the transaction, the handler that records it and promotes it with the commit, and their specs. Refused without `stack.storage` or without an HTTP stack, with the `init --force --storage local` to run |
| `route-group` (`group`) | `<context> <Name> [--prefix <path>] [--group <ParentName>] [--public \| --role <role>]` | `presentation/http/<name>.routes.ts`: an empty class carrying `@RouteGroup`, behind `Authenticated` unless `--public` or `--role` says otherwise (`HasRole(Role.Admin)`, the role read from the vocabulary of the platform, `<platformDir>/auth/authorization/role.ts`, which gets it when it does not hold it); with `--group` it refines that group and inherits from it |
| `guard` | `<context> <Name>` | `presentation/http/guards/<name>.guard.ts`: a declared guard class to fill, and its spec |
| `representation` | `<context> <UseCase> <xml\|csv\|media/type>[,...]` | adds `produces` to the `@Controller` of the use case, and `consumes: ['application/xml']` to one that receives a body when XML is asked; says when CSV needs a page or a streamed list, and when `stack.representations` is not `negotiated` |
| `form` | `<context> <UseCase>` | adds `const form = defineForm<Infer<typeof body>>({ ... })` before the `@Controller` of a use case that receives a body, and `form` to its options: the hints of its form at `GET /forms/<operationId>` |
| `schema` | `<context\|shared-kernel> <Name>` | `presentation/http/shared/<name>.schema.ts` of the context, or `presentation/<name>.schema.ts` of the shared kernel: one shape of the contract declared once (a zod schema with `.meta({ id })`, a class-validator class, or a schema wrapped by `sharedSchema`), to fill; the routes use it whole, nested or in part |
| `integration-event` | `<context> <Aggregate> <Fact> [--version n]` | `defineIntegrationEvent` declaration in the published language (its payload in `<event>.v<n>.payload.ts` with class-validator or a schema of your own), index export, the publisher `application/integration/publishers/<event>.publisher.ts`, spec, registration, a line of `platform/audit/audited-events.ts` |
| `integration-handler` (`consumer`) | `<context> <upstreamContext> <eventType>` | `application/integration/handlers/<name>.integration-handler.ts`, a class `<Name>IntegrationHandler` depending on `CommandBus`, its spec, its idempotent subscription under the consumer name `<context>.<name>`; refused unless the upstream is declared |
| `erasure-handler` | `<context>` | `application/integration/handlers/data-subject-erased.integration-handler.ts`, a class `DataSubjectErasedIntegrationHandler` that erases what the context keeps of a person through its `<Context>PersonalDataErasure` when the platform announces `privacy.data-subject.erased` (`dataSubjectErasedV1` of the kernel), its spec on the fake, its idempotent subscription under the consumer name `<context>.data-subject-erased` (in a transaction behind a broker); for a context that runs as a service of its own or copies personal data from events. Refused until the context has its erasure (`generate repository --personal`), and refused on an event-sourced context, whose personal values are erased by destroying the key of the subject (`eraseDataSubject`) |
| `event-handler` | `<context> <Aggregate> <Fact> [--phase before-commit\|after-commit]` | reaction to a domain event of the context, spec, subscription; before the commit of the unit of work by default, after it with `--phase after-commit` (an effect no transaction covers, at most once), and the spec runs the reaction in that phase |
| `projection` (`projector`) | `<context> <Name> <event-type>` | a projector in `application/projections/<name>.projection.ts`, declared with `@Projection('<context>.<name>')` and one `@On(definition)` method for the integration event, which the context itself or a declared upstream publishes, and its spec. In the explicit style on tsyringe the module file of the context includes it with `builder.include(<Name>Projection)`; on a hand-wired platform the class is plain and the module subscribes it under its consumer name. It keeps one read model: its port is received in the constructor |
| `job` | `<context> <Name> (--every <duration> \| --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName>` | `application/scheduling/<name>.job.ts`, a class `<Name>Job implements ScheduledJob` that sends the command, as `systemActor('<context>.<name>')` when it is protected, with `execution.scheduledAt` when the command takes it; `test/unit/<name>.job.spec.ts`, which runs the job (by name on tsyringe, `application.jobs.runNow`; `job.run(occurrence)` with hand wiring) and asserts the command it sent; its registration; its switch in `platform/jobs/job-settings.ts`; the grant of its system actor (below) |
| `background-job` | `<context> <Name> --command <UseCaseName>` | `application/background/<name>.background-job.ts`, a class `<Name>BackgroundJob implements BackgroundJob<<Name>Payload>` named by its static `jobName` `<context>.<name>`, that sends the command as `execution.actor` when it is protected, followed by one field of `<Name>Payload` per other parameter of the constructor of the command (strings, numbers, booleans, literals and lists of them as written, a `Date` as its ISO text; anything else is refused); `test/unit/<name>.background-job.spec.ts`, which enqueues it with a payload of every field as a user and runs what is due (through the test application on tsyringe, through a queue and a worker in memory on the test buses otherwise); its registration (`@Background()`, `builder.backgroundJob(..)` in the module file on tsyringe, `platform.backgroundJobs.register(..)` in the module file of a platform wired by hand) |
| `process` (`process-manager`) | `<context> <Name>` | `application/processes/<name>.process.ts` (its state, `processName`, `timeoutJob`, `isState`, a first step that arms a deadline, a step that ends it in time, the step of the deadline), `application/background/<name>-timeout.background-job.ts`, which delivers its timeouts through `ProcessRunner`, and the specs of both (`givenProcess`, the queue of the test application on tsyringe, a queue and a runner in memory on the test buses otherwise) |
| `acl` | `<context> <upstreamOrSystemName>` | translator in `infrastructure/anti-corruption/`, spec |
| `e2e` | `<context> <UseCaseName> [--event <eventType>]` | `test/e2e/<use-case>.e2e.spec.ts` driving the route of the use case: 401 without a credential, 403 without the permission, the documented status with it; for a command, one more test asserts the trace of the request, exact on names and structure, with `installTestTracing()` and `expectSpanTree(storyOf(trace), [...])` of `@ddd-ts-kit/tracing/testing` (`POST /invoices`, then `command IssueInvoiceCommand`, then `repository InvoiceRepository.save`). A use case no route reaches, started by an integration event handler of the context, gets a spec that publishes the upstream event, built from its declaration, with `application.publish([event])`, awaits `application.settled()` and leaves `it.todo` for what a client observes (the `GET` routes of the context, or the events it publishes with `collectEvents`); the handler that sends `<UseCase>Command` is found in `application/integration/handlers/`, and `--event billing.invoice.issued` names the event when handlers of several send it, or when the handler does not send it yet. Needs the route, or that handler |
| `policy` | `<context> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, spec; declared: the class carries `@Policy(permission, { name })` and nothing else is written; explicit: registration in `platform/auth/authorization/access-policies.ts` |
| `gateway` | `<context> <upstreamContext> <Name>` | the read contract in the upstream's published language (`<name>.contract.ts`, an abstract class and the token of the upstream value), the port `application/ports/<name>-gateway.port.ts`, an in-process adapter in `infrastructure/external/` bound `.as('gateway')`, a fake, one contract suite; refused unless the upstream is declared |
| `adapter` | `<context> <Port> [--kind external\|gateway\|simulated] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts` for an existing port, its spec, and on tsyringe its binding `builder.bind(<Port>).toClass(Remote<Port>).as(<kind>).with(ownPolicy(retry(...), timeout(...)))`; with `--decorators`, on every stack, the class carries `@Retry` and `@Timeout` of `@ddd-ts-kit/aspects/decorators` on its one outbound method and is bound `.with(ownPolicy())`. Explicit: a port that is already bound, or hand wiring, gets a note instead of a binding. Declared: the class carries `@Adapter(<Port>, { kind, aspects })`, or `@Gateway(<Port>, { aspects })` in `remote-<port>.gateway.ts` with `--kind gateway`, and a port that already has a declared adapter is refused. With `--kind simulated`: `infrastructure/external/simulated-<port>.adapter.ts` and its spec, a class of production code that answers in the memory of the process the way the outside system would, for an environment whose provider is simulated; it carries no policy (`--decorators` is refused), is declared `@Adapter(<Port>, { kind: 'external' })` or bound `.toClass(Simulated<Port>).as('external')`, and takes turns with the remote adapter, one per port |
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
  regions of `platform/composition/platform.module.ts` and `platform/composition/platform-test.module.ts`: a value or a
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
  which gives the repository its span and the dispatch of what it saves, written with the first
  command that needs it (a constant no handler reads is refused by the lint),
  `platform.commands.register(Message, new Handler(...), { context })`,
  `platform.jobs.register({ name, schedule, run })`.
- **Jobs.** The schedule is validated when the job is generated, by the rules of the scheduler
  (`parseJobSchedule` of the kernel, pinned by a test): a duration (`15m`, `2s`, digits alone are
  milliseconds) or a cron expression of five fields or a shorthand (`@daily`), with an IANA time
  zone; `--time-zone` without `--cron` is refused, and so is a job without `--command`, a command
  that does not exist (with the command that creates it) and a command whose constructor needs more
  than the actor and the instant the work is for: a job only says that the time has come, the
  handler finds what to act on. Parameters that are optional or have a default are left out of the call.
- **The grant of a job.** A job whose command is protected sends it as `system:<context>.<name>`,
  which has no right unless the model gives it one. `generate job` writes the grant where the model
  makes it one line, in a `system-grants` marker region, and `next` points at that line:
  `--authz rbac`, the id of the permission under the role `system` of `platform/auth/roles/roles.ts`,
  the role `createAuthorizer` gives every system actor (`systemRole`) and no other: a user token
  that names `system` among its roles does not hold it; `--authz abac`, a
  `permit('system-<job>', [permission], ({ actor }) => actor.id === 'system:<job>')` rule in
  `platform/auth/attributes/attribute-policies.ts`; `--authz rebac`, the tuple
  `context:<context>#operator@system:<job>` in `platform/auth/relationships/relate-system-actors.ts`,
  written to the tuple store when the application starts, as long as the schema still lets a
  `system` subject operate a context. With `--authz custom`, a removed region, a remodelled
  relationship schema or a permission the generator cannot read, nothing is written and the job
  file carries the `TODO(domain)` naming the actor and the permission.
- **The declarations are derived.** Each layer of a context that holds a declared role file has
  its `<layer>.declarations.ts`, directly in the layer: `application/application.declarations.ts`,
  `infrastructure/infrastructure.declarations.ts`, `presentation/presentation.declarations.ts`,
  and the same in each module of the model. It holds one
  `export *` per role file of the layer, sorted by path, then one `injected(Class, [Tokens])` per
  class whose constructor takes something, read from its signature, with the imports they need.
  `<context>.declarations.ts`, at the root of the context, only re-exports these files, sorted by
  path. Every `generate`, and `docs`, rewrite them and delete the declarations of a layer that
  holds no role file any more, and the `<folder>.declarations.ts` of each role folder that 0.85 and
  0.86 wrote; `docs --check` and `check` (`declarations/barrel-current`) report
  one that a role file written by hand left behind or whose constructor changed since, naming the
  class
  (`stale  src/contexts/billing/application/application.declarations.ts: the dependency list of IssueInvoiceHandler is stale: ...`).
  The `dev` script loads `ddd-ts-kit/dist/refresh-declarations.js` before the application, on
  every start and reload of `tsx watch`: a port added to a constructor is injected on the
  reload that follows the save. The same module is the binary `ddd-ts-kit-refresh-declarations`.
  It is laid out as Biome lays it out at a line width of 120; a project that formats at another
  width leaves `**/*.declarations.ts` and `**/*.dependencies.ts` out of its formatter.
- **Deny by default.** `command` and `query` are refused without `--permission` or `--public`. A new
  permission joins `<context>.permissions.ts`; its words are checked against the glossary like any
  other name. With `--authz rebac` the requirement names the context as its resource, a starting
  point to replace by the element the right bears on. With `--authz rbac`, `--grant <role>` gives
  the permission to the role in `platform/auth/roles/roles.ts` (the role joins `role.ts` when it is
  new); without it, a `next` step says the grant is left to do (`authz/granted`).
- `route` hands `actorOf(context.principal)` to a protected use case and sets `security` (the scheme
  of `--authn`, or `false` for a public one). `integration-handler` carries `systemActor('<context>.<name>')`
  for the command it builds; behind a broker it listens on the subscriber of its context
  (`EventSubscribers.forContext`), its mark and its work in one unit of work.
- A generated repository adapter only persists: it takes `ExecutionScope` and `Clock`, never
  `ActorContext` nor a dispatcher, and stamps `created_at`, `created_by`, `updated_at`, `updated_by` with `stampCreation` and `stampUpdate`;
  the table uses `auditColumns` of the ORM package (the five fields are written out for Prisma).
  The sample fact of an aggregate is `registeredAt`, since `created_at` is the audit column.
  `repository --tenant-scoped` (the four ORMs), and every repository of a project whose
  `stack.tenancy` is `shared-table`, adds the tenant column (`tenantColumn`, or the `tenantId` field
  of the Prisma model) and an index that starts with it, names the tenant on the insert and reaches
  the table through the helpers of the ORM package (`tenantTable` and `ownTenantTable` on Knex,
  `tenantCondition` and `ownTenantCondition` on Drizzle, `tenantWhere` and `ownTenantWhere` on
  Prisma and TypeORM, `findFirst` in place of `findUnique`), with a spec that one tenant does not
  see another's rows. With `custom` or no ORM the regular adapter is written and a note says what
  to add.
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
  not read as past tense are refused too; a technical word passes when a term of the glossary
  holds it (`--term "Scoring model=<meaning>"` lets `ScoringModel` through), because the language
  of the business wins. `--allow-name` overrides the three checks; `check`
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
  save of a fake announce its events to `domainEvents`. The arrangement several specs of a
  context share is generated once, `generate test-world`, in `test/worlds/`.
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
ddd-ts-kit docs [--check] [--stored-events] [--behaviour]
```

Regenerates what is derived from the config and the code, and nothing else:

- `docs/context-map.md`, between `<!-- ddd-ts-kit:context-map -->` markers: a Mermaid diagram
  (one node per context styled by classification, one arrow per relationship from upstream to
  downstream labelled with the pattern) and the table of contexts with the first sentence of
  their purpose, upstreams, downstreams, published events and whether they are deployable alone. The text outside the markers is
  kept; on first creation the four written sections are laid out with hints.
- the generated lists of every `CONTEXT.md` (aggregates, published events, personal data,
  permissions, scheduled jobs as a table of name, schedule and command, relationships); the
  personal data section is added to a `CONTEXT.md` that has none once its context declares some:
  one row per `personalFields` declaration of `infrastructure/persistence/*.personal-fields.ts`
  (the table, the column that names the person, the personal columns and files, what an erasure
  does, how long the rows are kept), then the integration events whose `personal` option says
  their payload carries some;
- with `--privacy on`, `docs/privacy/register.md`, between `<!-- ddd-ts-kit:personal-data-register -->`
  markers: the same tables across the contexts, columns named as the database names them on the
  four ORMs, and the events that carry personal data with the contexts downstream of their
  producer. The text outside the markers is kept: on first creation, the sections the controller
  writes (purposes and lawful basis, recipients outside the system, what the code does not
  purge), since the register is not the record of article 30 of the GDPR;
- the generated declarations of every declared context: the `<layer>.declarations.ts` of each
  layer, with what each constructor is injected, read from its signature, and
  `<context>.declarations.ts`, which re-exports them (the declarations of a layer left without a
  role file are deleted), or under discovery `<context>.dependencies.ts`, which holds the lists
  alone;
- the reference of every `CONTEXT.md`: the facts of `describe`, as tables under `## Reference`,
  between `ddd-ts-kit:reference` markers; a `CONTEXT.md` that has no such section gets it after its
  last generated list;
- `docs/integration/README.md`, created once and never rewritten; its Provider section starts with
  the strategy of the chosen broker;
- `CODEOWNERS` at the root (GitHub and GitLab both read it there), between `# ddd-ts-kit:code-owners`
  markers, once `contexts.<name>.owners` or `owners.platform` names an owner in the config: each
  context's tree and its `published-language/` to its owners, with the consumers of that language
  named in a comment to ask as reviewers; `src/shared-kernel/` to the owners of every context
  that imports it (to the platform owners while none does); `src/platform/`, `src/main.ts`,
  `ddd-ts-kit.config.json`, the pipeline files, `REVIEW.md`, `AGENTS.md` and `docs/adr/` to the
  platform owners. A file the team wrote keeps its lines, the block appended after them; without
  any owner nothing is written.

`--behaviour` writes the pages of `docs/behaviour/` alone, every other generated document left as it is: what the pre-commit hook runs when a spec is staged; with `--check`, those pages alone are compared. A rule is written as its title without the row ids and criteria it opens with (`#FIX1 `, `#US1.04 AC1 `), which date it to the change that brought it and mean nothing to a reader of the business.

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
ddd-ts-kit error-factories --plan [--to named|factories]
ddd-ts-kit error-factories --apply [--dry-run]
```

Moves the refusals of a project to one class per refusal (`--to named`, the default), from one
class per error (`new SlotTakenError(..)`) or from the factories of one error class per concept
(`AppointmentError.slotTaken(..)`), to `SlotTaken.forCalendar(..)`. In two steps, because the
name of a refusal and of its factory are decisions of the model.

`--plan` writes `error-factories.plan.json`, `{ "to": "named", "contexts": { .. } }`: per
context, one entry per refusal, with what builds it today (`from`: `SlotTakenError`,
`AppointmentError.ended`), its file, its code, which is kept, the class proposed for it (`class`:
the PascalCase of its code, `APPOINTMENT_ENDED` gives `AppointmentEnded`, and `X_NOT_FOUND` gives
`UnknownX`) and its factory (`factory`: `for` and its first parameter, an `Id` suffix dropped,
`appointmentId` gives `forAppointment`, `cause` gives `becauseOf`; else `for` and the concept or
the aggregate the class is named after). Edit the names
you want otherwise: two entries under one class are two factories of it, under its one code. A
factory whose code is not a string literal is left out of the plan, and moves by hand. A class
is named with terms of the glossary of its context, as `language/glossary-term` judges every
class of `domain/errors/` under `named`, the qualifiers of a refusal aside: for each proposed
class whose name uses a word the glossary does not define, `--plan` says, under "Left to you",
which words and where to define them, or to rename the class in the plan; `--apply` says it again
for each class it writes.

`--apply` follows the plan, and refuses a class that is not in PascalCase or ends with `Error`,
a factory that does not start with `for`, `with`, `because`, `on` or `at` then an upper-case
letter, a class given two codes and a factory planned twice. It:

- writes `<context>.codes.ts` in each context, the list `<Context>Codes` with one entry per
  class, and one file per refusal class, `domain/errors/<refusal>.error.ts`, extending
  `DomainRefusal` and reading its code from the list, with its factories: each keeps the
  parameters, the message and the facts it had;
- moves each case of a spec to `test/unit/<refusal>.error.spec.ts`;
- rewrites every file under the source root and `test/`: `AppointmentError.ended(a, b)` becomes
  `AppointmentEnded.forAppointment(a, b)`, `AppointmentError.is(error, 'APPOINTMENT_ENDED')`
  becomes `AppointmentEnded.is(error)`, `new SlotTakenError(..)` becomes
  `SlotTaken.forCalendar(..)`, and the name of a class per error becomes the name of its class
  everywhere else (assertions, `instanceof`, types), imports included. Comments and strings are
  left alone;
- removes the classes per error it moved, and the concept classes left empty;
- sets `"stack.refusals": "named"` in the config.

It leaves, and says with its line, what still names a concept class that is gone: a bare
`AppointmentError.is(error)`, which meant every refusal of the concept (write the refusals it
means, `AppointmentEnded.is(error) || ..`), and `CodeOf<typeof AppointmentError>` (write the
union of the codes it means, or the code type of `<context>.codes.ts`). And always: run the formatter and
the checks, decide which facts a client may read where no factory exposes any yet, assert the
facts in the specs, and delete the plan file. Run again, it finds nothing left to move. `--json`
answers `{ dryRun, moved, written, removed, manual }`.

`--to factories` is the earlier move, from one class per error to static factories on one error
class per concept, in the same two steps. `--plan --to factories` writes one entry per class of
`domain/errors/` that extends `DomainError`, with its code, the concept proposed for it (the
aggregate its name starts or ends with, empty when none does) and the factory name that says its
code (`APPOINTMENT_NOT_FOUND` on `Appointment` gives `notFound`); every entry needs a `concept`,
a term of the glossary. `--apply` then refuses an entry without a concept, a vague factory name
or one that does not say the code. It writes `domain/errors/<concept>.error.ts`, a class
extending `ConceptError` with one factory per class moved there (the parameters of the
constructor, the message it gave to `super`, and as facts the parameters that are plain data),
moves the cases of the specs under `describe('<factory>')` in `test/unit/<concept>.error.spec.ts`,
rewrites every usage (`new X(..)` becomes `<Concept>Error.<factory>(..)`, `thenError(X)` becomes
`thenError('<CODE>')`, `toThrow(X)` and `expect.any(X)` an assertion on the code,
`toBeInstanceOf(X)` `toMatchObject({ code })`, `e instanceof X` `<Concept>Error.is(e, '<CODE>')`)
and sets `"stack.refusals": "factories"`. It leaves, and says: a class that has members of its
own, reads `this` in its constructor or gives options to `super`; a place where a class stood as
a value it cannot translate; a property of the error that became a fact (`error.personId` is now
`error.facts.personId`); a factory with more than three parameters; the factories that still
take a sentence as only parameter.

## build-aliases

```
ddd-ts-kit build-aliases [--project <tsconfig>]
```

The second step of `npm run build`, after the compiler. The compiler emits an import alias as
it was written (`@/platform/observability/errors`), and Node resolves no alias and completes no extension:
this command rewrites, in every `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts` and `.d.cts` under the
output directory of the tsconfig (`tsconfig.build.json` by default), each alias specifier into
the relative path of the emitted file it names, with its `.js` extension
(`../../platform/observability/errors.js`), so that `node dist/src/main.js` runs with no loader and no flag.

```js
// dist/src/contexts/billing/domain/aggregates/invoice.aggregate.js, as the compiler emits it
import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';

// the same line after ddd-ts-kit build-aliases
import { InvoiceError } from '../errors/invoice.error.js';
```

It reads `importAlias` and `importExtension` of the config: `@/platform/observability/errors` names
`platform/observability/errors.js` under `none`, `@/platform/observability/errors.js` names it under `js`, and no other
spelling is guessed.

- Rewritten: the specifier of `import ... from`, `export ... from`, a bare `import`,
  `import('...')` and `require('...')` with a string literal, `import.meta.resolve('...')`, and
  in declarations `import type`, `typeof import('...')` and `declare module '...'`.
- Exact: the file is scanned, not searched; a string that only looks like an import, in other
  code, a comment, a template or a regular expression, is left alone. Lines never move and the
  source maps are not touched.
- Idempotent: a second run rewrites nothing.
- It exits 2 and writes nothing when an alias names no emitted file, when it is written in the spelling
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
command each sends; `jobs` in `--json`), builders, worlds, permissions, policies, gateways and whether the
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
ddd-ts-kit status [--workers]
ddd-ts-kit todo [<context>]
```

`status` prints the `Next:` line of `docs/architecture/plan.md`, the rows of
`docs/architecture/slices.md` by status and by owner, and per context the `TODO(domain)`,
`TODO(platform)` and `it.todo` left, then those outside the contexts. A missing file is not an
error. When the plan sits at step 7 (the build) the `Next:` line is derived from the rows (the next row ready on the trunk, or `7 build done` once every row is done) and the line of the plan is printed beside it, `planNext` in `--json`. Each row not done says whether it can start: ready on the trunk when every dependency is
done, ready on a branch when each dependency not done is a row briefed to a worker whose worktree
has commits ahead of its base (the `rows` of its `.ddd-ts-kit/worker.json`, as `status --workers`
reads them), and waiting otherwise, with the ids it waits for. A story or a milestone whose rows
are all done while markers of its own keep it open gets a line of its own (only the markers that
may keep such a story open are blamed, one git call per file), with the command that lists them:
`story M1: every row done, 3 markers left: npx ddd-ts-kit story-check M1` (see
[story-check](#story-check)). `--json` prints
`{ next, slices, remaining }`: `next` and `slices` are `null` when their file is missing,
`slices` holds `{ file, rows, byStatus, byOwner, duplicates, unscoped, unclosed }`, `unclosed`
being `[{ story, markers, command }]`, a row not done carrying
`ready: 'trunk' | 'branch' | 'waiting'` and `waitingFor` (its dependencies not done), and
`landedNotDone` the rows not marked done that landed on the trunk with a worker's branch, each
`{ id, commit }` (said as `#<id> landed on the trunk (<commit>) but is not marked done`),
`remaining` one `{ context, domain, platform, test }` per context, and one with an empty
`context` for what is left outside them.

`status --workers` prints the workers of a parallel build instead: each worktree of the
repository whose copy of the project holds `.ddd-ts-kit/worker.json`, with its branch, its
context, its rows, its base, the commits it is ahead of the base, `dependencies not installed`
when its copy of the project has no `node_modules`, the files it changed (committed
since the merge base, modified, and untracked but not ignored, relative to the top of the
repository) and its `.ddd-ts-kit/report.md` with when it was written. Once its branch was
squash-merged into the base, found as `merge-trunk` finds it (patch ids, no GitHub call), the
commit that took it in and the rows it had done there are shown, and its commits ahead and its
files are counted from where it landed: a reused branch with nothing new counts nothing, and no
false overlap is reported on what already landed. Its commits behind the base follow, and, when
it is behind, what `merge-trunk` would leave conflicted now (computed with `git merge-tree`,
nothing written). Then the contexts built by
more than one worker and the files changed by more than one worker, each with their worktrees.
A scope file that holds the context only is read too: the worker comes without its rows, its
base and its commits ahead, and its files are the uncommitted ones. `--json` prints
`{ workers: [{ worktree, branch, context, rows, base, ahead, behind, landed, mergePreview, installed, files, report, progress }], overlaps: { contexts: [{ context, worktrees }], files: [{ file, worktrees }] } }`,
`landed` being `{ commit, subject, rows }`, `mergePreview` `{ conflicts, files }`, `report`
`{ file, modified }` or `null`. Without a worker it says so in one line. A worker
whose scope file names its rows gets a `state:` line, such as `stopped mid-row #M1.14 (6 files
uncommitted, 3 TODO(domain), last verify-slice failed: tests); resume: npx ddd-ts-kit
worker-scope billing --resume`, and `progress` in JSON: `{ rows: [{ id, slice, state, commit?,
byOrder? }], inSlice, leftOut, markers: { domain, test }, verification, report: { modified,
current }, agent, phase, next }`, `phase` being `not started`, `mid-row`, `between rows` or
`rows committed`, and `next` one of `wait`, `send-message` (with `to`), `new-agent`, `merge`, as
`worker-scope --resume` decides it (`wait` while the agent called a tool in the last three minutes
and did not stop since).

`todo` lists those markers as `file:line` with their kind and their text, in the project or in one
context; `--json` prints `{ count, remaining: [{ kind, context, file, line, text }] }`.

## plan-waves

```
ddd-ts-kit plan-waves [<context>]
```

Orders the rows of `docs/architecture/slices.md` that are not `done`, for a build split between
workers. Wave 1 holds the rows whose dependencies are all done; wave n the rows whose dependencies
are done or in earlier waves, so that a row never waits for a row of its own wave. Each wave is cut
into batches: one owner and one context per batch, two rows at most (what an agent holds), and two
rows together only when their `Start with` names the same aggregate. The aggregate of a row is read
from its generator commands: `--aggregate <Name>`, `aggregate <context> <Name>` and
`repository <context> <Name>`. Two batches of one context in one wave are said likely to touch the
same files when they name the same aggregate; when one of them names none, the overlap is said to
be unknown rather than guessed. Each batch of a context's worker comes with the command that briefs
it, `npx ddd-ts-kit worker-scope <context> --base origin/main --rows <ids>`, with its own
`--worktree` and `--branch` when its wave holds another batch of that context; a batch of the
conductor is built on the trunk; a person is briefed by hand. Then the merge order: by wave, and in
a wave the batch that the most rows wait for, directly or not, first, and what runs before each
merge: `npx ddd-ts-kit merge-trunk --to-land --cwd <worktree>`, then the squash merge. With a context, only its rows
are shown; the rows of other contexts it waits for count in the numbering of the waves.

A row says the rows it waits for, each with its status: `after #US1.02 (todo)`. A row it waits for
that belongs to another story (its id without the last `.<number>`, `US1` for `US1.04`) or to a
context that is not shown also gets its context and its story: `after #US1.04 (todo, billing, story
US1)`. The rows of one story that a planned row of another story waits for are listed again, after
the waves, under `Rows another story waits for, not done`, with their owner, their status, the
batch that holds them (or the `plan-waves <context>` that shows them) and the rows that wait:
before launching a wave, the conductor sees that it waits on the work of another story, and whether
anyone carries it.

A cycle in `Depends on`, a dependency on an id no row carries, a row without owner and an id two
rows carry make the rows impossible to order: they are reported alone, without waves, and the
command exits 1. A file without a slices table, or a context no row names, is refused.

Once the rows can be ordered, the generator commands of their `Start with` cells (between
backquotes, `generate ...` or `npx ddd-ts-kit generate ...`) are replayed in a copy of the
project (the files git sees; the project is left as it was), in the order of the waves, so that a
command finds what the rows before it generate. The generator itself says which names each
command introduces (the use case, the aggregate and the fact of an event, a `--name`, the words of
a `--permission`, ...), and each is judged as the generator judges it, against the glossary of its
context as it stands plus the `--term` of the row and of the rows it waits for, directly or not: a
term a row it does not wait for adds is not counted, since that row may not be merged when this
one is built. Each word it does not define (`undefined-word`) and each technical word no term
holds (`technical-word`) is reported once per row, with the `--term` to add, without waves, and
the command exits 1: a worker following that row as written would be refused. The commands the
generator refused for another reason (a missing `--module`, an aggregate no row generates, an
upstream not declared, a handler written by hand that an end-to-end spec needs) are listed after
the waves under `Refused for another reason than a word when the plan was replayed`, without
failing: the names they would introduce after that refusal are not judged. The replay costs about
a tenth of a second per command. `--json` prints
`{ file, context, problems: [{ kind, rows, message }], waves: [{ wave, batches: [{ id, owner, context, rows: [{ id, kind, slice, status, story, waitingFor, waitingForRows: [{ id, context, story, status }] }], aggregates, brief, sameFiles, unknownOverlap }] }], mergeOrder, otherStories: [{ id, context, story, kind, slice, owner, status, batch, waitedForBy }], notReplayed: [{ row, command, refusal }] }`,
`story` being `null` for a row whose id names none and `batch` `null` for a row the context asked
for does not show.

## acceptance

```
ddd-ts-kit acceptance [<story>] [--gate written|passing] [--lock]
```

The acceptance scenarios of each story (`test/acceptance/<story>.acceptance.spec.ts`, written by
`generate acceptance <story>`) against its rows in `docs/architecture/slices.md` and the criteria
of `docs/architecture/stories/<story>.md`: the rows and criteria each scenario names in its title
(`#US5.02 AC1 ...`), the scenarios left to write (`it.todo`), those wrapped in `pending(...)` until
their code is built, and what is inconsistent. `--gate written` holds a story before the code of
its rows: every slice row and criterion has a written scenario, and the acceptance is locked;
`--gate passing` before it closes: none is pending either. `--lock` writes
`test/acceptance/<story>.acceptance.lock.json`, the fingerprint of each criterion and of each
scenario (`pending(...)`, layout and comments aside); after it, a scenario changes only with its
criterion, and a criterion, or a scenario whose criteria stayed, only with a `Verdict: amend` of
the `acceptance-judge` agent on that very version (`test/acceptance/verdicts/*.md`), which the lock
keeps as an amendment for the owner to validate. It never runs a test. Exits 1 while a gate is not
met, or, without one, on an inconsistency or a drift from the lock. `--json` prints
`{ gate, met, stories: [{ story, file?, specification?, rows, criteria, scenarios, regression?, lock?, amendments, problems }] }`.

### The regression specs of a fix

A fix is a story file whose `## Regression` section lists the spec files that prove it, one path
per item, relative to the project root, with or without backticks:

```md
# FIX-412 A cancelled order frees its slot

## Statement

A customer cancels an order after it was shipped, and the order is still marked cancelled.

## Regression

- src/contexts/ordering/test/unit/order.aggregate.spec.ts
- test/unit/cancel-order.handler.spec.ts
```

Such a story needs no row of `slices.md` and no acceptance spec: `acceptance FIX-412` reads each
listed file and fingerprints each of its `it` or `test` as it fingerprints a scenario. `--gate
written` holds that each listed file exists and holds at least one test (an `it.todo` is still to
write; a test the runner puts aside is reported whatever the gate), and that the lock is written;
`--lock` records the tests under `regression` of `test/acceptance/fix-412.acceptance.lock.json`
(`{ file, title, fingerprint }` each) and refuses while a listed spec is missing or holds no test.
A locked test changed or removed is reported as a changed scenario is, as the subject
`test "<title>" of <file>` with its fingerprint, until the `acceptance-judge` agent lets that
version through, the `## Statement` of the fix being the criterion; a new test only needs locking
again. `--lock` also runs the formatter (the `format` script, in check mode) and the linter (the
`lint` script) of the project on the files it locks, a fix's regression specs or a story's
acceptance spec, and only on those: it refuses, naming the file and what the tool reports, while they
fail, since a locked file can no longer be touched. A project without those scripts or tools is locked
as before. `--gate passing` holds that each locked test is there, unchanged and no longer wrapped in
`pending(...)`; the test runner, not this command, proves it passes. The guard of the plugin reads
the same lock in the worktree of a fix (`"kind": "fix"` in `.ddd-ts-kit/story.json`): it opens the
code once the lock exists and refuses every edit of a locked spec by a sub-agent, the session writing a new version for the judge to rule on (skill `fix`,
[story workflow](../../docs/guides/story-workflow.md)).

```
$ npx ddd-ts-kit acceptance FIX-412 --gate written
FIX-412  fix, 2 regression specs, locked
  specification docs/architecture/stories/FIX-412.md: no acceptance criterion stated
  src/contexts/ordering/test/unit/order.aggregate.spec.ts: 1 test, 1 active
  test/unit/cancel-order.handler.spec.ts: 1 test, 1 active
  gate written: met
```

## story-check

```
ddd-ts-kit story-check <code> [--strict]
```

Says whether a story or a milestone can close: every row of it in `docs/architecture/slices.md`
is `done` (the others are listed with their status), and no marker of its own is left. `<code>` is
the start of the ids of its rows, the id without its last `.<number>`: `M1` for `M1.01`, `M1.02`,
`US5` for `US5.03` (a `#` before it is left out).

Several stories often build the same context at once, and a marker does not say whose it is: each
`TODO(domain)`, `TODO(platform)`, `it.todo` and `TODO(review)` is attributed to rows first.

1. Its text names a row: `#M1.03` or `M1.03`, word-bounded as `cited` reads them (`M1.035` is not
   `M1.03`). This is why a remark of a review is written `TODO(review): #<row id> <remark>`.
2. Else the commit that wrote its line names one: `git blame --porcelain` gives the commit (one call
   per file, on the lines of its markers, and one git call for all the commits), whose
   `Slice: <id>` trailer, else the row ids its subject or body names, give the rows. A
   `TODO(domain)` or an `it.todo` a generator wrote belongs to the row whose commit created it.
3. Else, for a line not committed yet, the rows of `.ddd-ts-kit/worker.json` when the project is
   the worktree of a worker.

A marker is the story's own when it belongs to one of its rows, wherever it is. A marker of a
context of its rows that belongs to no row is its own when no other open story (one with a row not
done) has a row in that context, since it can be no one else's; otherwise it is listed without
blocking, with the stories it may belong to: settle it, or name its row in it. A marker of the rows
of other stories does not block, and is counted. A Context cell that names no context of the
project (`all`, `platform`) adds none: outside the contexts, only a marker attributed to one of its
rows counts. `--strict` makes every marker of its contexts block, whoever it belongs to.

A done row also holds to its design. Every name the `## #<id>` section of the design review of
the story (`docs/architecture/reviews/<code>.md`) cites as inline code, read as `cited` reads them
(a path under the source root or relative to the context, a `Class.member`, a PascalCase name;
a name whose sentence records that it was removed or renamed is history and is left out), must
exist in the tree: the path exists; the class, interface, type or function is declared by a source
under the source root, or imported by one (`Clock` of the kernel); the member is named in a file
declaring the class. A name that does not is listed under `### Compromises` of `## Report` in
`docs/architecture/stories/<code>.md`, as inline code, with why; a name that neither exists nor
is listed blocks, with its `file:line` in the review. The tree is read only when a section of a
done row cites a name. `--strict` changes nothing here. The guard of the plugin says it once at
the stop of a session in the worktree of a story, without blocking. The comparison of the built
code with its design comes from [the AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf).

A commit of the story also carries its change reference. Each commit on the current branch that
changes a migration or a container file (the same paths the `change-reference` hook of the
regulated profile watches: `migrations/`, `prisma/migrations/`, `docker/`, `Dockerfile`,
`docker-compose.yml`; the two lists are kept aligned in the kit) and belongs to the story (its
`Slice: <row id>` trailer, else its message naming a row of it, else its subject naming the story,
word-bounded) must carry a `Change: <id>` trailer, the id the change process of the team gives.
One without it is listed with its short sha, its subject and the files, under "Without a change
reference"; it blocks the story when the config says `agents.profile: regulated` or with
`--strict`, and is listed without blocking otherwise. The fix: add the trailer before the pull
request, `git commit --amend` for the last commit, an interactive rebase of the branch for an
earlier one. Three git calls at most, on the commits that touch such a file.

It reads the files and git only. It exits 0 when the story can close (one line, then the markers
listed without blocking, if any), 1 when something keeps it open, each blocker with why it is its
own (`names #M1.01`, `written by a782a19 Slice: M1.02`, `no other open story in payments`), its
`file:line` and its fix (handle it, or dismiss it by a decision record,
`npx ddd-ts-kit generate adr "<title>"`, then delete the marker), each name of its design the
code lacks with its `file:line` in the review, each commit without its change reference, and 2
on a code no row carries or without a slices table. `--json` prints
`{ story, rows, contexts, unread, strict, open: [{ id, context, slice, status }], markers, unattributed, others, design, unreferenced, regulated, canClose }`,
each marker being `{ kind, context, file, line, text, attribution: { by, rows, commit? } }`, with
`why`, `sharedWith` and `fix` in `markers` and `unattributed`; `by` is `text`, `commit`, `worker`
or `none`; each name of `design` being `{ row, document, line, cited, kind, why, fix }`; each
commit of `unreferenced` being `{ sha, subject, files, rows, fix }`, and `regulated` true under
the regulated profile.

```
$ npx ddd-ts-kit story-check M1
M1 cannot close: every row done, 3 markers of its own left.

TODO(review) (1): handle it in a slice, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`, quoting the remark without its marker), then delete the marker in the same commit
  docs/architecture/reviews/invoices.md:3  #M1.01 name the total after its term.  (names #M1.01)

TODO(domain) (1): write the business decision it asks for, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`), then delete the marker
  src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts:2  the rounding of a total.  (written by a782a19 Slice: M1.02)

TODO(platform) (1): make the technical choice it asks for, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`), then delete the marker
  src/contexts/payments/domain/aggregates/payment.aggregate.ts:2  the provider of a refund.  (no other open story in payments)

Not blocking, unattributed (1): settle each, or name its row in the marker (`TODO(review): #<row> <remark>`)
  src/contexts/billing/test/unit/invoice.aggregate.spec.ts:1  it.todo  refuses an invoice without lines  (unattributed, may belong to open US2: settle it or name the row in the marker)

Not blocking: 1 marker of these contexts belongs to rows of US2.

Once each is settled: npx ddd-ts-kit story-check M1
```

A done row whose section cites what was not built:

```
$ npx ddd-ts-kit story-check US5
US5 cannot close: every row done, 0 markers of its own left, 1 name of its design not in the code.

Departed from its design (1): update the section of the row in docs/architecture/reviews/US5.md to what it built, or list the name under `### Compromises` of `## Report` in docs/architecture/stories/US5.md with why
  docs/architecture/reviews/US5.md:12  `OrderNumberTaken`  (#US5.02, no class, interface, type or function OrderNumberTaken is declared or imported under the source root)

Once each is settled: npx ddd-ts-kit story-check US5
```

A migration commit of the story without its change reference, under the regulated profile:

```
$ npx ddd-ts-kit story-check M1
M1 cannot close: every row done, 0 markers of its own left, 1 commit without a change reference.

Without a change reference (1, agents.profile regulated): add the trailer `Change: <id>` to the commit, with the id the change process of the team gives (`git commit --amend` for the last commit, an interactive rebase of the branch for an earlier one), before the pull request
  a782a19  feat(billing): add the paid_at column to invoices  (Slice: M1.02; src/platform/database/migrations/0002_paid_at.sql)

Once each is settled: npx ddd-ts-kit story-check M1
```

Once the three are settled:

```
$ npx ddd-ts-kit story-check M1
M1 can close: its 3 rows done, no marker of its own left in billing, payments.

Not blocking, unattributed (1): settle each, or name its row in the marker (`TODO(review): #<row> <remark>`)
  src/contexts/billing/test/unit/invoice.aggregate.spec.ts:1  it.todo  refuses an invoice without lines  (unattributed, may belong to open US2: settle it or name the row in the marker)

Not blocking: 1 marker of these contexts belongs to rows of US2.
```

## measures

```
ddd-ts-kit measures [--since <date>] [--story <code>] [--by-author] [--format text|json]
```

What the loop of a story costs and leaves, read from the git history of the current branch
(`git log`, nothing else) and the files of `docs/architecture/` (the stories, the reviews, the
intents under `intents/`, the incidents under `incidents/`, `slices.md`) and of
`test/acceptance/` (the locks and the verdicts): the indicators the
[AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
names for each of its plays, in the terms of the kit. One line per story of
`docs/architecture/stories/`, then the medians and the shares of the period. It reads, writes
nothing and asks nothing of the platform.

| Measure | From |
|---|---|
| design time | the first commit of `docs/architecture/stories/<code>.md` to the commit of `test/acceptance/<code>.acceptance.lock.json` |
| build time | the lock commit to the first commit whose `## Report` holds text |
| lead time | the first commit of the story file to the close: the first commit of the first-parent history of the current branch that contains the last commit of the story, whatever its subject (a merge, a squash; the merge of the trunk into the story branch is never it); `open` without a report or without a close |
| requirements rework | the commits that changed `## Acceptance criteria` after the first commit carrying a `Slice: <code>.<n>` trailer; the amendments of the lock (each an `amend` verdict); the `refuse` verdicts of `test/acceptance/verdicts/` |
| provisional decisions | the `D<n>` lines of the story file |
| compromises | the items under `### Compromises` of the report |
| review | the `TODO(review)` lines the commits of the story removed (settled) and wrote (opened), from `git log -S`; the items under `## Findings` of `docs/architecture/reviews/<code>.md` by pass (a `### <pass>` heading, else the word before the colon of the item, else `unsorted`); the repeats: a rule id or a remark text seen in two stories, the mistake the guide of the team should have caught |
| verification | whether the report has a `### Verification` block naming `npm run verify` |
| parallelism | the other stories whose first and last commits overlap this one in time |
| origin | whether `## Origin` names an intent (`intents/<name>.md`), a ticket (`SHOP-12`, `#12`, a URL) or an incident (`incidents/<name>.md`) |
| repeat incidents | a story whose origin names an incident whose record carries the same `message` or `error_code` (a line of its front matter or of a list) as an earlier record of `docs/architecture/incidents/` |

A commit belongs to a story when it carries a `Slice: <code>.<n>` trailer or touches one of its
files. Times are in hours (`5h`, `1d 2h`); the summary gives the median of each over the stories
that have it, lead time over the closed ones. On a trunk where every pull request is squashed,
the phases of a story collapse into one commit and its design and build times read as zero: run
the command on the branch of the story (its worktree) before it lands, or keep merge commits.

- `--since <date>` keeps the stories whose first commit is on or after that day (ISO 8601).
- `--story <code>` keeps one story, whatever the case of its code.
- `--by-author` adds who opened each story and a table per author (stories, closed, median lead
  time). Off by default: a measure read per person changes what people do, and the playbook's
  measures are of the loop, not of its people. Ask for it when the team agreed on it.
- `--format json` (or `--json`) gives the same as data for a dashboard:
  `{ branch, since?, stories: [{ story, file, author?, opened?, designHours?, buildHours?, leadHours?, merged?, rework: { criteriaChanges, amendments, refusals }, decisions, compromises, verification, origin?, review: { settled, opened, findings, repeats }, overlaps, repeatIncident? }], summary, byAuthor?, notComputed }`.

Not computed in this version, because they come from the platform and its API is not read: the
time to the first review of a pull request and whether its CI was green on the first run. A
later version may read them with `gh` or `glab`; nothing is sent anywhere.

```
$ npx ddd-ts-kit measures --since 2026-03-01
Measures of main since 2026-03-01: 2 stories, 1 closed (merged on this branch).

  US5  opened 2026-03-01  design 1d  build 3d  lead 5d (merged 991050c)  rework 1 criteria change(s), 1 amendment(s), 0 refusal(s)  decisions 2  compromises 2  review 1 settled, 1 opened, repeats language/glossary-term  verification yes  origin ticket  overlaps US6
  US6  opened 2026-03-03  design open  build open  lead open  rework 0 criteria change(s), 0 amendment(s), 0 refusal(s)  decisions 0  compromises 0  review 0 settled, 0 opened, findings 2 bugs, 1 security, repeats language/glossary-term  verification no  origin incident (repeats docs/architecture/incidents/inc-1.md)  overlaps US5

Medians: design 1d, build 3d, lead 5d over 1 closed; 0.5 criteria change(s), 1 decision(s), 1 compromise(s), 0.5 marker(s) settled per story.
Verification: 1 of 2 report(s) name `npm run verify`. Origin: 2 of 2 name an intent, a ticket or an incident. Parallel: 2 built while another one was. Repeats across stories: 1 (language/glossary-term). Repeat incidents: 1.
Not computed: time to first review and first-run CI status come from the platform (its API is not read).
```

## doctor

```
ddd-ts-kit doctor [--strict]
```

What an upgrade left to do: the scripts, the packages of the kit (at the ranges of this version)
and the permissions of the agents that this version writes and the project lacks or writes
otherwise (under `agents.profile: "regulated"`, each line of the sandbox block too, as
`permission sandbox.<key>`, and each hook of the profile the settings do not register, as
`permission hooks.<name>`), then the git hooks. `lefthook.yml` must hold `lefthook: node_modules/.bin/lefthook`,
which makes each checkout and each worktree run its own lefthook and fail a commit, loudly,
when its dependencies are missing; the fix is that line, or `init --force` for the whole file.
The pre-commit hook under `git rev-parse --git-path hooks` must exist and come from lefthook;
the fix is `npm run hooks:install`, once per clone. Then the guidance written once for the team
to own: `REVIEW.md`, the review policy, and under the regulated profile the two hooks of
`.claude/hooks/`, are reported missing (`guidance`) and `init` writes them again without touching
anything else.

Then what this checkout lacks to run the project, the state of a clone or a new worktree rather
than of the project, read from its files without network: the running Node against
`engines.node` of `package.json` (`unsupported`) and the version `.nvmrc` names (`other version`;
an alias such as `lts/*` is not judged); `node_modules` present (`missing`) and installed since
the lockfile last changed (`outdated`, from the copy of the lockfile the package manager writes
under `node_modules`); `ddd-ts-kit` and every `@ddd-ts-kit/*` package that `package.json`
declares or `node_modules` holds, installed (`not installed`) at the version of the running CLI
(`other version`). A project without a lockfile of its own inside a workspace (a `package.json`
above it that declares `workspaces`, or a `pnpm-workspace.yaml`, with the lockfile) is read where
the workspace installs, its packages resolved as Node does, from the project up; and, when the repository has a `.gitmodules`, every submodule initialised
(`not initialised`, from `git submodule status`). Each comes with its fix: a Node that
`engines.node` accepts (`nvm use`), `npm ci`, the packages of the kit upgraded together,
`git submodule update --init --recursive`.

Last, on what is installed, the overrides `init` writes under a dependency that pins a package
below a security fix (qs under Stryker, multer under Nest): the range the installed parent asks
for, found from the real place of each package as Node finds it, against the overrides of
`package.json` under npm or of `pnpm-workspace.yaml` under pnpm. An override the project lacks
while the parent still pins the package below the fix is `missing`, and `init` adds it; one the
project keeps once the parent asks for the fixed version itself is `no longer needed`, to remove,
as it would hold the package back when a later major is asked for. A chain that is not installed
is not judged.

And each install script the stack needs, the engines of Prisma (`@prisma/engines`) and the Kafka
client (`@confluentinc/kafka-javascript`), judged on the version installed against `allowScripts`
of `package.json` under npm or `allowBuilds` of `pnpm-workspace.yaml` under pnpm, read as npm
reads them (the name alone, `name@*`, or exact versions joined by `||`; a denial wins): no entry is
`missing`, and `init` adds the name; an entry pinned to other versions only, the pin a bump left
behind, is `other version`, with `npm install-scripts approve <package>` then `npm rebuild
<package>` (under pnpm, the version written in `allowBuilds`, then `pnpm rebuild <package>`) once
the new script was read; a denial is `written otherwise`. A package that is not installed is not
judged.

`--strict` exits 1 while something is missing or at another range, or while the checkout cannot
run the project: a Node outside `engines.node`, no `node_modules`, a package of the kit not
installed or at another version, a submodule not initialised, an override missing. A script
written otherwise, a hook this clone has not installed, a Node `.nvmrc` does not name while
`engines.node` accepts it, a lockfile changed since the install (a checkout may rewrite it with
what `node_modules` already holds), an override no longer needed and a denied install script (the
team may build the package another way) are said without failing it; an install script missing or
pinned to another version fails it. `--json` prints `{ version, findings: [{ area, name, problem,
expected, found }] }`, `area` being `script`, `package`, `permission`, `hook`, `guidance`, `node`,
`install`, `submodule`, `override` or `install-script`.

## worker-scope

```
ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
ddd-ts-kit worker-scope <context> --resume [--worktree <path> | --branch <name>] [--fresh]
```

Prepares the place of one worker of a build split by context: creates a git worktree of the
project (`.worktrees/<context>` of the main checkout by default, next to the project while its
`.gitignore` does not hold `.worktrees/`) on the branch `build/<context>`, cut from
`--base` (a branch, a tag or a commit: `origin/main`; by default the current branch), writes
`.ddd-ts-kit/worker.json` in it (`{ context, rows, base, baseCommit, branch }`, `baseCommit` being
the commit the base names at that moment; `init` ignores `.ddd-ts-kit/`), and
prints the briefing of the worker: its scope, the generators it may run, its slices from
`docs/architecture/slices.md` (by default the first batch `plan-waves` cuts for the context, one
or two rows still to do on one aggregate, with a note naming the `--rows` of the next batch), its
turn budget, the published languages it consumes, and the base as the
trunk of its checks (`check --changed-since <base>`). `--rows 4.15,4.16` briefs those rows only,
in that order: an id is read as written, and a row the file does not have, has twice or gives to
another owner is refused. Each row carries its rules, from a line `- #<id>: <rules>` under the
tables; more than two rows get a note, since an agent holds one or two. An existing worktree, or
an existing branch, is kept when it contains the base and refused when it does not, so that no
worker builds on a stale trunk, with the fix: `npx ddd-ts-kit merge-trunk --trunk <base> --cwd
<worktree>`, never a plain `git merge`, which conflicts again on what already landed; only the
file is written again. Without `--base`, run from a
worker's worktree (its `.ddd-ts-kit/worker.json`, or a branch `build/<context>`), it refuses:
that branch would become the trunk. In a worktree it creates, it then runs the clean install of
the package manager of the project (`npm ci`, `pnpm install --frozen-lockfile`), its output kept
only when it fails; a note gives the time it took, or, when it failed or `--no-install` left it
out, what to run before the worker starts. `--dry-run` creates, writes and installs nothing. It
needs a git repository with one commit at least. The worker then generates with `--local-only`.

Under each row whose design lives in a document of `docs/architecture/`, the briefing names it
(`design: docs/architecture/reviews/refunds.md (section "#M2.03 Compute the refund")`), and the
names that design cites the base does not have, as `cited` finds them, come in a block of eight
lines at most, with a note for the conductor naming the lines to correct on the trunk. `--json`
holds them under `citations`.

In a worker's worktree, `verify-slice` names the row it closes (the first of `worker.json` that no
commit of the branch closes yet) and prints the exact commit command, with the trailer that
names the row: `git commit -m "feat(billing): pay an invoice" -m "Slice: M1.14"`. It keeps its
result in `.ddd-ts-kit/verification.json` (`{ at, head, row, ok, failed, toStage }`), and the
guard of the plugin keeps the runs of the `context-builder` agent in `.ddd-ts-kit/agent.json`.

`--resume` reads where the stopped worker of the context stands, from the trunk, and creates and
rewrites nothing: its rows (committed by their `Slice:` trailer, or in order with the
`feat(<context>)` commits for an older commit, shown `(by order)`), the files of the row under
way, the markers left in the context, its last verification and what changed since, whether its
report is current, and its agent. Then the next step: `SendMessage` to that agent, with the
message to send as it is, when it stopped mid-row after progress in a run that is not its third;
a new `context-builder` with the briefing of the row under way only, plus the files the earlier
agent left (never to regenerate) and its report quoted, between rows, without a recorded agent,
after three runs or a run without progress, or with `--fresh` (a full context); the merge once
every row is committed and nothing is left. It refuses a context no worktree builds, and names
the worktrees of a context two workers build: choose one with `--worktree` or `--branch`.
`--json` prints `{ context, worktree, root, branch, base, progress, next, sendMessage, briefing,
notes }`.

## story-scope

```
ddd-ts-kit story-scope <story> [--from <file>] [--kind story|fix] [--base <ref>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
```

Opens the worktree of one story, where one session takes it from its questions to its pull
request while other sessions take other stories: `.worktrees/<story>` of the main checkout on the
branch `story/<story>`, cut from `--base` (by default the branch the current one follows,
`origin/main` from the trunk; refused from the worktree of another story, whose branch would
become the base), its clean install unless `--no-install`, and `.ddd-ts-kit/story.json`
(`{ story, base, baseCommit, branch, kind, from }`). An existing worktree of the story is kept
and the story resumes there; a story open in another worktree is refused: two sessions never take
the same one. The other open stories are named with the contexts their rows change. `--dry-run`
creates, writes and installs nothing.

`--kind` says what the story is: `story` (the default), or `fix`, a story built behind the
regression specs listed under `## Regression` of its file and locked, as the `fix` skill writes
it. `--from <file>` records where the story comes from: an intent,
`docs/architecture/intents/<slug>.md`, refused unless its header says `Status: accepted`, or an
incident record, `docs/architecture/incidents/<id>.md`, accepted as it is. Both are written to
`story.json`, relative to the project root, and kept when the story resumes without them. While
`docs/architecture/stories/<story>.md` does not exist, the `Next:` line says that the story skill
seeds its statement from the origin. `--json` prints `{ story, kind, from, seeds, dryRun,
worktree, branch, base, created, install, others, notes }`.

## story

```
ddd-ts-kit story [<story>] [--gate build|close]
```

Where a story stands, phase by phase, and the next step: its specification and criteria
(`docs/architecture/stories/<story>.md`), its rows in `slices.md`, a design review section per
row not done (`docs/architecture/reviews/<story>.md`, `## #<id>`), its acceptance written and
locked, its rows done with no marker of its own left, its acceptance passing, its trunk merged
in, its `## Origin` (`From:` and `Built with:`), its `## Report` with `### Verification` naming
`npm run verify`. In the worktree of a story, the story is its own. `--gate build` exits 1 until
the first four phases are met (the code may start: the guard of the plugin opens the contexts);
`--gate close` until all are. For a story of kind `fix` (its `story.json`, or a `## Regression`
section in its file), the rows and their design are optional, the acceptance phase reads the
specs listed under `## Regression` instead of `test/acceptance/`, each of which must exist, and
no passing phase is read: the regression specs run with the tests of the project. `--json`
prints `{ story, gate, met, next, phases }`.

## cited

```
ddd-ts-kit cited [<context>] [--rows <id,...>] [--base <ref>] [--removed-since <ref>]
```

The names the design of rows not done cites as code that the code does not have. The design of
a row is its `Slice` and `Start with` cells and its rule lines in `docs/architecture/slices.md`,
the section of a Markdown file of `docs/architecture/` whose heading names the row (to the next
heading of the same level), a file that names it in its text (the whole file), and a file its
rule line links to; a file written before the bootstrap and a translation next to its original
are left out. A name is an inline code span: a path under the source root or relative to a
context, `Class.member`, or a PascalCase name (one word only when it is not a term of the
glossary of the row's context). A span with a space, such as a generator command, names nothing.

Each name is read against `--base` (the current branch by default) from git, without a checkout,
and reported only with evidence:

- removed: the history of the ref removed the file that gave it (`verify-occupancy.command.ts`
  gives `VerifyOccupancy`, when that file declared it), or the last commit that changed a class
  took the member out; the report names the commit, its day and subject, and what replaced it,
  three at most: the file it was renamed to, a file the same commit added in the same context
  with its words, a name of its stem;
- refused: a path the canonical tree refuses, judged as `tree/closed` judges a file;
- similar: a name the ref never had, ending with a role suffix (`RefundBasisService`), when the
  ref has a name of its stem whose role plays the same part (`RefundBasisReader`, a port) and
  whose file arrived after the line citing it was last changed.

Everything else is planned, and silent. A name whose sentence says it was removed or renamed is
history, and silent; so is a name whose successor the same part cites. `--rows` checks those
rows; without it every row not done, of the context when one is given. With `--removed-since
<ref>` it lists instead the names the change removes, from the merge base with `<ref>` to the
working tree, that the design of a row not done still cites (the rows of the worker of the
worktree left out), and a document linked to no row is read too. It reads, writes nothing, and
exits 0. `--json` prints `{ base, commit, counts: { present, planned }, citations: [{ rows,
document, line, cited, kind, state, removedBy?, refusal?, candidates }], notes }`, or
`{ since, citations }` with `--removed-since`. A shallow clone, where a removed name cannot be
told from a planned one, and a local base behind its upstream are noted.

From the example application, before its slices file was corrected:

```text
$ npx ddd-ts-kit cited analytics --rows M1.37 --base HEAD
Names of the design of #M1.37 that HEAD does not have (checked at d2bb88de):
- docs/architecture/briefings/analytics.md:18 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
- docs/architecture/briefings/analytics.md:33 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
- docs/architecture/slices.md:49 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
Also cited: 4 present, 3 planned (silent).
```

## verify-merge

```
ddd-ts-kit verify-merge [<commit>] [--since <ref>] [--theirs <ref>] [--base <commit>] [--warn]
```

Reports what the merges of a branch lost, read from git alone (no build, no config needed), in
about a second. Without a commit it checks every merge commit of `<since>..HEAD` and the merge in
progress, whose result is the index plus the working tree, new untracked files included;
`--since` defaults to the base of `.ddd-ts-kit/worker.json`, then `origin/HEAD`, then
`origin/main`. With a commit it checks that one: a merge commit, or a squash commit with
`--theirs <head of the branch it took in>`. A merge is compared with its base: `--base`, else the
`Merge-Base:` trailer of its message (a merge computed from the branch's own base after a squash
has another base than git would find), else `git merge-base`.

Over the files the merge, its base or its sides changed, each line is counted, trimmed and with
its whitespace collapsed, lines of punctuation only and conflict markers a side committed left
out, and each import of named bindings split into one entry per binding: the result must hold it
as many times as the base, plus what either side added, minus what either removed. The files are
counted together, so a line moved to another file is not lost; a line laid out again on several
lines is not either. The derived files, the files whose first lines say a tool wrote them
(`@generated`, `autogenerated`, `DO NOT EDIT`), the migrations, the lockfiles (npm, pnpm, yarn,
bun, uv, poetry, Pipfile, Cargo, Bundler, Composer, Go, NuGet) and `docs/architecture/slices.md`
are left out of the lines.

| Finding | Severity |
|---|---|
| a line one side added, or both kept, missing from the result | error |
| a file neither side deleted, gone from the result with lines no other file has (one finding per file) | error |
| a row of `slices.md` done on one side and not done in the result, or a row of one side gone | error |
| the title of an `it(` or a `test(` of one side gone, a spec file of one side deleted | error |
| a migration of one side whose description (its name without number and `working-`) no migration of the result has | error |
| a conflict marker left in a changed file (`=======` only inside an opened conflict; a file whose sides hold as many markers is passed over) | error |
| a line one side removed, brought back | warning |
| a line one side wrote where the other side changed the same base lines, inside a block the other side deleted, or in a file it deleted: the merge chose (`superseded`) | warning |
| a line the merge replaced, where it stood, by lines of its own that no side has; lines both sides lost in a file where the merge wrote lines of its own (`rewritten`) | warning |

A line inserted between base lines the other side left alone stays an error even when the other
side inserted at the same place: dropping one of two new methods is the loss the check exists
for. So does a rewrite that lost more lines than the base lines or the other side's rewrite it
competed with (an edit with a new method under it). What one side deleted, or reopened, is never
reported. Nor is a line of the branch in a file the branch did not touch since its fork from the trunk
(the file is the same on the branch and at `git merge-base`): what the trunk removed or replaced
there since is the trunk's change, whatever base the merge is computed from. A removal decided on purpose is recorded in the merge commit as a trailer
`Lost-Accepted: <file:line>,...` (a file alone accepts all of its lines): those findings are
listed and never fail. For a merge older than HEAD, a finding HEAD no longer shows was repaired
by a later commit: listed too.

Without a merge it prints nothing and exits 0; it exits 1 on an error. `--warn` prints the same
report, adds that the errors do not block yet, and exits 0. In this version the pre-push hook of
`init` runs `verify-merge --warn`, whose output lefthook shows, and `verify-slice` reports the
merges since its `--since` without failing the slice; a later minor version makes both block.
The check is an estimate: on 150 merges that resolved conflicts in three public projects, one in
five still reported an error, most of them a change of one branch dropped on purpose because the
other branch had replaced the feature, which only a reader can tell from a loss. `--json` prints
`{ since, merges: [{ commit, subject, base, baseFrom, ours, theirs, errors, warnings, accepted, repaired }], errorCount, warningCount, ok }`,
each finding being `{ kind, file, line, side, text }`. It cannot see a line both sides added in
two places, a lost line of punctuation or a change of meaning, and a shallow clone lacks the
commits it reads: in CI it needs `fetch-depth: 0`, which is why the pipelines of `init` do not
run it.

## merge-trunk

```
ddd-ts-kit merge-trunk [--trunk <ref>] [--since <commit>] [--to-land] [--dry-run]
ddd-ts-kit merge-trunk --continue [--accept-lost] | --abort
```

Brings the trunk into the branch as one merge commit computed from the branch's own diff. Never
rebases, never fetches (the commit `--trunk` names is printed; by default `origin/HEAD`, then
`origin/main`). Refused, exit 2: a working tree that is not clean (`.ddd-ts-kit/` aside), a merge,
rebase, cherry-pick or revert in progress, a repository where git knows no committer (the merge
ends with a commit), an unknown trunk.

1. **The base**: the newest commit of the branch the trunk already holds. `--since <commit>` (a
   commit of the branch); else the landed point: the newest commit whose whole change since the
   trunk is one commit of the trunk, compared by stable patch id without context lines, the
   derived files, migrations, `slices.md`, `plan.md` and lockfiles left out, looked for on this
   branch, on the branch `.ddd-ts-kit/worker.json` records as its base, and on the local branches
   sharing commits with it (a stacked branch whose parent was squash-merged, a branch reused after
   its first row landed); of commits sharing one patch the oldest is taken, a newer one only when
   the trunk holds what it changed; else the `baseCommit` worker-scope recorded, when it is a
   commit of the branch and its own lines are all on the trunk (otherwise it stops, nothing
   changed, and lists them for a person to confirm with `--since`); else `git merge-base`, and
   the report names each branch sharing commits not found on the trunk, with its `--since`. Too
   old shows as more conflicts, never as a silent loss.
2. **The preview**: `git merge-tree --write-tree --merge-base=<base> HEAD <trunk>`, diff3 markers;
   the same without the base gives what a plain `git merge` would conflict on. `--dry-run` stops
   here and changes nothing.
3. **The merge**: the tree becomes a merge in progress git understands (`ORIG_HEAD`, the index
   with the three stages of each conflicted path, `MERGE_HEAD`, `MERGE_MODE`, `MERGE_MSG`, linked
   worktrees included): `git status`, `git add`, `git commit` and `git merge --abort` work on it.
   The message is `Merge <trunk> into <branch>` with the trailers `Merge-Base: <base>`,
   `Trunk: <commit>` and, when the branch was found squashed there, `Landed: <commit>`.
4. **What is settled without a person**:

   | Class | Paths | Resolution |
   |---|---|---|
   | derived | `openapi/`, `clients/`, `docs/integration/`, `docs/behaviour/`, `.dependency-cruiser.cjs`, the barrels and lists of each context | trunk side, rewritten by `regenerate` |
   | mixed document | `CONTEXT.md`, `docs/context-map.md` | a conflict inside a `<!-- ddd-ts-kit:<region> -->` region: trunk side; outside: for you |
   | registry | a conflict inside `// ddd-ts-kit:<region>` markers of any file | the base without what either side removed, plus what each added, ours first, once each; names imported from one module joined in one statement in `imports` |
   | slices | `docs/architecture/slices.md` | row by row by `#`: the furthest status (done, in progress, todo), each other cell from the side that changed it; a cell both changed differently: for you |
   | drizzle meta | `<out>/meta/_journal.json`, snapshots | trunk side, then the replay |
   | lockfile | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` | trunk side; `<manager> install` when the branch changed `package.json` since the base |
   | stored events | `stored-events.lock.json` | every version of both sides; one recorded with two shapes: for you |
   | anything else | sources, tests, `package.json`, configuration, a file one side deleted | for you |

   Anything for you: `.ddd-ts-kit/merge.json` records the merge, the report lists each file with
   the lines of each hunk, what this branch and its rows did there, the commits of the trunk that
   touched it since the base and what they did, and the command exits 1.
5. **`--continue`** (or straight on without a conflict for you): refused while a path is unmerged
   or keeps a conflict marker; the install, then the migrations: under drizzle-kit, when both
   sides added some since the base, or with `--to-land` and a working migration, the replay of
   `drizzle-generate --replay` (with `--to-land`, the real names, in a worker's worktree too);
   under knex, Prisma and TypeORM with `--to-land` only, each migration of the branch the trunk
   does not have renamed after the trunk's last, without `working-`, the content kept (TypeORM's
   class and `name`, Prisma's folder), and a stop when a migration the trunk gained since the base
   names a table one of the branch names (generate it again on the trunk); a decision record of
   the branch whose number the trunk took since the base gets the next free one (its files, its
   `# ADR-NNNN` title, the links of its translations, recorded as `Lost-Accepted:` lines).
6. **`regenerate`** (skipped without the config of the kit or the script); a failure stops. With
   Prisma, when the merge changed a file under `prisma/schema/`, then `npm run db:client`: the
   git-ignored client and `generated/schema.sql`, which the in-process test database reads, are
   derived from it; a failure stops. Drizzle, Knex and TypeORM derive no such file (their test
   database reads the tracked sources), so they run nothing more.
7. **`verify-merge`** on the uncommitted result, on the base the trailer records: an error stops
   (exit 1), with `file:line (ours|theirs)  <text>`, the rows no longer done, the tests lost;
   `--continue --accept-lost` records them in a `Lost-Accepted:` trailer and goes on.
8. **The commit** of the paths of the merge only: what is staged plus what the steps rewrote (the
   derived files, the migrations, the decision records, the lockfile, `slices.md`, the
   stored-events lock). Any other changed path is listed as left out and blocks it until it is
   staged or set aside. The hooks of the project run.

`--abort` undoes the merge in progress as `git merge --abort` does and forgets its state; the derived files the kit regenerated (`docs/behaviour/`, `CONTEXT.md`, the context map, ...) and modified after the merge staged them are restored and named. `--continue` concludes the trunk commit the merge started from: when the trunk ref names another commit now, the report says so (`trunkMoved: { merged, now }` in `--json`) and tells to run `merge-trunk` again once the merge is committed. Each stop
says what to do next and keeps the merge in progress for the next `--continue`. git 2.40 is needed
for a base git would not compute; an older git merges with `git merge` itself from
`git merge-base` (`--since <merge base>`), and refuses `--dry-run`. Exit 0 once committed, up to
date or previewed, 1 on a stop, 2 when it cannot start.

```text
merge-trunk build/billing-2 <- origin/main (d8d281b)
base 6d8be4b: build/billing-1 landed as d8d281b "feat(billing): issue and cancel (#1)"
conflicts: plain git merge 3, own diff since base 2, automatic 1, for you 1
automatic:
  openapi/openapi.yaml  derived: trunk side, regenerated at the end
for you (a merge is in progress; `merge-trunk --abort` undoes it):
  src/contexts/billing/domain/invoice.ts  hunks at lines 40-58
    ours  (build/billing-2, rows #M1.02): adds 4 lines: pay(amount: Money, at: Date): void {
    theirs (origin/main since 6d8be4b, 9a0c1f2 "feat(billing): cancel an invoice (#7)"): adds 3 lines: cancel(reason: CancelReason): void {
    both sides only add lines: keep both. Never take one side of the whole file.
stopped: 1 conflicted path left for you
next: resolve each hunk, `git add <file>`, then `npx ddd-ts-kit merge-trunk --continue`
```

`--json` prints the same report:
`{ status, branch, trunk: { ref, commit }, base: { commit, evidence, landedAs?, unlanded?, notOnTrunk? }, conflicts: { plainMerge, ownDiff, automatic, forYou }, automatic: [{ file, kind, how }], forYou: [{ file, kind, why, hunks, ours: { branch, rows, change }, theirs: { ref, commits, change }, advice }], migrations, regenerate: { status, output? }, client?: { status, output? }, trunkMoved?: { merged, now }, lostLines: { errors, warnings, accepted } | null, leftOut, stop?, commit?, next }`,
`status` being `up-to-date`, `dry-run`, `stopped` or `committed` and `evidence` `option`,
`landed`, `recorded` or `merge-base`. The guard of the plugin refuses `--to-land` to a sub-agent:
landing a branch is the conductor's step, just before its squash merge.

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
the base), everything is selected: that is what the default branch and the nightly run get. A
`--base` or `--head` that starts with a dash is refused (exit 2): no ref does, and git would read
it as one of its own options. The selection is never narrower than the declared relationships,
because `context/declared-relationship` keeps every import between contexts inside them, and that
rule runs on the whole project in every pipeline.

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
                 [--changed-since <git-ref>] [--explain] [--self]
ddd-ts-kit check --baseline write|prune
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

- `paths` and `--changed-since` limit what is reported, not what is analysed. `--changed-since` keeps a
  violation when the file it sits on changed, or when a file it names as its `subjects` did (in `--json`):
  a finding reported on a handler but repaired in the module file (`events/consumer-idempotent`,
  `declarations/port-adapter-wired`, `authz/declared`, `authz/policy-asked`) shows when only that
  module file changed. The changed files are those since the merge base, committed or not.
- `--baseline write` records the errors a project already has, counted by file and by rule, in
  `ddd-ts-kit-baseline.json` (the shape of `eslint-suppressions.json`), for a codebase that adopts
  the kit; commit it. From then on `check` and `check-file` (the hook of the agent) leave quiet the
  errors of a rule in a file while they are no more than the baseline records, and report all of
  them once they are more; `check` fails when a recorded count is no longer reached, until
  `--baseline prune` lowers it, so that the baseline only shrinks. Warnings are not recorded: they
  fail nothing. Writing a baseline is a decision of the project owner, who runs `--baseline write`
  in a terminal: the guard of the plugin refuses the command and any direct edit of the file to an
  agent, under Claude Code, Codex and Copilot alike, and the permissions `init` writes ask before
  both for an agent without the plugin. A command the guard does not read (a script of the
  project that writes the file) is not caught: the review reads the diff of the baseline, which
  should only shrink. `--baseline prune` needs no one. A file that moves keeps its counts: the
  commands of the kit that move files (`move-to-module`, `context-layout`, `platform-folders`)
  carry its entry to the new path, and `--baseline prune` follows the renames git sees since the
  baseline was committed (a `git mv`); a file moved otherwise reports its errors at its new path,
  and its old entry fails until the owner writes the baseline again. A baseline makes old errors quiet; it does
  not make a tree outside the canonical one checkable.
  `--changed-since` runs `git diff --name-only --relative <ref>...` in the project, on the commit
  the ref names: a ref that names no commit is refused (exit 2, `<ref> is not a commit of this
  repository`), as it is by every command that takes one.
- `--format github` prints `::error file=...,line=...::` annotations.
- `--explain` follows the violations with each rule they report, once, with its description and
  the reason it exists (as `explain` prints it, without the examples), and in JSON adds an
  `explanations` array. With `--format github` or `gitlab`, the reason goes at the end of the
  message of each annotation instead: a pull request shows an annotation alone on its line, and
  a Code Quality report has no place for text beside its issues. The fingerprints stay the same.
- `--format gitlab` prints a GitLab Code Quality report: one issue per violation, `major` for
  an error and `minor` for a warning, with a fingerprint that does not depend on the line.
- Severities come from `rules` in the config (`error`, `warn`, `off`). Default `error`, except
  `test/no-mocks`, `test/builder-required`, `clean/function-size`, `clean/no-noise-comment`,
  `clean/no-flag-argument`, `standard/no-parallel-interface`, `declarations/port-adapter-wired`
  and, held by ESLint, `application/command-query-separation`, `test/title-states-a-rule`,
  `test/no-logic`, `test/assertion-present` and `test/refusal-by-code` (`warn`). `any` in a test file is
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
| `tree/closed` | a directory outside the canonical tree and `extraDirectories`; a source file outside a role directory; in the declared style `<context>.declarations.ts` is accepted at the root of a context, and the `<layer>.declarations.ts` of a layer in that layer |
| `tree/context-doc` | a missing `CONTEXT.md`, a missing section, a classification that contradicts the config |
| `naming/suffix` | a file without the suffix of its role, or not in kebab-case. `application/scheduling/` holds `*.job.ts`; a use case folder accepts `*.result.ts` next to its message and its handler; `presentation/http/<context>.routes.ts`, named after its context instead of a role, is accepted in both styles |
| `naming/one-concept-per-file` | several exported classes in an aggregate, entity, value object, event, command, query, handler, event handler, integration event handler or job file; in the declared style, several classes carrying a declaration decorator in one role file |
| `naming/search-not-list` | in a context, a method named `list` or `list<Something>` in a port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`), in a class of `infrastructure/` or in a fake of `test/fakes/`; under `application/queries/`, a folder or a file named `list`, `list-...` or `list....`, or a class named `List` or `List<Something>`. Properties and `listAccessible` (required by the `Authorizer` port) are not judged. Name them `search...`: `generate query <context> Search<Things> --search` |
| `naming/business-name` | in `domain/` and `application/` of a context and in the shared kernel outside `presentation/`, a variable, loop variable, destructured binding, parameter or property named with a generic word (`target`, `data`, `item` and the other words of the list, which `businessNames` of the config changes); the fix names the concept an initializer builds or reads when the text says it, and `npx eslint --fix` renames it |
| `test/spec-required` | an aggregate, value object, domain service, handler, domain event handler, integration event handler or job without a spec (a `*.result.ts` needs none) |
| `test/no-mocks` | `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins, or a mocking library in a context's tests |
| `test/builder-required` | an aggregate without `test/builders/<name>.builder.ts` |
| `test/helper-placed` | a file of a context's `test/unit/` or `test/integration/` that is not a spec (`*.spec.ts`, `*.test.ts`): it goes to `test/worlds/`, `test/builders/` or `test/fakes/` |
| `events/name-format` | an event name that is not `<context>.<aggregate>.<fact>` in kebab-case with the right context |
| `events/name-declared-once` | a class of `domain/events/` without `static readonly eventName`, or whose `readonly name` writes the name again instead of reading it |
| `events/defined-in-published-language` | `defineIntegrationEvent` outside a published language, without a payload, twice for one version; an event described by hand |
| `language/glossary-term` | a class of the model named with a word the glossary of its context does not define; an empty glossary; under `"stack.refusals": "factories"` or `"named"`, a class of `domain/errors/` too, a refusal class of `named` allowed the qualifiers `invalid`, `unknown`, `already`, `too`, `no`, `missing` and `required` besides (`<context>.codes.ts` is not judged) |
| `language/declared-vocabulary` | a string literal whose value is a value of a closed vocabulary the project declares (an object `as const` exported with the union type of its name, a permission set of `definePermissions`), outside the file that declares it, in the place that speaks its language (its context; the platform and the route groups for the platform; everywhere for a permission id or the shared kernel); tests, published languages and the relationship schema are not judged, nor, outside `domain/`, a word typed by another language (a key of a `Record<T, ..>`, a value of a `Record<.., T>`, `'x' satisfies T`, `T` a type of a published language, of a package or of `infrastructure/anti-corruption/` or `infrastructure/external/`); under `"stack.literals": "named"` |
| `language/no-technical-name` | `Manager`, `Helper`, `Util`, `Utils`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` in a type declared under `domain/` or in a use case folder, unless a term of the glossary of the context holds the word (`Scoring model` holds `ScoringModel`) |
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
| `imports/extension` | under the source root, `test/` and `scripts/`: with `importExtension` `none`, an alias specifier that ends with `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` or `.cts`; with `js` (or no key), an alias specifier that does not end with `.js` (the fix names the specifier to write; `eslint --fix` writes it). A package subpath is never judged |
| `imports/alias-declared` | an `importAlias` that is not `@/` or `$<name>/`, or that is `$test/`, `$scripts/`, `$generated/`; a `paths` entry of `tsconfig.json` missing or different from what `importAlias` gives (the fix gives the entry); another `paths` entry under an alias; a `baseUrl`; a `tsconfig.build.json` whose `paths` differ; `paths` of `knip.json` mapping an alias; a script that compiles (`tsc` without `--noEmit`) and does not run `ddd-ts-kit build-aliases` afterwards; a script running `tsx --tsconfig` on another file; a `vitest` config at the root without `tsconfigPaths: true`, a `jest` config without the derived `moduleNameMapper` entries, or `.dependency-cruiser.cjs` without `tsConfig`; `module` and `moduleResolution` of `tsconfig.json` (or of a `tsconfig.build.json` that sets its own) that are not what `importExtension` gives: `ESNext`, `Bundler` and `customConditions` holding `node` under `none`, and under `js` a written value that is not a Node resolution; a jest mapping whose pattern does not end as the imports do. A project without `package.json` is not judged |
| `config/valid` | unknown upstream, classification, relationship, rule id, `guard` mode or `importExtension`; a context missing on disk or in the config; a `commit` limit that is not a positive integer |
| `config/suppression-needs-reason` | a suppression without a rule id or a reason (kept as an alias next to `governance/recorded-deviation`, which judges the reason) |
| `authz/declared` | in a module file, `builder.command(X)` or `builder.query(X)` without `.requires(` or `.public(` in its chain, unless the message class carries `@Requires` or `@Public` of `@ddd-ts-kit/kernel/declarations`; with manual or nest wiring, a command or query class absent from every `requires(X, ...)` and `publicUseCase(X)` of the module file and of `application/authorization/`; a `defineRoute` without `security` (the route type refuses it already, and an empty list too: this is the text-level net for a definition built loosely); in the declared style, the exported class of a `*.command.ts` or `*.query.ts` file carrying neither `@Requires` nor `@Public` |
| `authz/granted` | with `stack.authz` `rbac`, a permission of a context's `definePermissions` that neither `platform/auth/roles/roles.ts` nor `platform/auth/authorization/signed-in-grants.ts` grants by name (by the entry of its set, its id or `<context>:*`); the super-admin `*` does not count (a warning); with `rebac`, a permission the schema leaves on the context while no source outside the tests writes an `operator` relationship (of a person or a system actor) on that context and no signed-in grant holds it, in a project that already makes a person operator of some context; silent with an authorizer of the project's own (a warning) |
| `authz/system-actor-granted` | with `stack.authz` `rebac`, a `systemActor(<name>)` of a context (a literal, or `<Class>.name`) in a file that sends a command or a query not declared public, while no file of `platform/auth/relationships/` names the subject `system:system:<name>` |
| `authz/scope-narrows` | in a context, a `.scope(` call whose permission (the entry of a set in the call, or in a constant or a field of the file) every signed-in person holds, in `platform/auth/authorization/signed-in-grants.ts` or in the `grants` of a `new SignedInGrantsAuthorizer`: its scope is always `all`; grants or a permission it cannot read are reported too (a warning) |
| `privacy/declared-field` | with `stack.privacy` `on`: a column of a Knex table, a Drizzle table or a TypeORM entity schema of `infrastructure/persistence/`, or of a Prisma model in the schema of the context, whose name holds a word of the personal vocabulary and that no `personalFields` declaration of the context names |
| `privacy/event-payload-declared` | with `stack.privacy` `on`: a field of the payload of an integration event (the `z.object` of the declaration, the class or the interface of its `.payload.ts`) named like personal data that its `personal` option does not list |
| `privacy/erasure-reaches-copies` | with `stack.privacy` `on`: a context whose application layer names an integration event declaring personal data, of another context, and that declares no `PersonalDataErasure` and handles no `privacy.data-subject.erased` |
| `privacy/subject-is-opaque` | with `stack.privacy` `on`: the subject of a `personalFields` declaration or of the `personal` option of an event that is a word of the personal vocabulary or one of its personal fields |
| `privacy/no-personal-data-in-logs` | with `stack.privacy` `on`: a call to the logger or to the metrics, in a context or the platform, whose arguments name a declared personal field |
| `authz/in-application` | `presentation/`: a test on roles, `isAdmin`, the import of an authorizer or of `Access`; `infrastructure/`: `authorize(` or `check(` on an authorizer or access, `ForbiddenError`; `domain/`: any import of `@ddd-ts-kit/auth`, of the actor types of the kernel (`Actor`, `ActorContext`, `Session`, `ExecutionContext`, the authorized messages), a read of `.roles` or `.permissions` on an actor. The request glue of `@ddd-ts-kit/auth` (`actorOf`, `sessionOf`, `resolveSession`, `SessionAuthenticator`) is free in `presentation/`. `presentation/` and `infrastructure/`: the import of `Requires`, `Public` or `Policy` from `@ddd-ts-kit/kernel/declarations`, or of the ports `Access` and `PolicyAccess` from `@ddd-ts-kit/auth`; they are free in `application/` |
| `authz/actor-explicit` | in `domain/` and `application/`: `ActorContext`, `ExecutionScope` (as a type or as a value: the class is the token of a dependency list), `AsyncLocalStorageExecutionScope`, `ScopedActorContext`, `AsyncLocalStorage`; `.current()` or `.require()` on an actor context or on something named `scope`, `scopes` or `...executionScope`; an import of `stampCreation`, `stampUpdate` or `tenantScopeOf` |
| `authz/fields-by-schema` | under `application/queries/`: `roles.includes(`, `.some(`, `.every(`, `.find(`, `.indexOf(`, a comparison with a `role`, `isAdmin` |
| `aspects/outside-in` | an import of `@ddd-ts-kit/aspects/decorators` outside `infrastructure/` of a context and the platform directory: `presentation/`, the module file, `published-language/`, the shared kernel, `main.ts`, any other source (`domain/` and `application/` are reported by the two `layer/*` rules instead) |
| `tracing/platform-only` | an import of `@ddd-ts-kit/tracing` or of an `@opentelemetry/*` package outside the platform directory, `main.ts` and `apps/`, tests included |
| `nest/no-parallel-pipeline` | in `presentation/`, `infrastructure/` or the module file of a context, tests apart: an import of a controller Nest serves (its route and parameter decorators, unless the file imports `KitRoute` or `KitRoutes` of `@ddd-ts-kit/http/nest`), the raw request or answer, a guard, a pipe, an exception filter or an `HttpException`, an interceptor or the `Logger` of `@nestjs/common`, a bare import of it, or an import of a package of Nest whose work the kit does (`@nestjs/core`, `@nestjs/swagger`, `@nestjs/cqrs`, `@nestjs/passport`, `@nestjs/config`, `@nestjs/schedule` and the others of section 3 of ARCHITECTURE.md); the message names what the kit does in its place; under the source root outside the contexts, tests apart: a file that imports `Controller` of `@nestjs/common`, neither `KitRoute` nor `KitRoutes`, and names `CommandBus` or `QueryBus` or imports a file of a context |
| `nest/controllers-current` | with `"stack.routes": "nest"`: a `<context>.controllers.ts` that differs from what the Nest controllers of the context and the signatures of their methods give, or is missing; a part of the request taken whole by no DTO class that `request` of `@KitRoute` does not give; a route method that answers no DTO class, `Accepted` or `void` and declares no `response` in `@KitRoute` |
| `tenancy/scoped-statement` | with `stack.tenancy` other than `none`, in `infrastructure/` of a context, tests and a context whose `tenancy` is `control-plane` aside: on Knex the executor used other than as an argument (`executor()(`, `executor().from(`, `executor().raw(`, `const db = ...executor();`) and any `.raw(`; on Drizzle, statement by statement, a read, update or delete on the executor whose where has no `tenantCondition(` nor `ownTenantCondition(` (inline or in the local it is given), an insert whose row has no `tenantScopeOf(`, a relational query (`executor().query`), a raw `execute(`, or the executor held in a variable; on Prisma, statement by statement on the client, a read (`findFirst(`, `findMany(`, `count(`, `aggregate(`, `groupBy(`) whose where spreads no `tenantWhere(`, an update or a delete whose where spreads no `ownTenantWhere(`, a create whose data spreads no `tenantScopeOf(` (inline or in a local the arguments name), `findUnique(`, `upsert(`, a raw query (`$queryRaw`, `$executeRaw`), or the client held in a variable; on TypeORM the same on the manager (`find*(`, `count*(`, `update(`, `delete(`, `insert(`, the row handed to `insertIgnoringConflict(`, a query builder whose where carries no condition, `save(`, `upsert(`, `query(`); on the four, a read model store built without its `tenant` option. A where built by another function is not followed |
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
| `governance/recorded-deviation` | a `ddd-ts-kit-disable` or `eslint-disable` comment whose reason names no `ADR-<number>` with a file `docs/adr/<number>-*.md`; a rule set to `off` (or to `warn` below its default), an extra directory, a context whose `tenancy` is `control-plane`, an extra allowed package, a `guard` other than `enforce` or `stack.events` off the outbox, without a `deviations` entry `{ what, adr, reason }` pointing to an existing record |
| `declarations/role-declared` | declared style only: a role file (other than `*.command.ts` and `*.query.ts`, held by `authz/declared`; `*.job.ts` under `application/scheduling/` with `@Scheduled` and `*.publisher.ts` with `@DomainEventHandler` are roles) exporting no class with the decorator of its suffix and folder, or one carrying another declaration; a declared class in a file that is not a role file; a `consumer` or `name` option that is missing, empty, a variable, a concatenation or a template with a substitution; any declaration decorator on a class under `domain/` |
| `declarations/barrel-current` | declared style only: with `stack.assembly: barrel`, a missing `<layer>.declarations.ts` of a layer or one that differs from one `export *` per role file of the layer sorted by path followed by one `injected(Class, [Tokens])` per class of the layer whose constructor takes something (read from the signatures, with their imports), a `<context>.declarations.ts` that is missing or differs from one `export *` per such file sorted by path, and the declarations of a layer that holds no role file any more; with `discovery`, generated declarations that still exist, and a `<context>.dependencies.ts` that differs from those `injected` statements (absent is accepted while it would hold none). The message names the missing role file or the class whose list is stale. A context still declared as an earlier version wrote it, exactly as that version would write it (the single `<context>.declarations.ts` of 0.84, or one `<folder>.declarations.ts` per role folder as 0.85 and 0.86 wrote them), is a warning in this version (`docs --check` passes and prints it, `docs` moves it) and an error in a later minor version. It needs the tree, so `check-file` does not run it |
| `declarations/constructor-injection` | declared style only, in a role file: on a class whose decorator lists nothing, a constructor parameter that is optional, has a default value, is a rest parameter or is destructured, has no type, or is typed by anything but one class name (type arguments aside): a union, an intersection, an array, a qualified name, a type of the language, an interface, a type alias, an enum or an unexported class of the file or of the file of the project it is imported from; a class that inherits its constructor from a class the project cannot read. Under `stack.dependencies: signature`, a decorator that carries a list although the constructor can be read: one that repeats it, one that differs |
| `declarations/port-adapter-wired` | a class of `infrastructure/` implementing a port that nothing wires: no `@Repository`, `@Gateway` or `@Adapter` in the declared style, and no file of the composition root (`<context>.module.ts`, `main.ts`, `apps/<context>/main.ts`, the platform) importing it, once the file carries no `TODO(domain)` or `TODO(platform)` left; one kept on purpose carries `// ddd-ts-kit-disable-next-line declarations/port-adapter-wired -- ADR-NNNN: <why>` |
| `ports/abstract-class` | in a port file (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`): a class that is not `abstract`; a member that is not an abstract method or property (`static readonly tokenKey = '<text>'` apart): a constructor, a body, an initializer, a `private`, `protected` or `#` member; an exported `interface` (a `type` alias, a data shape, is not reported) |
| `ports/implements-never-extends` | a class carrying `@Repository(P)`, `@Gateway(P)` or `@Adapter(P)`, or given to `bind(P).toClass(C)` or `rebind(P).toClass(C)`, without `implements P` or with `extends P`; under `infrastructure/`, a class extending a class imported from a port file |
| `ports/no-token-constant` | a call of `token` imported from a `@ddd-ts-kit/*` package; `Symbol(..)`, `Symbol.for(..)` or a string literal as the first argument of `bind`, `rebind`, `resolve`, `fake` or `override` in a file importing `@ddd-ts-kit/di`; an UPPER_SNAKE_CASE name in a dependency list; a file named `*.ports.ts` or `tokens.ts` |
| `ports/no-concrete-dependency` | a dependency list naming a class imported from `infrastructure/` or from `test/fakes/` of a context; in the declared style, a constructor parameter of a declared class that lists nothing, typed by such a class |
| `ports/value-import` | a class named in a dependency list, or given to `bind` or `rebind`, imported with `import type` or `import { type X }` |
| `scheduling/job-triggers-use-case` | in `application/scheduling/*.job.ts`: an exported class that does not implement `ScheduledJob`; a `run` that sends no command (no `.execute(` call); a repository in the dependency list or the constructor; an import from `domain/aggregates/`, `domain/entities/`, `domain/services/` or `infrastructure/`. A `builder.job(..)` registration of a class that lives elsewhere |
| `scheduling/job-registered` | in the explicit style, the class of a job (`application/scheduling/*.job.ts`) or background job (`application/background/*.background-job.ts`) that no other file outside the tests registers (`.handledBy(..)`, `.register(..)` or `new`) |
| `scheduling/job-name` | the first argument of `@Scheduled(..)` or `.job(..)` that is not a string literal `<context>.<job-name>` in lower-case kebab-case with the context of its file; a `systemActor(..)` of a job file passing another name; one job name used twice in the project |
| `errors/code-unique` | under `"stack.refusals": "named"` or `"factories"`, in the `domain/errors/` of a context: a code set a second time, by a value of `<context>.codes.ts`, a factory (`refusal('CODE', ..)`) or a class (`readonly code = 'CODE'`), with the file and line of the first. The same code in two contexts is not reported |
| `errors/code-listed` | under `"stack.refusals": "named"`, in the `domain/errors/` of a context: a refusal class (extending `DomainRefusal`) whose code is not `readonly code = <Context>Codes.<Class>` from the `<context>.codes.ts` of its context, refusal classes and no `<context>.codes.ts`, a class the list does not hold; in `<context>.codes.ts`, no list `<Context>Codes` or one not declared `as const`, a key that names no refusal class of the context, a value that is not a string literal in constant case |
| `schema/presentation-only` | under `"stack.schemas": "shared"`: in the shared kernel outside `presentation/`, an import of a validation library; in `domain/`, `application/`, `infrastructure/`, `published-language/` and the shared kernel outside `presentation/`, an import of a file of `presentation/` of the shared kernel |
| `schema/no-duplicate-shape` | under `"stack.schemas": "shared"`, in the presentation layer of one context, or in it and `presentation/` of the shared kernel: a DTO class or an object schema (`z.object`, `v.object`, `Type.Object`) declaring the shape of another one, with the place of the original (the shared kernel, then `presentation/http/shared/`); two contexts are not compared, and request parameters and shapes still carrying a `TODO(domain)` of the generator are not judged |
| `errors/known-code` | under `"stack.refusals": "named"` or `"factories"`, in a `*.route.ts`: a code of the `errors` list that the `<context>.codes.ts` of the context of the route does not list, that no refusal of that context sets, that no class outside the contexts sets, and that is not a code of the kit |
| `domain/value-object-class` | under `"stack.values": "classes"`: in `domain/value-objects/` of a context or a `*.vo.ts` of the shared kernel outside `presentation/`, no exported class or a second one, a class that extends neither `ValueObject` nor another value object of the project, a public constructor, a concrete class without a static method, an exported function, arrow constant or object literal (inline, listed or by default); in `domain/` and in the shared kernel outside `presentation/`, an exported function that answers a record of data: data entries, no spread, nothing a call of the model built |

More ids belong to `@ddd-ts-kit/eslint-plugin`, which reads the syntax tree where this
checker reads text: `domain/aggregate-encapsulation`, `domain/value-object-immutability`,
`domain/no-generic-error`, `application/handler-shape`,
`application/command-query-separation`, `clean/no-magic-number` and the six rules on the shape
of a test (`test/no-only-no-skip`, `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present`, `test/refusal-by-code`, `test/no-snapshot`) among them (`ddd-ts-kit rules`
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
ddd-ts-kit check-file <path> [--content-from <file>] [--rule <id>]...
```

Runs the per-file rules (layers, contexts, naming, events, language, purity, clean code, mocks,
composition, suppressions) on one file without walking the project: meant for an editor or
agent hook after each write. A file that is not a source of the project is ignored.
`--content-from <file>` judges the text of that file as the content of `<path>`, which need not
exist yet: what a session is about to write, as the guard of the plugin reads it before the write
under `"dependenciesBeforeWrite": true`. `--rule` narrows the rules; the baseline of the project
applies as for a file on disk.

## lint

```
ddd-ts-kit lint [paths...] [--format <eslint formatter>] [--fix] [--no-cache]
```

What `lint` and `ci:lint` of a generated project run: the ESLint of the project, through its API,
on the paths given (the project otherwise), its report in the format asked (`--format gitlab`
writes the Code Quality report as `eslint-formatter-gitlab` does), `--fix` as ESLint takes it.
It exits 1 on an error, and on a warning as on an error, but on a warning of a rule of the kit in
transition: a rule new in this version, whose documentation names the version in which it becomes
an error. Those are shown in the report and listed after it, one line per rule, without failing:
an upgrade of the kit never turns a green lint red. Without ESLint installed it exits 2 and names
the install. See [Quality baseline](../../docs/tools/quality-baseline.md#warnings-fail-the-lint).

The command lints with the cache of ESLint, keyed by the content of each file (`.eslintcache/`,
ignored by git): a second run on a tree that did not change lints the files that changed since.
The cache keys on the files and the config, not on the rules as installed, so the command drops it
when the lockfile, `eslint.config.mjs` or `ddd-ts-kit.config.json` changed since it was written.
The lint job of the generated pipeline restores, on a pull request or a merge request, the cache
the default branch wrote last for the same lockfile and config; the default branch and the night
lint everything, which also sees a type changed in another file, and write it. `--no-cache` lints
every file again, as before a pull request when a type changed: the cache is left as it was.

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
