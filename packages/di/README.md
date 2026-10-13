# @ddd-ts-kit/di

Context modules on top of [tsyringe](https://github.com/microsoft/tsyringe), for projects that
want dependency injection without a heavy framework.

A port is an abstract class, and the class is what you inject by. A class says what it is, and
the context is assembled from what its classes say: there is no file listing bindings to keep in
step with the code, and no constant standing for a port. The explicit module, where every
binding is written by hand, stays supported and mixes with the declared style in one
application.

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

A port lives where the layer that owns it lives: a repository port in
`domain/repositories/`, any other port in `application/ports/`, one abstract class per file.

```ts
// contexts/billing/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {
  abstract findUnpaidOf(customerId: string): Promise<readonly Invoice[]>;
}
```

```ts
// contexts/billing/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract capture(invoiceId: string, amount: Money): Promise<PaymentReceipt>;
}
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
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

@CommandHandler(IssueInvoice)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly payments: PaymentGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const invoice = Invoice.issue({ id: this.ids.next(), customerId: command.customerId, issuedAt: this.clock.now() });

    await this.invoices.save(invoice);

    return invoice.id;
  }
}
```

The handler only saves. The save hands over the domain events the aggregate recorded, and the
unit of work of the command dispatches them once the handler has returned, before the commit:
see "Domain events and the unit of work".

```ts
// contexts/billing/application/queries/get-invoice/get-invoice.query.ts and .handler.ts
@Public()
export class GetInvoice extends Query<InvoiceView | undefined> {
  constructor(readonly invoiceId: string) {
    super();
  }
}

@QueryHandler(GetInvoice)
export class GetInvoiceHandler implements QueryHandler<GetInvoice> { /* ... */ }
```

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { CommandBus, systemActor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from '@/contexts/ordering/published-language/index';

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlaced implements IntegrationEventHandler<OrderPlacedPayload> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(systemActor('billing.invoice-on-order-placed'), event.payload.customerId));
  }
}
```

```ts
// contexts/billing/application/integration/publishers/invoice-issued.publisher.ts
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

@DomainEventHandler(InvoiceIssued, { name: InvoiceIssued.eventName })
export class InvoiceIssuedPublisher implements DomainEventHandler<InvoiceIssued> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: InvoiceIssued): Promise<void> { /* publishes billing.invoice.issued */ }
}
```

```ts
// contexts/billing/infrastructure/persistence/knex-invoice.repository.ts
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceRepository)
export class KnexInvoiceRepository implements InvoiceRepository { /* ... */ }
```

```ts
// contexts/billing/infrastructure/external/http-payment.gateway.ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { retry, timeout } from '@ddd-ts-kit/aspects';

@Gateway(PaymentGateway, { aspects: [retry({ attempts: 3 }), timeout(2000)] })
export class HttpPaymentGateway implements PaymentGateway { /* ... */ }
```

That is the whole context. It is assembled in one line, in one of two ways.

```ts
// main.ts, discovered: no file of the context names its classes
import { CommandBus } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';

const billing = await discoverContext('billing', new URL('./contexts/billing/', import.meta.url));
const app = createApplication({ modules: [kernelModule(), platformModule, billing], authorization: 'required' });
await app.start();
const invoiceId = await app.resolve(CommandBus).execute(new IssueInvoice(actor, 'customer-1')); // typed string
```

```ts
// main.ts, listed: one generated barrel per context and nothing else
import { contextModule } from '@ddd-ts-kit/di';
import * as billing from '@/contexts/billing/billing.declarations';

const app = createApplication({ modules: [kernelModule(), platformModule, contextModule('billing', billing)] });
```

## Ports and values

### A port is an abstract class

The class names the dependency and carries its type: a constructor parameter typed by it
names what is injected, `app.resolve(Clock)` answers a `Clock`, and nothing else stands for
the port. The
ports of the kernel (`Clock`, `IdGenerator`, `UnitOfWork`, `CommandBus`, `QueryBus`,
`IntegrationEventPublisher`, `ExecutionScope`...) are abstract classes imported from
`@ddd-ts-kit/kernel`; yours are written the same way.

The rule, checked when a binding is registered (`INVALID_PORT` for `toClass`, a
`DeclarationError` for a decorator):

- a port has abstract members only: no body, no constructor parameter, no private or protected
  member. One exception, `static readonly tokenKey` (see "Identity");
- a port may extend another port, and is then another port;
- an adapter `implements` its port and never `extends` it;
- a class bound to itself (`bind(Settings).toClass(Settings, [...])`, a handler, a job, a
  policy) is no port and keeps its methods.

Because a port holds nothing but a shape, a fake and a plain object stand for it:
`fake(Clock, { now: () => new Date(0) })`.

### A value is typed by an abstract class too

A configuration object, a database handle, a list, a primitive: an abstract class with
`abstract readonly` properties, bound with `toValue` to a plain object. That is the one way.

```ts
// platform/database.ts
export abstract class Database {
  abstract readonly client: Knex;
}

// contexts/billing/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly apiUrl: string;
  abstract readonly apiKey: string;
}

// platform/platform.module.ts
builder.bind(Database).toValue({ client: knex(config.database) });
builder.bind(PaymentSettings).toValue({ apiUrl: config.payments.url, apiKey: config.payments.key });
```

A primitive is wrapped: `abstract class TaxRate { abstract readonly value: number }`, then
`builder.bind(TaxRate).toValue({ value: 0.2 })`.

### What the compiler checks

Where the declaration or the statement is written, with no run:

| Mistake | Example |
|---|---|
| the class does not implement the port | `bind(Mailer).toClass(SmsSender)`, `@Repository(InvoiceRepository)` on a class missing `findById` |
| the value does not have the shape of the port | `bind(Clock).toValue('noon')`, `fake(OrderRepository, { save })`, `override(Clock, 12)` |
| a list names a port of another type | `handledBy(GetOrderHandler, [Clock])` for a constructor taking an `OrderRepository` |
| a list is in another order than the constructor | `[IdGenerator, Clock]` for `(clock: Clock, ids: IdGenerator)` |
| a list is one short or one too many, or a statement of an explicit module has none | `toClass(ReserveStock)` for a constructor with parameters |
| a list names a concrete class where its port is expected | `[InMemoryOrderRepository]` for a parameter typed `OrderRepository` |
| the handler does not handle that message or answers another result | `command(PlaceOrder).handledBy(CancelOrderHandler, ...)` |
| the event handler handles another payload | `on(ParcelShipped, ...).handledBy(InvoiceOnOrderPlaced, ...)` |
| `.requires(...)` on a message that carries no actor | `query(GetCatalog).requires(permission)` |

A list is the one of a statement of an explicit module (`toClass`, `handledBy`), of a
generated `injected(Class, [..])`, or of a decorator that still writes one. A decorator
without a list accepts any constructor: the signature is then the statement, and what the
generated file registers from it is checked the same way (see "Constructor injection").

Two limits of a structural type system. A concrete class is told apart from its port by what
it adds: a class with no member of its own, private ones included, is the port for the
compiler. And a constructor whose parameters are all optional still has parameters: a
statement of an explicit module gives it a list.

### Identity

`tokenIdentity(port)` is the symbol a container keys a port by; `describeToken(port)` is its
class name, which is what error messages and `describe()` print.

- A port of your project is identified by the class itself. Two classes of the same name are
  two ports, and a class that extends a port is another port.
- A port that declares `static readonly tokenKey = '<package>.<Port>'` is identified by that
  key, the same in every copy of its package a process loads. The ports of the kernel all
  declare one (`kernel.Clock`...), and so do `UseCaseGuard`, `UseCaseDeclarations` and
  `DeclaredPolicies` of this package: a handler compiled against one copy of the kernel is
  wired by a container built on another.
- The key is not inherited: `abstract class BusinessClock extends Clock` is another port, bound
  separately.

The limit: a port of your own without a `tokenKey`, loaded twice (the same file imported as
source and as compiled output, or a package installed in two versions), is two ports. The
binding made for one does not answer the other, which the application reports as unbound.
Load each port once, or give a port that a published package exposes a `tokenKey`.

## What a class may declare

The full list, with the options of each, is in the README of `@ddd-ts-kit/kernel`
("Declarations"). What this package does with each:

| Declaration | Becomes |
|---|---|
| `@Requires(permission, options?)` / `@Public()` on a command or a query | the access of the use case: what `.requires(...)` and `.public()` say in an explicit module, read by `authorization: 'required'` and by the authorization module |
| `@CommandHandler(Message)`, `@QueryHandler(Message)` | a singleton of kind `use-case`, registered on `CommandBus` or `QueryBus` |
| `@IntegrationEventHandler(contract, { consumer })` | a singleton of kind `consumer`, subscribed by `start()` on the subscriber of its context, idempotent per consumer name, run in the execution context of the event, its mark and its work in one unit of work |
| `@DomainEventHandler(Event, { name, phase? })` | a singleton of kind `domain-event-handler`, attached to `DomainEventDispatcher` when the application is created, in its phase: `before-commit` (default), at the end of the unit of work and inside its transaction, or `after-commit`, once it has committed; an event dispatched under the name and built from another class is left alone |
| `@Projection(name)`, with `@On(definition)` or `@On(Event, { name })` on its methods | a singleton of kind `consumer`. Each integration event it applies is subscribed by `start()` under the name of the projection, exactly as a handler of integration events is: its own execution context, idempotent per name, its mark and its write in one unit of work. Each domain event of its own context is attached to `DomainEventDispatcher` and applied inside the save. See "Projections" |
| `@Scheduled(name, schedule and options)` | a singleton of kind `job`, registered on `JobScheduler` when the application is created, started by `start()` after the consumers and stopped first by `stop()`; see "Scheduled jobs" |
| `@Repository(Port, options?)` | the binding of the port, kind `repository`: its save hands the domain events of the aggregate to the unit of work, which dispatches them at its end |
| `@Gateway(Port, options?)` | the binding of the port, kind `gateway` |
| `@Adapter(Port, { kind? })` | the binding of the port, kind `external` (default) or `publisher` |
| `@Policy(permission, { name })` | a singleton listed in `DeclaredPolicies`, which the authorization module evaluates |

A handler, a job, a policy and an event handler are bound under themselves: the class is what
builds them, and `app.resolve(IssueInvoiceHandler)` answers the instance the bus runs. One
class is therefore one binding: listing a declared class in two modules is refused.

The options of a repository, a gateway and an adapter are the ones of an explicit binding:
`transient: true` for `.transient()`, `aspects: [...]` for `.with(...)`, the first outermost,
and `replaces: true` for `rebind`, which a platform adapter uses to take the place of a default
of the kernel module (`@Adapter(UnitOfWork, { replaces: true })`). The kind
reaches the `decorate` hook, so tracing and global aspects see declared adapters as they see
explicit ones. A handler is built on the first message it handles; nothing is built when a
class is declared or when a module is created.

### `contextModule(name, declared)`

`declared` is a class, a list (lists may nest) or the namespace import of a barrel. Of a
namespace only the declared classes are kept, so the barrel may also export ports and types.
A class named directly in a list must carry a declaration (`UNDECLARED_CLASS`): a forgotten
decorator is not skipped in silence. A class met twice is taken once. The module is static:
a bundler follows every class, and so does a dead-code analysis.

### `discoverContext(name, directory, options?)`

From `@ddd-ts-kit/di/discovery`, the one entry of this package that reads the disk. It loads,
in the order of their paths, every file under `application/` and `infrastructure/` of the
context whose name ends with a role suffix, and keeps the exported classes that declare
themselves; then `<name>.dependencies` of the same directory when it exists, the generated
file that registers what their constructors take (see "Constructor injection"):

| Suffix | Folder | Declares |
|---|---|---|
| `*.command`, `*.query` | `application/commands/`, `application/queries/` | `@Requires` or `@Public` |
| `*.handler` | `application/commands/`, `application/queries/` | `@CommandHandler` or `@QueryHandler` |
| `*.integration-handler` | `application/integration/handlers/` | `@IntegrationEventHandler` |
| `*.publisher` | `application/integration/publishers/` | `@DomainEventHandler` |
| `*.event-handler` | `application/event-handlers/` | `@DomainEventHandler` |
| `*.policy` | `application/authorization/` | `@Policy` |
| `*.job` | `application/scheduling/` | `@Scheduled` |
| `*.projection` | `application/projections/` | `@Projection` |
| `*.repository` | `infrastructure/persistence/` | `@Repository` |
| `*.gateway`, `*.adapter` | `infrastructure/` | `@Gateway`, `@Adapter` |

A publisher is a domain event handler whose work is to announce the event to the other
contexts: the same declaration as an event handler, under a suffix and a folder that say what
it is for.

`domain/`, `presentation/`, `published-language/` and `test/` are never read, and neither are
the `*.port` files of `application/ports/`: ports and fakes are left alone. It fails with a
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
  test runner that transforms them;
- under Vitest this package must be inlined, so that the `import()` of discovery goes through
  the runner, which compiles the `.ts` role files and lowers their decorators:
  `test: { server: { deps: { inline: ['@ddd-ts-kit/di'] } } }`. A project initialised with
  `--assembly discovery` has that line in its `vitest.config.ts`.

Prefer `contextModule` with a barrel for anything bundled, for a serverless cold start, and
whenever the tooling should see the classes; prefer discovery when adding a file must be all
it takes.

## Constructor injection

A declared class states what it depends on once, in its constructor, and its decorator lists
nothing:

```ts
@CommandHandler(IssueInvoice)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}
}
```

The container does not ask the compiler for those types: `design:paramtypes` exists only with
legacy decorators compiled by `tsc` or swc, so it is absent with standard decorators and under
`tsx` or esbuild, and it is `Object` for a port imported with `import type`. Instead
`ddd-ts-kit docs` (and every `generate`, and every start of the `dev` script) reads the
constructor signatures from the sources and writes, in the generated file of the context, what
each class is given:

```ts
// contexts/billing/billing.declarations.ts (generated)
import { injected } from '@ddd-ts-kit/kernel/declarations';
// ... one import per class and per token

export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';
// ... one export per role file

injected(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);
```

`injected` registers the list in a registry of the kernel, shared by every copy of the kernel
a process loads, and is typed like the list of a statement: the compiler refuses a generated
list that does not match the constructor. When a module is recorded, each declared class is
given, in this order:

1. the list of its decorator, when it wrote one (`@CommandHandler(IssueInvoice, [InvoiceRepository, IdGenerator, Clock])`:
   the form 0.1 projects wrote, still supported, and it wins);
2. the list `injected` registered for it;
3. nothing, when its constructor takes no parameter.

Anything else stops `createApplication` before a single instance is built:

| Code | When | The message says |
|---|---|---|
| `MISSING_DEPENDENCIES` | the constructor takes parameters, the decorator lists nothing and no generated file that was loaded registered a list | the class, its file when discovery loaded it, the module, and to run `ddd-ts-kit docs` and assemble the context from the generated file |
| `DEPENDENCY_ARITY` | the registered list has another length than the constructor (the file is stale), or the list of a decorator is shorter than the constructor (a cast, plain JavaScript) | both lengths, the tokens of the list, and the same command |

So nothing is ever injected as `undefined`. Where the lists come from, per assembly:

| | The lists are in | Loaded by |
|---|---|---|
| `contextModule('billing', billing)` with the barrel | `billing.declarations.ts`, after the exports | the `import * as billing` of the composition root, or of a test |
| `discoverContext('billing', directory)` | `billing.dependencies.ts` (`.js` once compiled), next to the layers of the context | the scan, with the role files, under the preferred extension; a context whose classes take nothing has none |
| an explicit module, `bind(..).toClass(C, [..])`, `handledBy(H, [..])` | the statement: explicit stays explicit, nothing is read from a signature | the module file |
| `builder.include(SomeDeclaredClass)` in an explicit module | the list of its decorator, or the generated file of its context when that file is imported | the module file |

A test assembles a context from its generated file, as the composition root does. To build
one class alone, take it from that file:
`contextModule('billing', { IssueInvoiceHandler: billing.IssueInvoiceHandler })`. A class
imported from its own file and handed over alone has no list, and is refused by name.

`declaredTokens(declared)` answers the token each declared class of a source is bound under
(its port for an adapter, the class itself for a handler, a job, a policy or a projection):
`declaredTokens(billing).map((token) => app.resolve(token))` builds every class of a
context, which is how a test proves that none is left without what it takes.

What keeps a generated list current is outside this package: `declarations/barrel-current`
of `ddd-ts-kit check` and `ddd-ts-kit docs --check` fail, naming the class, when a constructor
changed without regeneration, and `declarations/constructor-injection` refuses a parameter
that names no single class.

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
exists in either: what a constructor takes is read from the source and registered by a
generated file, the one mechanism in both modes. Vitest lowers legacy decorators by
itself; for standard ones add `decorators()` of `@ddd-ts-kit/testing/vitest` to the Vitest
config.

## An explicit module

The alternative: every binding written by hand in `<context>.module.ts`. It needs no
decorator at all, and suits a context whose wiring is unusual (factories, values, conditional
bindings) or a team that wants the wiring in one file. The ports are the same abstract classes,
in the same files.

```ts
// contexts/ordering/ordering.module.ts
import { Clock, CommandBus, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '@ddd-ts-kit/di';
import { PaymentCaptured } from '@/contexts/billing/published-language/index';

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(OrderRepository).toClass(DrizzleOrderRepository, [Database]).as('repository');
    builder.bind(OrderReads).toClass(DrizzleOrderReads, [Database]).as('repository');
    builder.bind(StockGateway).toClass(HttpStockGateway, [StockSettings]).as('gateway');

    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [OrderRepository, StockGateway, IntegrationEventPublisher, IdGenerator, Clock]);
    builder.command(MarkOrderPaid).handledBy(MarkOrderPaidHandler, [OrderRepository, Clock]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [OrderReads]);

    builder
      .on(PaymentCaptured, { consumer: 'ordering.mark-order-paid' })
      .handledBy(MarkOrderPaidOnPaymentCaptured, [CommandBus]);
  },
});
```

Nothing else is needed: no manual registration on a bus, no subscription code.

```ts
// main.ts
import { CommandBus } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';

const app = createApplication({ modules: [kernelModule(), platformModule, orderingModule, billingModule] });
await app.start();
const orderId = await app.resolve(CommandBus).execute(new PlaceOrder('sku-1')); // typed string
process.on('SIGTERM', () => void app.stop());
```

```ts
// contexts/ordering/test/unit/place-order.handler.spec.ts
import { createTestApplication, fake } from '@ddd-ts-kit/di';

it('places an order and announces it', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({
    modules: [orderingModule],
    fakes: [fake(OrderRepository, orders), fake(StockGateway, new InMemoryStock({ 'sku-1': 3 }))],
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
  statements, for the value or the factory a decorator cannot express.

  ```ts
  export const billingModule = defineContextModule({
    name: 'billing',
    register(builder) {
      builder.include(billing);
      builder.bind(TaxRate).toValue({ value: config.taxRate });
    },
  });
  ```

- **A decorated message in an explicit module**: `builder.command(IssueInvoice).handledBy(...)`
  reads the `@Requires` or `@Public` of the message; `.requires(...)` and `.public()` written
  on the builder win.
- **Replacing a declared adapter**: a later module calls `builder.rebind(Port)`, and a test
  gives `fake(Port, ...)`, exactly as for an explicit binding.

## Statements of an explicit module

| Call | Meaning |
|---|---|
| `bind(Port).toClass(Class, [ports])` | `new Class(...)` with the ports resolved in order; the list is omitted for a constructor without parameters. The class implements the port (`INVALID_PORT` when the port has a body or the class extends it) |
| `bind(Port).toFactory((resolve) => instance)` | anything a constructor cannot express |
| `bind(Port).toValue(value)` | an existing object, a fake, or the plain object a value class types |
| `.singleton()` / `.transient()` | one instance per application (default) or one per resolution |
| `.as(kind)` | role of the binding, handed to the `decorate` hook: `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`, `domain-event-handler`, `job`. A port extending the kernel `Repository` is of kind `repository` without it |
| `rebind(Port).to...` | replaces the binding of a module listed earlier, such as a default of `kernelModule()` |
| `command(Type).handledBy(Handler, [ports])` | binds the handler under itself (singleton, kind `use-case`) and registers it on `CommandBus` |
| `query(Type).handledBy(Handler, [ports])` | the same on `QueryBus` |
| `on(contract, { consumer }).handledBy(Handler, [ports])` | binds the integration event handler under itself (kind `consumer`) and subscribes its `handle(event)` on the subscriber of the module |
| `job(name, schedule and options).handledBy(Job, [ports])` | binds the job under itself (singleton, kind `job`) and registers its `run(execution)` on `JobScheduler` |
| `.handledByFactory((resolve) => handler)` | the factory form of the four lines above, bound under a class made for the statement, which reads `command(PlaceOrder) handler` in a description |
| `include(declared)` | adds classes that declare themselves: what `contextModule` does |

**One class is one binding.** `handledBy(Handler)` binds the class under itself, so the same
handler class cannot be given to two statements: the second is refused with
`DUPLICATE_BINDING`. One handler per message is the rule the kit follows everywhere; where one
object really serves two statements, give each `handledByFactory(() => shared)`.

Handlers are registered when the application is created, which resolves the two buses; a
handler itself is built on the first message it handles, then reused. Consumers are subscribed
by `start()` and unsubscribed by `stop()`, since a subscription is a side effect.

## Integration event handlers

`contract` is anything with `type`, `version` and `parse(event)`: a declaration made by
`defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is. An event of another version is
skipped, an event the contract cannot read throws `UnreadableEventError` so that the provider
retries or dead-letters it, and a redelivered event is handled once per `consumer` name when
`ProcessedEventStore` is bound. The name is required: it is the idempotency key, and it must
survive the renaming of a class.

### The execution context of the event

Every consumer handles its events inside `ExecutionScope`, in a context of its own: origin
`event`, the correlation of the event (its id when it names none), the event as `causationId`,
and `systemActor(consumer)` as actor, which is therefore what `ActorContext` answers to the
repositories of the consuming context. Nothing to wire. A project whose envelopes name an
actor adds `on(contract, { consumer, actorOf: (event) => actor })`. For the correlation to
start at the request, publish through a scoped publisher:

```ts
kernelModule({
  eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(store), resolve(ExecutionScope)),
});
```

### One unit of work per event

When `UnitOfWork` and `ProcessedEventStore` are both bound, which `kernelModule()` does, the
idempotency mark and the work of the handler run inside one `unitOfWork.run`, opened inside
the execution context of the event:

- a handler that fails leaves no mark: the transaction that held it is rolled back, and the
  redelivery is handled;
- a handler that succeeds commits its mark with its writes: the redelivery is skipped, and
  there is no window where one is kept without the other;
- a command the handler sends runs its own `unitOfWork.run` inside that one, so the
  `UnitOfWork` adapter must join the transaction that is open, as the adapters of the kit do;
- the unit of work is resolved at each event, as the command bus resolves it at each command.

This holds for a store whose mark is written in the database of the unit of work. Without a
`UnitOfWork` bound, the mark is taken first and given back with `release` when the handler
fails, for a store that has one; a store without `release` keeps the mark of a failed handler.

### The subscriber of each context

A handler of a context is subscribed on `EventSubscribers.forContext(<module name>)`. By
default every context gets the single `IntegrationEventSubscriber`, which is the in-memory
event bus: one process, one bus, nothing to say.

A broker gives each consuming context its own subscriber, so that the context keeps its queues
when it is extracted. Say it once, in the kernel module or from a later module:

```ts
kernelModule({ eventBus: bus, eventSubscribers: { forContext: (name) => bus.forConsumer(name) } });

builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
```

The name handed to `forContext` is the name of the module: the first argument of
`contextModule` and `discoverContext`, the `name` of `defineContextModule`. An application
without the kernel module needs one of the two bound, `IntegrationEventSubscriber` or
`EventSubscribers`; `EventSubscribers` wins when both are.

## Projections

A projection is a class of `application/projections/`, in a `*.projection.ts` file, declared
with `@Projection('<context>.<name>')`; the README of `@ddd-ts-kit/kernel`
("Projections") says what it may do and why its writes are idempotent and ordered. Here it is
wired: `contextModule` and `discoverContext` find it like any declared class, and an explicit
module takes it with `builder.include(AppointmentListProjection)`.

The CLI knows the role: `application/projections/` is a directory of the canonical tree,
`ddd-ts-kit generate projection <context> <Name> <event-type>` writes one with its spec, the
generated barrel exports it and registers what its constructor takes, and `describe` and the
reference of `CONTEXT.md` list it with the events it applies.

```ts
const app = createTestApplication({ modules: [contextModule('reporting', reporting)] });

await app.start();
await app.eventBus.publish([orderPlaced('evt-1'), orderPlaced('evt-1'), orderPlaced('evt-2')]);

expect(await app.get(CustomerOrders).get('customer-1')).toMatchObject({ orders: 2 });
```

A spec feeds a projection through the in-memory bus and reads the model through its port:
there is nothing else to learn. The fake of a read model port is `InMemoryReadModelStore` of
the kernel, bound by its adapter or given with `fake(Port, store)`.

- **One consumer.** The name of the projection is the consumer name of every event it applies:
  the idempotency scope in `ProcessedEventStore`, the system actor it runs as, the
  `process <projection>` span and, behind a broker, its queue or its group. Two projections of
  the same name are refused (`DUPLICATE_PROJECTION`), and so are two methods of one projection
  applying the same event (`DUPLICATE_CONSUMER`).
- **One unit of work per event.** With `UnitOfWork` and `ProcessedEventStore` bound to the same
  database as the read model, the mark and the row commit or roll back together. Without
  them, the stamp each row carries still makes a redelivery a no-op.
- **Measured.** With `Metrics` bound, `projection_events_total` counts each event by `context`,
  `projection`, `event` and `result` (`applied`, `stale`, `ignored`, `failed`), and
  `projection_last_event_age_ms` holds the age of the last event applied when it was.
- **Described.** `describe().projections` lists each projection with the events it applies and
  the method of each; they do not appear among `integrationEventHandlers` and
  `domainEventHandlers`.

## Behind a broker

Discovery, a broker and a database, with no helper of your own. The complete composition root:

```ts
// main.ts
import { EventSubscribers, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

const bus = new RabbitMqEventBus({ connection: config.amqpUrl });

const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(Database).toValue({ client: knex(config.database) });
    builder.rebind(UnitOfWork).toClass(DatabaseUnitOfWork, [Database]);
    builder.rebind(ProcessedEventStore).toClass(DatabaseProcessedEvents, [Database]);
    builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  },
  onStop: () => bus.close(),
});

const app = createApplication({
  modules: [
    kernelModule({ eventBus: bus }),
    platformModule,
    await discoverContext('ordering', new URL('./contexts/ordering/', import.meta.url)),
    await discoverContext('billing', new URL('./contexts/billing/', import.meta.url)),
  ],
  authorization: 'required',
});

await app.start();
process.on('SIGTERM', () => void app.stop());
```

That is all: `discoverContext('billing', ...)` names the module `billing`, so its integration
event handlers are subscribed on `bus.forConsumer('billing')`, each event handled in the
execution context of the event, its mark and its work in one database transaction. With a
barrel instead of discovery the two lines become `contextModule('ordering', ordering)` and
`contextModule('billing', billing)`, and nothing else changes. `DatabaseUnitOfWork` and
`DatabaseProcessedEvents` stand for the adapters of your persistence package; any bus with a
`forConsumer(name)` fits where `RabbitMqEventBus` is.

## The kernel module

`kernelModule(options?)` binds the ports every context depends on.

| Port | Default | Option |
|---|---|---|
| `Clock` | `SystemClock` | `clock` |
| `IdGenerator` | `UuidGenerator` | `ids` |
| `UnitOfWork` | `InMemoryUnitOfWork` | `unitOfWork` |
| `CommandBus` | `InMemoryCommandBus` running each command in the unit of work: the domain events its saves announce are dispatched once the handler has returned, before the commit, then the `after-commit` handlers run | `commandBus` |
| `QueryBus` | `InMemoryQueryBus` | `queryBus` |
| `EventBus` | `InMemoryEventBus` | `eventBus` |
| `IntegrationEventPublisher` | the event bus | `eventPublisher` |
| `IntegrationEventSubscriber` | the event bus | `eventSubscriber` |
| `EventSubscribers` | the single `IntegrationEventSubscriber`, for every context | `eventSubscribers` |
| `ProcessedEventStore` | `InMemoryProcessedEventStore` | `processedEvents` |
| `ExecutionScope` | `AsyncLocalStorageExecutionScope` | `executionScope` |
| `ActorContext` | `ScopedActorContext`: the actor of the execution scope | `actorContext` |
| `DomainEventDispatcher` | `InMemoryDomainEventDispatcher`, which hears what the save of every repository announced; a failure of an `after-commit` handler goes to the `Logger` and the `ErrorReporter` (`reportAfterCommitFailures`) | `domainEvents` |
| `Logger` | `NoopLogger`. `app.stop()` flushes it last, after the error reporter, and stops all the same when the flush fails | `logger` |
| `Metrics` | `NoopMetrics` | `metrics` |
| `ErrorReporter` | `NoopErrorReporter`. The default buses and the default scheduler hand it their unexpected failures (never a `DomainError`), and `app.stop()` gives it two seconds to flush | `errorReporter` |
| `Cache` | `InMemoryCache` on `Clock` | `cache` |
| `Lock` | `InMemoryLock` on `Clock`: this process only | `lock` |
| `RateLimiter` | `InMemoryRateLimiter` on `Clock`: this process only | `rateLimiter` |
| `JobScheduler` | `InProcessJobScheduler` of `@ddd-ts-kit/scheduling` on `Clock`, `Lock`, `ExecutionScope`, `IdGenerator`, `Logger`, `Metrics` and `ErrorReporter` | `jobScheduler` |

The ports are the abstract classes of `@ddd-ts-kit/kernel`: a handler types a constructor
parameter by `Clock` without importing this package.

An option is an instance or a `(resolve) => instance` factory. An adapter with dependencies of
its own reads better in the module that owns them:

```ts
export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.bind(Database).toFactory(() => ({ client: connect(config.databaseUrl) }));
    builder.rebind(UnitOfWork).toClass(DrizzleUnitOfWork, [Database]);
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]).as('publisher');
  },
});
```

Use cases publish through `IntegrationEventPublisher` and never through `EventBus`, so moving
to an outbox touches no context. A bus given for `CommandBus` or `QueryBus` needs a
`register(type, handler)` method for the declared handlers to be attached to it.

## Scheduled jobs

A class of `application/scheduling/` that carries `@Scheduled` is a job of its context: nothing
else registers it.

```ts
// contexts/billing/application/scheduling/send-reminders.job.ts
import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';

@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

- **Registered when the application is created**, on `JobScheduler`, with the defaults of
  its options filled in. The class is built on its first run, so a job that cannot be built
  fails that run and nothing else.
- **Started by `start()`**, after the modules and once the consumers are subscribed: a job
  sends commands whose events must find their handlers. **Stopped first by `stop()`**, which
  waits for the runs in progress, then aborts them, while everything they use is still up.
- **Each run happens in `ExecutionScope`**, in a context of origin `schedule`, as
  `systemActor('<job name>')`, with a correlation of its own. The scheduler does it, not the
  job.
- **The default scheduler** is the in-process one of `@ddd-ts-kit/scheduling`, on the bound
  `Clock` and `Lock`. With the default lock, which excludes inside one process only, several
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
| `start: false` | the jobs are registered and described, `runNow` runs one, and `start()` never starts the scheduler, nor the worker of a shared queue (a queue in the memory of the process is still consumed): the process that serves requests next to a worker process that runs the jobs |
| `settings['<job name>']` | `enabled`, `schedule` and any option of the declaration (`overlap`, `missed`, `timeoutMs`, `jitterMs`, `singleInstance`), which win over what the class wrote. A key left undefined changes nothing |

`app.resolve(JobScheduler)` is the port: `runNow(name)` for an operations endpoint,
`describe()` for the next run and the last outcome of each job. A context extracted as its own
service takes its jobs with it: they belong to its module, and nothing is global.

## Background jobs

A class of `application/background/` that carries `@Background` is a background job of its
context, named by its static `jobName`:

```ts
// contexts/billing/application/background/compile-statements.background-job.ts
@Background({ maxAttempts: 3, timeout: '10m' })
export class CompileStatementsBackgroundJob implements BackgroundJob<CompileStatementsPayload> {
  static readonly jobName = 'billing.compile-statements';

  constructor(private readonly commands: CommandBus) {}

  async run(payload: CompileStatementsPayload, execution: BackgroundJobExecution): Promise<void> {
    await this.commands.execute(new CompileStatements(execution.jobId, payload.month));
  }
}
```

An explicit module writes `builder.backgroundJob('billing.compile-statements', { maxAttempts: 3 })
.handledBy(CompileStatementsBackgroundJob, [CommandBus])`; a name other than the `jobName` of the class is
refused (`INVALID_JOB_SETTINGS`), a name declared twice too (`DUPLICATE_JOB`).

- **Registered when the application is created** on the `QueueWorker` of `@ddd-ts-kit/scheduling`,
  which then consumes the queue of the context. The class is built on its first attempt.
- **Consumed while the process runs the jobs**: `start()` starts the worker after the scheduler
  when `jobs.start` is not `false`, `stop()` stops it with the scheduler, waiting for the
  attempts in progress, then aborting them. A process started with `jobs: { start: false }`
  enqueues and leaves the shared queue to the worker; a queue kept in its own memory
  (`InMemoryJobStore`, the default) is still consumed, since no other process sees it.
- **`kernelModule()`** binds `JobStore` (in memory by default: bind `KnexJobStore`,
  `DrizzleJobStore` or `RedisJobStore` with `jobStore`, or no job reaches a worker of another
  process), `JobQueue` (a `StoredJobQueue` on it, which stores the `traceparent` given by the
  instrumentation) and `QueueWorker` (tuned by `queues: { concurrency, pollIntervalMs, graceMs }`,
  failures to the `ErrorReporter`).
- **`describe().backgroundJobs`** lists each job, its queue and its options, defaults filled in.

`kernelModule()` also binds `ProcessStore` (in memory by default: bind `KnexProcessStore` or
`DrizzleProcessStore` with `processStore`) and `ProcessRunner`, the runner of
`@ddd-ts-kit/scheduling` on it, the `JobQueue`, the `CommandBus` and the `UnitOfWork`: the
handlers that drive a process manager depend on `ProcessRunner`, and its timeout job is a
background job of the context. In a test application, `app.processes.list()` shows the instances.

In a test application, `app.jobQueue` is the queue the use cases enqueue on, in memory, and
`app.backgroundJobs.runDue()` runs what is due on `app.clock` and throws what an attempt threw;
`app.backgroundJobs.store.list()` shows what was enqueued. What the jobs guarantee:
[Background jobs](../../docs/concepts/background-jobs.md).

## Tests

A declared context is tested like an explicit one: the module is the unit, the fakes replace
its adapters.

```ts
const app = createTestApplication({
  modules: [contextModule('billing', billing)],
  fakes: [fake(PaymentGateway, new InMemoryPayments())],
});
```

`fake(Port, value)` is checked: the value implements the port. An in-memory class, an object
literal and a class written in the spec all fit, since a port is a shape.

`createTestApplication({ modules, fakes, now?, idPrefix?, actor?, session?, executionContext?, jobs? })` puts the modules on a deterministic
kernel, whether or not they list `kernelModule()`, and returns the application plus what a
spec touches:

| Member | Is |
|---|---|
| `commandBus`, `queryBus` | the in-memory buses, with every declared handler |
| `eventBus` | `InMemoryEventBus`; `eventBus.published` lists what the use cases announced. Every context listens on it, whatever `EventSubscribers` the modules bind |
| `domainEvents` | `InMemoryDomainEventDispatcher`: the save of every repository, adapter or fake, announces to it, with the timing of the application (at the end of the command, then after it for `after-commit` handlers); a spec may dispatch a domain event itself to see the declared handlers react, and `domainEvents.afterCommitFailures` holds what `after-commit` handlers threw |
| `clock` | `FixedClock` at `now` (default `2026-01-01T00:00:00.000Z`); `clock.advance(ms)` |
| `ids` | `SequentialIdGenerator`: `id-1`, `id-2`... |
| `actorContext` | `FixedActorContext`; `actAs(actor)` changes who infrastructure sees |
| `executionScope` | `FixedExecutionScope` (correlation `test-correlation`, origin `test`), following `actorContext` |
| `logger`, `metrics` | `InMemoryLogger` and `InMemoryMetrics`: assert `logger.entries`, `metrics.samples` |
| `errors` | `InMemoryErrorReporter`: `errors.reports` lists the unexpected failures of the commands, queries and jobs, as data |
| `cache` | `InMemoryCache` on `clock` |
| `lock`, `rateLimiter` | `InMemoryLock` and `InMemoryRateLimiter` on `clock` |
| `jobs` | `runNow(name)` runs a declared job as the scheduler would and throws what it threw; `scheduler` is a `ManualJobScheduler` on `clock`, not started |
| `get(Port)` | `resolve`, typed by the port |
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

A fake must stand for a port that a module binds or that a class depends on, otherwise
`UNKNOWN_FAKE` is raised: a fake for the wrong port would silently leave the real adapter in
place. Consumers receive events once `await app.start()` ran.

`createApplication({ overrides: [override(Port, value)] })` is the same pair without that
check, and `overrideForTests(app, Port, value)` swaps a binding on an existing application;
call it before the first `resolve`, since a singleton already built keeps what it was given. An
override replaces the binding, may stand in for a module that is not loaded, and is not
decorated. Every application owns a tsyringe child container (`app.container`), so two tests
never share instances.

## Checks

`createApplication` throws a `WiringError` (with a `code`) before anything is instantiated:

- `DUPLICATE_BINDING`: a port bound twice, or a class given to two statements or listed in two
  modules, both modules named;
- `NOTHING_TO_REBIND`: a `rebind` of a port that no earlier module binds;
- `INVALID_PORT`: a class bound to a port that carries a body, or that it extends;
- `UNBOUND_DEPENDENCY`: a class dependency that no module binds, or handlers, consumers and
  jobs declared without the bus, the subscriber or the scheduler they go on;
- `DEPENDENCY_CYCLE`: a cycle between class bindings, the path printed;
- `INCOMPLETE_BINDING`: a `bind`, `command`, `query`, `on` or `job` left without its target;
- `DUPLICATE_HANDLER`: a command or a query with two handlers, both modules named;
- `DUPLICATE_CONSUMER`: two consumers of the same event sharing a name;
- `DUPLICATE_PROJECTION`: two projections sharing a name;
- `BUS_WITHOUT_REGISTER`: handlers declared for a bus that cannot receive them;
- `UNKNOWN_FAKE`: see above;
- `UNDECLARED_CLASS`: a class listed in `contextModule` or `include` without a declaration;
- `MISSING_DEPENDENCIES`: a declared class whose constructor takes parameters and that no list
  covers: its decorator names none and no generated file that was loaded registered one;
- `DEPENDENCY_ARITY`: a list of another length than the constructor it is for;
- `DUPLICATE_JOB`: two jobs sharing a name, both modules named: the name is the lock, the
  actor and the label of a job;
- `UNKNOWN_JOB`: settings given for a job that no module declares;
- `INVALID_JOB_SETTINGS`: a schedule or an option of the settings that cannot be read (a cron,
  a time zone, a zero interval), or a job of an explicit module whose name or schedule cannot.

`DUPLICATE_HANDLER`, `DUPLICATE_CONSUMER` and `DUPLICATE_JOB` are reported before the
`DUPLICATE_BINDING` of the class they share, so the message says what the mistake is.

The checks do not tell the two styles apart. For a declared class the message names the class
and, when discovery loaded it, the file:

```
Token "InvoiceRepository" is bound twice: by module "billing" (declared by class
KnexInvoiceRepository in /app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js)
and by module "invoicing" (declared by class InMemoryInvoiceRepository).
```

Factories do not declare what they resolve, so a cycle or a missing port going through a
factory is reported when it is resolved (`DEPENDENCY_CYCLE`, `UNBOUND_TOKEN`).

## Diagnostics

`app.describe()` returns the wiring as plain, serializable data: ports and classes by name.

```ts
{
  modules: ['kernel', 'ordering'],
  bindings: [{ token: 'PlaceOrderHandler', module: 'ordering', kind: 'use-case', lifetime: 'singleton',
               source: 'class', implementation: 'PlaceOrderHandler',
               dependencies: ['OrderRepository', 'Clock'], overridden: false }],
  commands: [{ message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' }],
  queries: [{ message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' }],
  integrationEventHandlers: [{ event: 'billing.payment.captured', version: 1, consumer: 'ordering.mark-order-paid',
                               handler: 'MarkOrderPaidOnPaymentCaptured', module: 'ordering' }],
  domainEventHandlers: [],
  policies: [],
  jobs: [{ name: 'ordering.expire-carts', schedule: 'every 15m', overlap: 'skip', missed: 'skip', jitterMs: 0,
           enabled: true, singleInstance: true, job: 'ExpireCartsJob', module: 'ordering' }],
  projections: [{ name: 'ordering.order-list', projection: 'OrderListProjection', module: 'ordering',
                  applies: [{ kind: 'integration', event: 'billing.payment.captured', version: 1, method: 'paid' }] }],
  overrides: [],
}
```

An entry that comes from a declaration also carries `origin: 'declared'`, `declaredBy` (the
class) and, when discovery loaded it, `file`. An entry written in a module is `explicit` and
carries none of the three:

```ts
{ token: 'InvoiceRepository', module: 'billing', kind: 'repository', lifetime: 'singleton',
  source: 'class', implementation: 'KnexInvoiceRepository', dependencies: ['Database'],
  overridden: false, origin: 'declared', declaredBy: 'KnexInvoiceRepository',
  file: '/app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js' }
```

`domainEventHandlers` lists the declared handlers of domain events, publishers included, each
with its `phase` (`before-commit` or `after-commit`),
`policies` the declared policy classes, `jobs` the jobs with the settings they run with, those
of the application applied. What a job did last and when it runs next is not wiring: ask
`app.resolve(JobScheduler).describe()`.

## Domain events and the unit of work

An effect of a domain event exists only if the state change that recorded it is committed.

A handler writes `await this.orders.save(order); return order.id;` and nothing else: no
`pullEvents()`, no `DomainEventDispatcher` in a use case. `kernelModule()` puts
`dispatchingOnSave` of the kernel around every binding of kind `repository`, in every module:
declared with `@Repository`, bound `.as('repository')`, or bound under a port that extends the
kernel `Repository` (which is a repository whether the module says so or not). A repository
adapter contains no dispatch code. The save only hands the events over; the unit of work of the
command dispatches them at its end.

| Question | Answer |
|---|---|
| Which methods | Every method of the repository that is handed an aggregate, or an array of them, and resolves: `save(order)`, `saveAll([a, b])`, `remove(order)`. A method that is handed no aggregate (`findById`, `remove(id)`) announces nothing: a removal that announces an event takes the aggregate |
| Which events, in which order | Those the aggregates of the call recorded, pulled once the call resolved: in the order of the arguments, then of recording, and across the saves of the command in the order of the saves |
| When | Once the command handler has returned, inside the transaction, before the commit: the default command bus runs the handler in `UnitOfWork.run`, and a save only queues. Every handler sees every save of the command. What the domain event handlers write, the outbox included, commits or rolls back with the state |
| After the commit | Handlers declared `phase: 'after-commit'` run once the transaction has committed, never when it rolled back, in the order the events were dispatched, awaited before the command answers. At most once: a crash between the commit and the run loses them |
| A `before-commit` handler fails | The command fails with what it threw and the unit of work rolls back. The events still waiting are dropped, no `after-commit` handler runs, and the aggregate instances have given their events: do not save them again, a retry reloads them |
| An `after-commit` handler fails | The command still succeeds. The failure is logged (`Logger.error`, "A domain event handler failed after the commit", with `domainEvent`, `errorType`, `errorCode`) and handed to the `ErrorReporter` under the operation `after-commit <event name>`; the other handlers still run |
| The save fails | Nothing is pulled: the events stay on the aggregate. The command fails, and the events queued by earlier saves are dropped |
| The command handler throws after a save, or the commit fails | The queued events are dropped: no handler of either phase for a handler that threw, no `after-commit` handler for a commit that failed; nothing stored, no outbox row |
| A handler saves another aggregate | Before the commit: its events wait behind the ones already queued and are dispatched in recording order, without recursion. After the commit: refused before the write with `SaveAfterCommitError`; send a command through the `CommandBus` instead |
| A handler sends a command | Before the commit, that command joins the unit of work in progress: one dispatch, at the end of the outermost, one commit. After the commit, it is a unit of work of its own |
| The same aggregate saved twice | The second save announces what was recorded since the first, which may be nothing |
| A save outside of any unit of work | Dispatches before it resolves, `before-commit` handlers then `after-commit` ones. Nothing is atomic then: the state is written, the handlers run, and a handler that fails rejects the save without undoing it |
| An adapter that pulls the events itself | Leaves nothing to dispatch: no double dispatch, and no dispatch at all unless the adapter does it. An adapter never calls `pullEvents()` |
| Order of the wrappers | Outermost first: the `decorate` hook, the instrumentation (the span of the save), the hand-over of the events, the aspects other modules put around the kind (`builder.around`), the aspects of the binding (`.with(retry(...))`). A retried save announces once |

A `before-commit` handler may only have effects the transaction covers, because the commit can
still fail after it ran: `domain-events/transactional-before-commit` holds it. An effect outside
the database is an `after-commit` handler when it may be lost, an integration event through the
outbox when it must not:

```ts
@DomainEventHandler(InvoiceIssued, { name: InvoiceIssued.eventName, phase: 'after-commit' })
export class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {
  constructor(private readonly cache: Cache) {}

  async handle(event: InvoiceIssued): Promise<void> {
    await this.cache.delete(cacheKey<InvoiceSummary>('invoice-summary', event.aggregateId));
  }
}
```

A `UnitOfWork` given through `kernelModule({ unitOfWork })` gets this timing for commands
whatever it is made of: the default command bus puts `withinUnitOfWork` of the kernel around
it. Built on `withinUnitOfWork` itself, as the ORM packages are, it gives the same timing to a
`run` called directly, the one of a consumer included.

In a test application, the adapter of a module and the fake given for a repository port both
announce to `app.domainEvents`, whether `kernelModule()` is listed or not. Without a container,
`dispatchingOnSave(repository, () => dispatcher)` of the kernel is the same wrapper, and
`createTestBuses().dispatching(fake)` of `@ddd-ts-kit/testing` applies it to a fake.

A module puts an aspect of its own around every binding of some kinds with
`builder.around(kinds, (resolve) => aspect)`: outside the aspects of each binding, inside the
`decorate` hook, the first declared outermost.

## Observing the application

`kernelModule({ instrumentation })` takes what observes the application from outside: an object
whose members are wrappers, each optional, applied where the thing is built.

| Member | Wraps |
|---|---|
| `binding` | every instance of a binding declared with a kind, outside the dispatch of domain events |
| `useCase` | a bus middleware, on both default buses, after the use case guard and outside the unit of work; it reads `info.context`, the module of the handler |
| `publisher` | the `IntegrationEventPublisher` |
| `consumer` | what each declared consumer is subscribed with, told its consumer name, its module and its event type |
| `domainEvents` | the `DomainEventDispatcher` |
| `job` | each run of a declared job, inside its execution scope, told the job name and its module |
| `errorReporter` | the `ErrorReporter` |
| `executionScope` | told the `ExecutionScope` once it is built |

`traceApplication()` of `@ddd-ts-kit/tracing` is such an object, and makes one readable trace
per action; this package depends on no tracing library. A port given through an option of
`kernelModule` is wrapped too; one rebound by a later module is not.

## The `decorate` hook

`createApplication({ decorate })` receives every instance a binding creates, handlers and
consumers included, with `{ token, context, kind? }` where `token` is the port class, and
returns the instance to hand out. It is the place for cross-cutting wrappers of a project.
Tracing comes through `kernelModule({ instrumentation })` instead, see "Observing the
application".

One binding takes its own wrappers with `.with(...)`, the first outermost:

```ts
builder.bind(PaymentGateway).toClass(HttpPaymentGateway, [PaymentSettings]).as('external').with(retry({ attempts: 3 }), timeout(2000));
```

A `BindingAspect` is `(instance, { kind?, className, context, token }) => instance`, where
`token` is the name of the port; the aspects of `@ddd-ts-kit/aspects` fit as they are, and its
`aspects(...)` builds a `decorate` hook. The `decorate` hook comes around the aspects of a
binding.

## The tsyringe container

`app.container` is the tsyringe child container of the application, for interoperability. A
port is registered there under `tokenIdentity(port)`, a symbol, never under the class: tsyringe
would try to build a class it is asked for, and an abstract class is not one of its tokens.

```ts
import { tokenIdentity } from '@ddd-ts-kit/di';

app.container.isRegistered(tokenIdentity(Clock));          // true
app.container.resolve<Clock>(tokenIdentity(Clock));        // what app.resolve(Clock) answers
app.container.isRegistered(PlaceOrderHandler);             // false: bound under its identity too
```

`app.resolve(Port)` is the typed way in, and the one that reports a cycle or an unbound port
with the names of who asked.

## Access control

A use case says what it requires, or says it is public: on the message itself with
`@Requires(permission)` or `@Public()`, or where it is registered:

```ts
builder.command(IssueInvoice).requires(permissions['invoice.issue']).handledBy(IssueInvoiceHandler, [InvoiceRepository, Clock]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [Catalog]);
```

`.requires` exists only for messages that carry an actor (`AuthorizedCommand`,
`AuthorizedQuery` of the kernel). With `createApplication({ modules, authorization: 'required' })`
an application whose command or query declares neither, in either way, does not start
(`UNDECLARED_AUTHORIZATION`), and one that declares them without a module enforcing them does
not either (`AUTHORIZATION_NOT_ENFORCED`).

Three classes of this package carry it:

| Class | Is |
|---|---|
| `UseCaseGuard` | the port both buses ask before anything else, the unit of work included: `check(message, next, info)`. Unbound, every message passes; an authorization module binds it |
| `UseCaseDeclarations` | a value, `{ list }`: what every command and query declared, for whoever enforces it |
| `DeclaredPolicies` | a value, `{ list }`: the `@Policy` classes of the contexts, each resolved by its class |

The enforcement itself and the authorizers live in `@ddd-ts-kit/auth` (`authorizationModule`
from `@ddd-ts-kit/auth/di`). `ActorContext` is bound by `kernelModule()`; the test application
takes an `actor` option, and lets every message through unless a listed module binds
`UseCaseGuard`.

## Limits

- A class plays one role: one declaration per class, and an adapter that implements two ports
  is bound explicitly, once per port.
- A class is one binding: a handler class serves one statement, a declared class one module.
- A class decorator of another library that replaces the class (answers a new one) must be
  written below the declaration, so that the declaration lands on the class that is exported.
  A decorator that only annotates, as `@Injectable()` does, composes in either order.
- A declaration is not inherited: a subclass declares itself or is bound explicitly.
- What a constructor takes reaches the container through a generated file, never through
  compiler metadata: a declared class edited where nothing regenerates that file (`docs`,
  `generate`, the `dev` script) is refused at composition time until it is.
- A class that inherits its constructor has a `length` of zero, so a missing list for it
  cannot be seen at run time: `declarations/constructor-injection` of `ddd-ts-kit check`
  reads the base class of the project, and refuses one it cannot read.
- A consumer name, a policy name, a job name and the name of a domain event are written in the
  declaration; they are not derived from the class, which a refactoring renames.
- A port of your own is identified by its class: see "Identity" for a port loaded twice.
- Discovered files are imported by nothing. In a project using discovery, tell knip that they
  are entries and dependency-cruiser that they are not orphans:

  ```jsonc
  // knip.json
  { "entry": ["src/main.ts", "src/contexts/*/{application,infrastructure}/**/*.{command,query,handler,integration-handler,publisher,event-handler,policy,job,projection,repository,gateway,adapter}.ts", "src/contexts/*/*.dependencies.ts"] }
  ```

  ```js
  // .dependency-cruiser.cjs, in the pathNot of the no-orphans rule
  '\\.(command|query|handler|integration-handler|publisher|event-handler|policy|job|projection|repository|gateway|adapter|dependencies)\\.ts$'
  ```

  With a barrel and `contextModule` neither setting is needed.
