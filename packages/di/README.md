# @ddd-ts-kit/di

Typed tokens and context modules on top of [tsyringe](https://github.com/microsoft/tsyringe),
for projects that want dependency injection without a heavy framework.

A class says what it is, and the context is assembled from what its classes say. There is no
file listing bindings to keep in step with the code. The explicit module, where every binding
is written by hand, stays supported and mixes with the declared style in one application.

```
npm i @ddd-ts-kit/di tsyringe reflect-metadata
```

`reflect-metadata` is imported by this package before tsyringe loads (tsyringe refuses to load
without it), so you do not import it yourself. No decorator of the kit needs it: dependencies
are named, never reflected.

## A context that declares itself

The decorators come from `@ddd-ts-kit/kernel/declarations`, which holds no container: the
application layer imports the kernel and nothing else. This package turns the declarations
into bindings; nothing else does. The domain carries no decorator.

```ts
// contexts/billing/application/ports/billing.ports.ts
import { token } from '@ddd-ts-kit/kernel/declarations';

export const INVOICES = token<InvoiceRepository>('billing.InvoiceRepository');
export const PAYMENTS = token<PaymentGateway>('billing.PaymentGateway');
```

```ts
// contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(permissions['invoice.issue'], {
  resource: (command: IssueInvoice) => ({ type: 'customer', id: command.customerId }),
})
export class IssueInvoice extends AuthorizedCommand<string> {
  constructor(actor: Actor, readonly customerId: string) {
    super(actor);
  }
}
```

```ts
// contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { CLOCK, CommandHandler, EVENT_PUBLISHER, ID_GENERATOR } from '@ddd-ts-kit/kernel/declarations';

@CommandHandler(IssueInvoice, [INVOICES, PAYMENTS, EVENT_PUBLISHER, ID_GENERATOR, CLOCK])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly payments: PaymentGateway,
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoice): Promise<string> { /* ... */ }
}
```

```ts
// contexts/billing/application/queries/get-invoice/get-invoice.query.ts and .handler.ts
@Public()
export class GetInvoice extends Query<InvoiceView | undefined> {
  constructor(readonly invoiceId: string) {
    super();
  }
}

@QueryHandler(GetInvoice, [INVOICES])
export class GetInvoiceHandler implements QueryHandler<GetInvoice> { /* ... */ }
```

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { COMMAND_BUS, IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced } from '../../../../ordering/published-language/index.js';

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [COMMAND_BUS])
export class InvoiceOnOrderPlaced {
  constructor(private readonly commands: CommandBus) {}

  readonly handle = async (event: IntegrationEvent<OrderPlacedPayload>): Promise<void> => {
    await this.commands.execute(new IssueInvoice(systemActor('billing.invoice-on-order-placed'), event.payload.customerId));
  };
}
```

```ts
// contexts/billing/infrastructure/persistence/knex-invoice.repository.ts
import { CLOCK, EXECUTION_SCOPE, Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(INVOICES, [DATABASE, EXECUTION_SCOPE, CLOCK])
export class KnexInvoiceRepository implements InvoiceRepository { /* ... */ }
```

```ts
// contexts/billing/infrastructure/external/http-payment.gateway.ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { retry, timeout } from '@ddd-ts-kit/aspects';

@Gateway(PAYMENTS, { aspects: [retry({ attempts: 3 }), timeout(2000)] }, [HTTP])
export class HttpPaymentGateway implements PaymentGateway { /* ... */ }
```

That is the whole context. It is assembled in one line, in one of two ways.

```ts
// main.ts, discovered: no file of the context names its classes
import { COMMAND_BUS, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';

const billing = await discoverContext('billing', new URL('./contexts/billing/', import.meta.url));
const app = createApplication({ modules: [kernelModule(), platformModule, billing], authorization: 'required' });
await app.start();
```

```ts
// main.ts, listed: one generated barrel per context and nothing else
import { contextModule } from '@ddd-ts-kit/di';
import * as billing from './contexts/billing/billing.declarations.js';

const app = createApplication({ modules: [kernelModule(), platformModule, contextModule('billing', billing)] });
```

The compiler checks every declaration where it is written: the handler handles that message
and answers its result type, the event handler handles the payload of that event, the adapter
implements the port of its token, and the token list names the constructor parameters, in
order, no more and no fewer.

### What a class may declare

The full list, with the options of each, is in the README of `@ddd-ts-kit/kernel`
("Declarations"). What this package does with each:

| Declaration | Becomes |
|---|---|
| `@Requires(permission, options?)` / `@Public()` on a command or a query | the access of the use case: what `.requires(...)` and `.public()` say in an explicit module, read by `authorization: 'required'` and by the authorization module |
| `@CommandHandler(Message, [tokens])`, `@QueryHandler(Message, [tokens])` | a singleton of kind `use-case`, registered on `COMMAND_BUS` or `QUERY_BUS` |
| `@IntegrationEventHandler(definition, { consumer }, [tokens])` | a singleton of kind `consumer`, subscribed to `EVENT_SUBSCRIBER` by `start()`, idempotent per consumer name, run in the execution context of the event |
| `@DomainEventHandler(Event, { name }, [tokens])` | a singleton of kind `consumer`, attached to `DOMAIN_EVENTS` when the application is created; an event dispatched under the name and built from another class is left alone |
| `@Scheduled(name, schedule and options, [tokens])` | a singleton of kind `job`, registered on `JOB_SCHEDULER` when the application is created, started by `start()` after the consumers and stopped first by `stop()`; see "Scheduled jobs" |
| `@Repository(TOKEN, options?, [tokens])` | the binding of the token, kind `repository` |
| `@Gateway(TOKEN, options?, [tokens])` | the binding of the token, kind `gateway` |
| `@Adapter(TOKEN, { kind? }, [tokens])` | the binding of the token, kind `external` (default) or `publisher` |
| `@Policy(permission, { name }, [tokens])` | a singleton listed under `DECLARED_POLICIES`, which `authorizationModule` evaluates through `ACCESS` |

The options of a repository, a gateway and an adapter are the ones of an explicit binding:
`transient: true` for `.transient()`, `aspects: [...]` for `.with(...)`, the first outermost,
and `replaces: true` for `rebind`, which a platform adapter uses to take the place of a default
of the kernel module (`@Adapter(UNIT_OF_WORK, { replaces: true }, [DATABASE])`). The kind
reaches the `decorate` hook, so tracing and global aspects see declared adapters as they see
explicit ones. A handler is built on the first message it handles; nothing is built when a
class is declared or when a module is created.

### `contextModule(name, declared)`

`declared` is a class, a list (lists may nest) or the namespace import of a barrel. Of a
namespace only the declared classes are kept, so the barrel may also export tokens and types.
A class named directly in a list must carry a declaration (`UNDECLARED_CLASS`): a forgotten
decorator is not skipped in silence. A class met twice is taken once. The module is static:
a bundler follows every class, and so does a dead-code analysis.

### `discoverContext(name, directory, options?)`

From `@ddd-ts-kit/di/discovery`, the one entry of this package that reads the disk. It loads,
in the order of their paths, every file under `application/` and `infrastructure/` of the
context whose name ends with a role suffix, and keeps the exported classes that declare
themselves:

| Suffix | Folder | Declares |
|---|---|---|
| `*.command`, `*.query` | `application/commands/`, `application/queries/` | `@Requires` or `@Public` |
| `*.handler` | `application/commands/`, `application/queries/` | `@CommandHandler` or `@QueryHandler` |
| `*.integration-handler` | `application/integration/handlers/` | `@IntegrationEventHandler` |
| `*.event-handler` | `application/event-handlers/` | `@DomainEventHandler` |
| `*.policy` | `application/authorization/` | `@Policy` |
| `*.job` | `application/scheduling/` | `@Scheduled` |
| `*.repository` | `infrastructure/persistence/` | `@Repository` |
| `*.gateway`, `*.adapter` | `infrastructure/` | `@Gateway`, `@Adapter` |

`domain/`, `presentation/`, `published-language/` and `test/` are never read, so the
repository interfaces of the domain and the fakes are left alone. It fails with a
`WiringError` naming the file:

- `DISCOVERY_FAILED`: a file that throws while loading (the failure is kept as `cause`), or a
  directory with neither `application/` nor `infrastructure/`;
- `NOTHING_DECLARED`: a file of a role suffix that exports no declared class;
- `MISPLACED_DECLARATION`: a file of a role suffix outside its folder (refused before it is
  loaded), or a class that declares another role than the one of its file.

Options: `ignore: (file) => boolean` leaves files out (a policy written with `definePolicy`, an
adapter bound explicitly); `extensions` (default `.js`, `.mjs`, `.ts`, `.mts`, the first that
exists wins, `.d.ts` never) says what is loaded; `load: (url) => Promise<module>` replaces
`import()`.

What it costs, to weigh against one generated barrel:

- it reads directories and imports at startup, sequentially, before the application exists;
- a bundler cannot follow it: a bundled application lists its classes with `contextModule`;
- the files it loads are imported by nothing, so knip and dependency-cruiser must be told that
  they are entries (see "Limits");
- it runs what runs the process: compiled `.js` in production, `.ts` only under a loader or a
  test runner that transforms them.

Prefer `contextModule` with a barrel for anything bundled, for a serverless cold start, and
whenever the tooling should see the classes; prefer discovery when adding a file must be all
it takes.

## Decorator modes

The declarations work under both decorator modes of TypeScript, with the same source line:

| Stack | `tsconfig.json` | Why |
|---|---|---|
| class-validator, NestJS, TypeORM entities, any library with legacy decorators | `"experimentalDecorators": true` | those libraries only have legacy decorators, and one program has one mode |
| anything else | nothing: leave `experimentalDecorators` unset | standard (TC39) decorators need no flag |

A declaration decorator is a function of the class alone. The legacy call hands it the class,
the standard call hands it the class and a context that it does not read, so the same
function serves both and stores the declaration in a registry of the kernel, never in
`Symbol.metadata`. Neither mode needs `emitDecoratorMetadata`, and no parameter decorator
exists in either: the dependency list is the one mechanism. Vitest lowers legacy decorators by
itself; for standard ones add `decorators()` of `@ddd-ts-kit/testing/vitest` to the Vitest
config.

## An explicit module

The alternative: every binding written by hand in `<context>.module.ts`. It needs no
decorator at all, and suits a context whose wiring is unusual (factories, values, conditional
bindings) or a team that wants the wiring in one file.

```ts
// contexts/ordering/ordering.module.ts
import { CLOCK, COMMAND_BUS, EVENT_PUBLISHER, ID_GENERATOR, defineContextModule, token } from '@ddd-ts-kit/di';
import { PaymentCaptured } from '../billing/published-language/index.js';

export const ORDER_REPOSITORY = token<OrderRepository>('ordering.OrderRepository');
export const ORDER_READS = token<OrderReads>('ordering.OrderReads');
export const STOCK_GATEWAY = token<StockGateway>('ordering.StockGateway');

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(ORDER_REPOSITORY).toClass(DrizzleOrderRepository, [DATABASE]).as('repository');
    builder.bind(ORDER_READS).toClass(DrizzleOrderReads, [DATABASE]).as('repository');
    builder.bind(STOCK_GATEWAY).toClass(HttpStockGateway, [STOCK_API_URL]).as('gateway');

    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [ORDER_REPOSITORY, STOCK_GATEWAY, EVENT_PUBLISHER, ID_GENERATOR, CLOCK]);
    builder.command(MarkOrderPaid).handledBy(MarkOrderPaidHandler, [ORDER_REPOSITORY, CLOCK]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [ORDER_READS]);

    builder
      .on(PaymentCaptured, { consumer: 'ordering.mark-order-paid' })
      .handledBy(MarkOrderPaidOnPaymentCaptured, [COMMAND_BUS]);
  },
});
```

The compiler checks that `PlaceOrderHandler` handles `PlaceOrder` and answers its result type,
that the event handler handles the payload of `PaymentCaptured`, and that every token list matches
the constructor parameters, in order. Nothing else is needed: no handler token, no manual
registration on a bus, no subscription code.

```ts
// main.ts
import { COMMAND_BUS, createApplication, kernelModule } from '@ddd-ts-kit/di';

const app = createApplication({ modules: [kernelModule(), platformModule, orderingModule, billingModule] });
await app.start();
const orderId = await app.resolve(COMMAND_BUS).execute(new PlaceOrder('sku-1')); // typed string
process.on('SIGTERM', () => void app.stop());
```

```ts
// contexts/ordering/test/unit/place-order.handler.spec.ts
import { createTestApplication, fake } from '@ddd-ts-kit/di';

it('places an order and announces it', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({
    modules: [orderingModule],
    fakes: [fake(ORDER_REPOSITORY, orders), fake(STOCK_GATEWAY, new InMemoryStock({ 'sku-1': 3 }))],
  });

  const orderId = await app.commandBus.execute(new PlaceOrder('sku-1'));

  expect(orders.count()).toBe(1);
  expect(app.eventBus.published).toMatchObject([{ type: 'ordering.order.placed', payload: { orderId } }]);
});
```

## Mixing the two styles

- **In one application**: declared and explicit modules are listed together; every check
  below applies across them.
- **In one module**: `builder.include(declared)` adds declared classes next to explicit
  statements, for the config value or the factory a decorator cannot express.

  ```ts
  export const billingModule = defineContextModule({
    name: 'billing',
    register(builder) {
      builder.include(billing);
      builder.bind(TAX_RATE).toValue(config.taxRate);
    },
  });
  ```

- **A decorated message in an explicit module**: `builder.command(IssueInvoice).handledBy(...)`
  reads the `@Requires` or `@Public` of the message; `.requires(...)` and `.public()` written
  on the builder win.
- **Replacing a declared adapter**: a later module calls `builder.rebind(TOKEN)`, and a test
  gives `fake(TOKEN, ...)`, exactly as for an explicit binding.

## Statements of an explicit module

| Call | Meaning |
|---|---|
| `bind(token).toClass(Class, [tokens])` | `new Class(...)` with the tokens resolved in order; the list is omitted for a constructor without parameters |
| `bind(token).toFactory((resolve) => instance)` | anything a constructor cannot express |
| `bind(token).toValue(value)` | an existing object or a constant |
| `.singleton()` / `.transient()` | one instance per application (default) or one per resolution |
| `.as(kind)` | role of the binding, handed to the `decorate` hook: `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`, `job` |
| `rebind(token).to...` | replaces the binding of a module listed earlier, such as a default of `kernelModule()` |
| `command(Type).handledBy(Handler, [tokens])` | binds the handler (singleton, kind `use-case`) and registers it on `COMMAND_BUS` |
| `query(Type).handledBy(Handler, [tokens])` | the same on `QUERY_BUS` |
| `on(definition, { consumer }).handledBy(Handler, [tokens])` | binds the integration event handler (kind `consumer`) and subscribes its `handle(event)` to `EVENT_SUBSCRIBER` |
| `job(name, schedule and options).handledBy(Job, [tokens])` | binds the job (singleton, kind `job`) and registers its `run(execution)` on `JOB_SCHEDULER` |
| `.handledByFactory((resolve) => handler)` | the factory form of the four lines above |
| `include(declared)` | adds classes that declare themselves: what `contextModule` does |

Handlers are registered when the application is created, which resolves the two buses; a
handler itself is built on the first message it handles, then reused. Consumers are subscribed
by `start()` and unsubscribed by `stop()`, since a subscription is a side effect.

`definition` is anything with `type`, `version` and `parse(event)`: a declaration made by
`defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is. An event of another version is
skipped, an event the definition cannot read throws `UnreadableEventError` so that the provider
retries or dead-letters it, and a redelivered event is handled once per `consumer` name when
`PROCESSED_EVENTS` is bound. The name is required: it is the idempotency key, and it must
survive the renaming of a class.

Every consumer handles its events inside `EXECUTION_SCOPE`, in a context of its own: origin
`event`, the correlation of the event (its id when it names none), the event as `causationId`,
and `systemActor(consumer)` as actor, which is therefore what `ACTOR_CONTEXT` answers to the
repositories of the consuming context. Nothing to wire. A project whose envelopes name an
actor adds `on(definition, { consumer, actorOf: (event) => actor })`. For the correlation to
start at the request, publish through a scoped publisher:

```ts
kernelModule({
  eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(store), resolve(EXECUTION_SCOPE)),
});
```

## The kernel module

`kernelModule(options?)` binds the tokens every context depends on.

| Token | Port | Default | Option |
|---|---|---|---|
| `CLOCK` | `Clock` | `SystemClock` | `clock` |
| `ID_GENERATOR` | `IdGenerator` | `UuidGenerator` | `ids` |
| `UNIT_OF_WORK` | `UnitOfWork` | `InMemoryUnitOfWork` | `unitOfWork` |
| `COMMAND_BUS` | `CommandBus` | `InMemoryCommandBus` running each command in the unit of work | `commandBus` |
| `QUERY_BUS` | `QueryBus` | `InMemoryQueryBus` | `queryBus` |
| `EVENT_BUS` | `EventBus` | `InMemoryEventBus` | `eventBus` |
| `EVENT_PUBLISHER` | `IntegrationEventPublisher` | the event bus | `eventPublisher` |
| `EVENT_SUBSCRIBER` | `IntegrationEventSubscriber` | the event bus | `eventSubscriber` |
| `PROCESSED_EVENTS` | `ProcessedEventStore` | `InMemoryProcessedEventStore` | `processedEvents` |
| `EXECUTION_SCOPE` | `ExecutionScope` | `AsyncLocalStorageExecutionScope` | `executionScope` |
| `ACTOR_CONTEXT` | `ActorContext` | `ScopedActorContext`: the actor of the execution scope | `actorContext` |
| `LOGGER` | `Logger` | `NoopLogger` | `logger` |
| `METRICS` | `Metrics` | `NoopMetrics` | `metrics` |
| `CACHE` | `Cache` | `InMemoryCache` on `CLOCK` | `cache` |
| `LOCK` | `Lock` | `InMemoryLock` on `CLOCK`: this process only | `lock` |
| `RATE_LIMITER` | `RateLimiter` | `InMemoryRateLimiter` on `CLOCK`: this process only | `rateLimiter` |
| `DOMAIN_EVENTS` | `DomainEventDispatcher` | `InMemoryDomainEventDispatcher` | `domainEvents` |
| `JOB_SCHEDULER` | `JobScheduler` | `InProcessJobScheduler` of `@ddd-ts-kit/scheduling` on `CLOCK`, `LOCK`, `EXECUTION_SCOPE`, `ID_GENERATOR`, `LOGGER` and `METRICS` | `jobScheduler` |

The tokens are defined in `@ddd-ts-kit/kernel/declarations` and exported again from here: a
handler names `CLOCK` in its dependency list without importing this package. Each is a global
symbol, the same in every copy of the kernel a process loads.

An option is an instance or a `(resolve) => instance` factory. An adapter with dependencies of
its own reads better in the module that owns them:

```ts
export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.bind(DATABASE).toFactory(() => connect(config.databaseUrl));
    builder.rebind(UNIT_OF_WORK).toClass(DrizzleUnitOfWork, [DATABASE]);
    builder.rebind(EVENT_PUBLISHER).toClass(OutboxPublisher, [DATABASE, CLOCK]).as('publisher');
    builder.rebind(EVENT_SUBSCRIBER).toClass(BrokerSubscriber, [BROKER]);
  },
});
```

Use cases publish through `EVENT_PUBLISHER` and never through `EVENT_BUS`, so moving to an
outbox touches no context. A bus given for `COMMAND_BUS` or `QUERY_BUS` needs a
`register(type, handler)` method for the declared handlers to be attached to it.

## Scheduled jobs

A class of `application/scheduling/` that carries `@Scheduled` is a job of its context: nothing
else registers it.

```ts
// contexts/billing/application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [COMMAND_BUS])
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

- **Registered when the application is created**, on `JOB_SCHEDULER`, with the defaults of
  its options filled in. The class is built on its first run, so a job that cannot be built
  fails that run and nothing else.
- **Started by `start()`**, after the modules and once the consumers are subscribed: a job
  sends commands whose events must find their handlers. **Stopped first by `stop()`**, which
  waits for the runs in progress, then aborts them, while everything they use is still up.
- **Each run happens in `EXECUTION_SCOPE`**, in a context of origin `schedule`, as
  `systemActor('<job name>')`, with a correlation of its own. The scheduler does it, not the
  job.
- **The default scheduler** is the in-process one of `@ddd-ts-kit/scheduling`, on the bound
  `CLOCK` and `LOCK`. With the default lock, which excludes inside one process only, several
  instances each run every job: bind a lock between processes (`RedisLock`) before scaling
  out. What one instance among several guarantees, and what it does not, is in that README.
- **An application without job** never resolves the scheduler.

`createApplication({ jobs })` says whether this process runs the jobs and what configuration
changes of each:

```ts
createApplication({
  modules,
  jobs: {
    start: config.runJobs,                                           // default true
    settings: {
      'billing.send-reminders': { enabled: config.reminders.enabled },
      'billing.export-ledger': { schedule: { every: '6h' }, timeoutMs: 300_000 },
    },
  },
});
```

| Option | |
|---|---|
| `start: false` | the jobs are registered and described, `runNow` runs one, and `start()` never starts the scheduler: the process that serves requests next to a worker process that runs the jobs |
| `settings['<job name>']` | `enabled`, `schedule` and any option of the declaration (`overlap`, `missed`, `timeoutMs`, `jitterMs`, `singleInstance`), which win over what the class wrote. A key left undefined changes nothing |

`app.resolve(JOB_SCHEDULER)` is the port: `runNow(name)` for an operations endpoint,
`describe()` for the next run and the last outcome of each job. A context extracted as its own
service takes its jobs with it: they belong to its module, and nothing is global.

## Tests

A declared context is tested like an explicit one: the module is the unit, the fakes replace
its adapters.

```ts
const app = createTestApplication({
  modules: [contextModule('billing', billing)],
  fakes: [fake(PAYMENTS, new InMemoryPayments())],
});
```

`createTestApplication({ modules, fakes, now?, idPrefix?, actor?, session?, executionContext?, jobs? })` puts the modules on a deterministic
kernel, whether or not they list `kernelModule()`, and returns the application plus what a
spec touches:

| Member | Is |
|---|---|
| `commandBus`, `queryBus` | the in-memory buses, with every declared handler |
| `eventBus` | `InMemoryEventBus`; `eventBus.published` lists what the use cases announced |
| `domainEvents` | `InMemoryDomainEventDispatcher`; dispatch a domain event to see the declared handlers react |
| `clock` | `FixedClock` at `now` (default `2026-01-01T00:00:00.000Z`); `clock.advance(ms)` |
| `ids` | `SequentialIdGenerator`: `id-1`, `id-2`... |
| `actorContext` | `FixedActorContext`; `actAs(actor)` changes who infrastructure sees |
| `executionScope` | `FixedExecutionScope` (correlation `test-correlation`, origin `test`), following `actorContext` |
| `logger`, `metrics` | `InMemoryLogger` and `InMemoryMetrics`: assert `logger.entries`, `metrics.samples` |
| `cache` | `InMemoryCache` on `clock` |
| `lock`, `rateLimiter` | `InMemoryLock` and `InMemoryRateLimiter` on `clock` |
| `jobs` | `runNow(name)` runs a declared job as the scheduler would and throws what it threw; `scheduler` is a `ManualJobScheduler` on `clock`, not started |
| `get(token)` | `resolve`, typed by the token |
| `as(actorOrSession, work)` | runs a block as someone else, then comes back |

`actor`, `session` and `executionContext` say who infrastructure sees by default: an actor, a
whole session (its actor becomes the current actor), or the complete execution context for a
spec about a tenant, a correlation or a deadline. `app.as` switches for one block and hands the
actor to it, which is what a spec about authorization wants to read:

```ts
const app = createTestApplication({ modules: [billingModule, authorization], actor: accountant });

await app.as(accountant, (actor) => app.commandBus.execute(new IssueInvoice(actor, 'customer-1')));
await expect(
  app.as(clerk, (actor) => app.commandBus.execute(new VoidInvoice(actor, 'inv-1'))),
).rejects.toMatchObject({ code: 'FORBIDDEN' });

app.as(aSession().of(accountant).impersonatedBy('support-7').build(), () => {
  // infrastructure sees the session: audit records the impersonation
});
```

Use cases still receive the actor in the command or query; `as` only decides what the
repositories, the audit columns and the tenant scoping see while the block runs.

**Jobs are never started by time** in a test application: `start()` subscribes the consumers
and leaves the scheduler alone, whatever the clock does. A spec runs a job by name and asserts
the fakes, as it would for a command:

```ts
await app.jobs.runNow('billing.send-reminders');

expect(mailer.sent).toHaveLength(2);
```

For a spec about the schedule itself, `await app.jobs.scheduler.start()` then
`await app.jobs.scheduler.advance(ms)` move `app.clock` and run what becomes due, and
`app.jobs.scheduler.runs` lists what happened. The `jobs` option takes per-job settings, as
`createApplication({ jobs: { settings } })` does. Runs take their correlation ids from a
generator of their own (`job-run-1`...), so a job leaves the identifiers a spec predicts alone.

A fake must stand for a token that a module binds or that a class depends on, otherwise
`UNKNOWN_FAKE` is raised: a fake for the wrong token would silently leave the real adapter in
place. Consumers receive events once `await app.start()` ran.

`createApplication({ overrides: [override(TOKEN, value)] })` is the unchecked form, and
`overrideForTests(app, TOKEN, value)` swaps a binding on an existing application; call it
before the first `resolve`, since a singleton already built keeps what it was given. An
override replaces the binding, may stand in for a module that is not loaded, and is not
decorated. Every application owns a tsyringe child container (`app.container`), so two tests
never share instances.

## Checks

`createApplication` throws a `WiringError` (with a `code`) before anything is instantiated:

- `DUPLICATE_BINDING`: a token bound twice, both modules named;
- `NOTHING_TO_REBIND`: a `rebind` of a token that no earlier module binds;
- `UNBOUND_DEPENDENCY`: a class dependency that no module binds, or handlers, consumers and
  jobs declared without the bus or the scheduler they go on;
- `DEPENDENCY_CYCLE`: a cycle between class bindings, the path printed;
- `INCOMPLETE_BINDING`: a `bind`, `command`, `query` or `on` left without its target;
- `DUPLICATE_HANDLER`: a command or a query with two handlers, both modules named;
- `DUPLICATE_CONSUMER`: two consumers of the same event sharing a name;
- `BUS_WITHOUT_REGISTER`: handlers declared for a bus that cannot receive them;
- `UNKNOWN_FAKE`: see above;
- `UNDECLARED_CLASS`: a class listed in `contextModule` or `include` without a declaration;
- `DUPLICATE_JOB`: two jobs sharing a name, both modules named: the name is the lock, the
  actor and the label of a job;
- `UNKNOWN_JOB`: settings given for a job that no module declares;
- `INVALID_JOB_SETTINGS`: a schedule or an option of the settings that cannot be read (a cron,
  a time zone, a zero interval), or a job of an explicit module whose name or schedule cannot.

The checks do not tell the two styles apart. For a declared class the message names the class
and, when discovery loaded it, the file:

```
Token "billing.InvoiceRepository" is bound twice: by module "billing" (declared by class
KnexInvoiceRepository in /app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js)
and by module "invoicing" (declared by class InMemoryInvoiceRepository).
```

Factories do not declare what they resolve, so a cycle or a missing token going through a
factory is reported when it is resolved (`DEPENDENCY_CYCLE`, `UNBOUND_TOKEN`).

## Diagnostics

`app.describe()` returns the wiring as plain, serializable data: tokens and classes by name.

```ts
{
  modules: ['kernel', 'ordering'],
  bindings: [{ token: 'PlaceOrderHandler', module: 'ordering', kind: 'use-case', lifetime: 'singleton',
               source: 'class', implementation: 'PlaceOrderHandler',
               dependencies: ['ordering.OrderRepository', 'kernel.Clock'], overridden: false }],
  commands: [{ message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' }],
  queries: [{ message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' }],
  integrationEventHandlers: [{ event: 'billing.payment.captured', version: 1, consumer: 'ordering.mark-order-paid',
                               handler: 'MarkOrderPaidOnPaymentCaptured', module: 'ordering' }],
  domainEventHandlers: [],
  policies: [],
  jobs: [{ name: 'ordering.expire-carts', schedule: 'every 15m', overlap: 'skip', missed: 'skip', jitterMs: 0,
           enabled: true, singleInstance: true, job: 'ExpireCartsJob', module: 'ordering' }],
  overrides: [],
}
```

An entry that comes from a declaration also carries `origin: 'declared'`, `declaredBy` (the
class) and, when discovery loaded it, `file`. An entry written in a module is `explicit` and
carries none of the three:

```ts
{ token: 'billing.InvoiceRepository', module: 'billing', kind: 'repository', lifetime: 'singleton',
  source: 'class', implementation: 'KnexInvoiceRepository', dependencies: ['platform.Database'],
  overridden: false, origin: 'declared', declaredBy: 'KnexInvoiceRepository',
  file: '/app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js' }
```

`domainEventHandlers` lists the declared handlers of domain events, `policies` the declared policy
classes, `jobs` the jobs with the settings they run with, those of the application applied.
What a job did last and when it runs next is not wiring: ask `app.resolve(JOB_SCHEDULER).describe()`.

## The `decorate` hook

`createApplication({ decorate })` receives every instance a binding creates, handlers and
consumers included, with `{ token, context, kind? }`, and returns the instance to hand out. It
is the place for cross-cutting wrappers such as tracing; see the README of
`@ddd-ts-kit/tracing`. This package depends on no tracing library.

One binding takes its own wrappers with `.with(...)`, the first outermost:

```ts
builder.bind(PAYMENTS).toClass(HttpPaymentGateway, [HTTP]).as('external').with(retry({ attempts: 3 }), timeout(2000));
```

A `BindingAspect` is `(instance, { kind?, className, context, token }) => instance`; the aspects
of `@ddd-ts-kit/aspects` fit as they are, and its `aspects(...)` builds a `decorate` hook. The
`decorate` hook comes around the aspects of a binding.

## Access control

A use case says what it requires, or says it is public: on the message itself with
`@Requires(permission)` or `@Public()`, or where it is registered:

```ts
builder.command(IssueInvoice).requires(permissions['invoice.issue']).handledBy(IssueInvoiceHandler, [INVOICES, CLOCK]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);
```

`.requires` exists only for messages that carry an actor (`AuthorizedCommand`,
`AuthorizedQuery` of the kernel). With `createApplication({ modules, authorization: 'required' })`
an application whose command or query declares neither, in either way, does not start
(`UNDECLARED_AUTHORIZATION`), and one that declares them without a module enforcing them does
not either (`AUTHORIZATION_NOT_ENFORCED`). The enforcement itself, the authorizers and the
tokens typed by them live in `@ddd-ts-kit/auth` (`authorizationModule` from
`@ddd-ts-kit/auth/di`). `ACTOR_CONTEXT` is bound by `kernelModule()`; the test application
takes an `actor` option.

## Limits

- A class plays one role: one declaration per class, and an adapter that implements two ports
  is bound explicitly, once per token.
- A class decorator of another library that replaces the class (answers a new one) must be
  written below the declaration, so that the declaration lands on the class that is exported.
  A decorator that only annotates, as `@Injectable()` does, composes in either order.
- A declaration is not inherited: a subclass declares itself or is bound explicitly.
- A consumer name, a policy name, a job name and the name of a domain event are written in the
  declaration; they are not derived from the class, which a refactoring renames.
- Discovered files are imported by nothing. In a project using discovery, tell knip that they
  are entries and dependency-cruiser that they are not orphans:

  ```jsonc
  // knip.json
  { "entry": ["src/main.ts", "src/contexts/*/{application,infrastructure}/**/*.{command,query,handler,integration-handler,event-handler,policy,job,repository,gateway,adapter}.ts"] }
  ```

  ```js
  // .dependency-cruiser.cjs, in the pathNot of the no-orphans rule
  '\\.(command|query|handler|integration-handler|event-handler|policy|job|repository|gateway|adapter)\\.ts$'
  ```

  With a barrel and `contextModule` neither setting is needed.
