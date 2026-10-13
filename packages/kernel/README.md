**English** · [Français](README.fr.md)

# @ddd-ts-kit/kernel

The building blocks every context depends on, and nothing else: no framework, no ORM, no
logger, no dependency at all. `domain/` and `application/` may import it; it is the only package
of the kit they may import.

```
npm i @ddd-ts-kit/kernel
```

## What is inside

| Area | Exports |
|---|---|
| Domain | `Entity`, `AggregateRoot` (version, recorded events), `ValueObject`, `DomainEvent`, `DomainError` with a stable `code`, `ConceptError` (the errors of one concept, each built by a static factory: see "Domain errors"), `isRefusal`, `CodeOf`, `RefusalOf`, `Refusal`, `RefusalFacts`, the generic `InvariantViolation`, `NotFoundError`, `ConflictError`, `ConcurrencyError`, `PreconditionFailedError`, `Result` with `ok`, `err`, `unwrap` |
| Ports | `Clock`, `IdGenerator`, `UnitOfWork`, `Repository` (abstract classes: each one is its own injection token), `UseCase`, `DependencyKind` (the roles a binding declares, read by di, tracing and aspects: `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`, `domain-event-handler`, `job`) |
| Buses | `Command`, `Query`, `CommandBus`, `QueryBus`, `BusMiddleware`, the in-process `InMemoryCommandBus` and `InMemoryQueryBus` (`register(type, handler, { context })` names the bounded context in `MessageInfo`), `unitOfWorkMiddleware` |
| Events | `IntegrationEvent`, `IntegrationEventPublisher`, `IntegrationEventSubscriber`, `EventBus` (both at once), `EventSubscribers` (the subscriber of each bounded context), `ProcessedEventStore`, `idempotent`, `InMemoryEventBus`, `DomainEventDispatcher`, `IntegrationEventCallback` and `DomainEventCallback` (the functions a subscriber and a dispatcher are given), `executionContextOfEvent`, `inEventScope`, `scopedPublisher`, `EventDelivery` (what a provider says of one delivery: attempt, last attempt, transport, source, consumer), `messagingSystemOf` |
| Domain events and the unit of work | `dispatchingOnSave` (the wrapper that makes a repository hand over what the aggregates it is given recorded), `announceDomainEvents`, `withinUnitOfWork` (what every `UnitOfWork.run` is built on: queue, dispatch before the commit, `after-commit` phase), `unitOfWorkStage` and `UnitOfWorkStage`, `DomainEventPhase`, `DomainEventSubscription`, `SaveAfterCommitError`, `AfterCommitFailure`, `reportAfterCommitFailures`, `InMemoryDomainEventDispatcher` |
| Actor | `Actor`, `AuthorizedCommand`, `AuthorizedQuery`, `ActorContext` |
| Standard interfaces | `Session`, `ExecutionContext` and `ExecutionScope`, `Logger`, `Metrics`, `ErrorReporter`, `Cache`, `CacheInvalidation` and `CachePurger` (with `cacheTag`, `tenantCacheTags`, `CachePurgeRequest`, `PublishedCacheInvalidation`, `PurgingPublisher`, `RepeatedCachePurger`: see "Purging the HTTP caches"), `Lock`, `RateLimiter`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped`, `AuditTrail`, `AuditReader` and `AuditEntry` |
| Scheduled jobs | `JobScheduler`, `ScheduledJob`, `JobExecution`, `JobSchedule`, `JobOptions`, `JobDefinition`, `JobRun`, `JobDescription`, `parseJobSchedule`, `describeJobSchedule`, `jobPolicy`, `executionContextOfJob` |
| Read side | `Criteria`, `defineCriteria`, `validateCriteria`, `scoped`, `planCriteria`, `evaluateCriteria`, `pageOfPlan`, `hydrate`, `ReadModelStore`, `stampOf`, `TableReadModelStore`, `ProjectionRebuild`, `InMemoryReadModelStore` (see "Criteria", "Hydration" and "Projections") |
| Persistence helpers | `optimisticUpdate`, `expectVersion` (the version a caller read, `If-Match` over HTTP, still the current one, else `PreconditionFailedError`: 412), `schemaNameOf`, `stampCreation`, `stampUpdate`, `tenantScopeOf`, `encodeCursor`, `decodeCursor` |
| Error reporting | `ErrorReporter`, `ErrorReport`, `errorReportOf`, `reportOnce`, `isUnexpectedError`, `errorReportingMiddleware`, `DeadLetterReports`, `reportProcessFailures`, `NoopErrorReporter` |
| Doubles | `FixedClock`, `SequentialIdGenerator`, `InMemoryUnitOfWork`, `FixedActorContext`, `FixedExecutionScope`, `InMemoryLogger`, `InMemoryMetrics`, `InMemoryErrorReporter`, `InMemoryCache`, `InMemoryCacheInvalidation`, `InMemoryCachePurger`, `InMemoryLock`, `InMemoryRateLimiter` |
| Declarations (`@ddd-ts-kit/kernel/declarations`) | `Requires`, `Public`, `CommandHandler`, `QueryHandler`, `IntegrationEventHandler`, `DomainEventHandler`, `Scheduled`, `Projection`, `On`, `Repository`, `Gateway`, `Adapter`, `Policy`, `injected`, `injectedDependencies`, `declarationOf`, `listDeclarations`, `Token`, `describeToken`, `tokenIdentity`, `portDefect` |

The rules these blocks serve are in `docs/ARCHITECTURE.md`.

## Domain errors

A business refusal is a `DomainError`: an answer the code planned for, known everywhere by its
`code`. A context has one error class per concept of its language, and each refusal is a static
factory of that class, named in the words of the business:

<!-- checked sample -->
```ts
import { ConceptError } from '@ddd-ts-kit/kernel';

declare const calendar: { readonly id: string };
declare const slot: { readonly startsAt: Date };

export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }

  static notFound(appointmentId: string) {
    return AppointmentError.refusal('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} does not exist.`, {
      appointmentId,
    });
  }
}

throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

| Member | What it does |
|---|---|
| `protected static refusal(code, message, facts?)` | builds the refusal of a factory: an instance of the class it is called on, typed with that code and those facts. The constructor is protected and a subclass declares none, so outside its class a refusal exists only through a factory |
| `protected exposing(...names)` | called on the refusal by its factory: these facts may leave the process. None does by default |
| `protected causedBy(cause)` | called by its factory: the error this refusal translates, as `cause` |
| `code`, `message`, `name`, `cause` | as on any `DomainError`; `name` is the class, `code` the identity of the refusal |
| `facts` | every fact the factory was given, as plain data (`RefusalFacts`: text, numbers, booleans, dates, `null`, lists of them), for the code that catches the error and for the tests |
| `exposedFacts` | the facts a client may read: what `@ddd-ts-kit/http` writes under `facts` in the problem document |
| `toJSON()` | `{ name, code, message }`, plus `facts` when some are exposed: never the stack, the cause or a private fact |
| `static is(error, code?)` | narrows what was caught to a refusal of this class, of this code when one is given |

The codes of a class are a closed vocabulary the compiler derives from its factories, so a
`switch` is exhaustive and each case knows its facts:

```ts
import { isRefusal, type CodeOf } from '@ddd-ts-kit/kernel';

type AppointmentErrorCode = CodeOf<typeof AppointmentError>; // 'SLOT_TAKEN' | 'APPOINTMENT_NOT_FOUND'

if (AppointmentError.is(error)) {
  switch (error.code) {
    case 'SLOT_TAKEN':
      return retryAfter(error.facts.startsAt); // a Date
    case 'APPOINTMENT_NOT_FOUND':
      return forget(error.facts.appointmentId);
  }
}

if (AppointmentError.is(error, 'SLOT_TAKEN')) {
  error.facts.calendarId; // a string
}

isRefusal(error, 'SLOT_TAKEN'); // whatever the class: the code is what everything downstream keys on
```

`error instanceof AppointmentError && error.code === 'SLOT_TAKEN'` works too, without the facts
of that code. A factory lets its return type be inferred: an annotation `: AppointmentError`
would hide its code from `CodeOf`.

**Facts are private.** A message is written for a human and answered to the client as `detail`;
the facts are data, and stay in the process unless the factory names the ones that may leave.
Never expose what identifies a person. The audit trail and the spans record the code alone.

**One class per error** is the form of 0.1 and 0.2, and keeps working: `DomainError` is still
abstract over `code`, its constructor still public, and `InvariantViolation`, `NotFoundError`,
`ConflictError` and `ConcurrencyError`, each one refusal under a fixed code, are still built
with `new`.

```ts
export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';
}
```

A project says which form it writes with `"stack.refusals"` in `ddd-ts-kit.config.json`
(`factories`, what `init` writes, or `classes`, what a config without the key means); the
`errors/*` rules hold the first, and `ddd-ts-kit error-factories` moves a project from the
second. Both forms can live in one project.

## State machines

```ts
export const parcelLifecycle = defineStateMachine({
  states: Object.values(ParcelStatus),
  initial: [ParcelStatus.Registered],
  transitions: {
    ship: { from: [ParcelStatus.Registered], to: ParcelStatus.Shipped, guard: ({ paid }) => (paid ? undefined : ParcelError.unpaid()) },
    reroute: { from: [ParcelStatus.Shipped] },
    deliver: { from: [ParcelStatus.Shipped], to: ParcelStatus.Delivered },
  },
  refused: ({ from, transition }) => ParcelError.cannot(from, transition),
});

this.state = { ...this.state, status: parcelLifecycle.next(this.state.status, 'ship', { paid }) };
```

The lifecycle of an aggregate, in `domain/state-machines/<aggregate>.state-machine.ts`.
`next(from, transition, context)` answers the next status or throws: the refusal `refused` builds
from a static factory for a transition the state does not allow, or the refusal of a guard.
`start(state)` checks an initial state, `can(...)` answers without throwing, `allowedFrom(state)`
and `isFinal(state)` read the graph, `describe()` gives it as data and
`mermaidOfStateMachine(description)` as a Mermaid diagram. A transition without `to` keeps the
state. A declaration naming an unknown state throws `InvalidStateMachineError` when the file
loads. Why, and the rule that holds the aggregate to it:
[State machines](../../docs/concepts/state-machines.md).

## Domain events and the unit of work

An effect of a domain event exists only if the state change that recorded it is committed.

An aggregate records its events; nothing in a use case hands them over. A repository wrapped
by `dispatchingOnSave(repository, () => dispatcher)` pulls them itself, once a method that was
handed the aggregate has resolved:

```ts
const orders = dispatchingOnSave(new KnexOrderRepository(db), () => dispatcher);

await unitOfWork.run(async () => {
  await orders.save(order);            // persisted; the events `order` recorded are queued
  await orders.saveAll([first, second]);
  await orders.remove(order);          // a "deleted" event is queued with the removal
});                                    // dispatched here, in recording order, before the commit
```

`kernelModule()` of `@ddd-ts-kit/di` applies it to every binding of kind `repository`, so an
application never writes this line; the table of what it guarantees (ordering, re-entrancy,
failures, wrapper order) is in the README of that package. In short:

- Inside a unit of work a save only queues, in recording order across all the saves. Once the
  work has returned, still inside the transaction, the queue is dispatched: every handler sees
  every save. Events recorded by handlers that save wait behind the others, in the same order,
  without recursion. Then the transaction commits.
- The events are pulled only when the call succeeded. The first `before-commit` handler that
  fails rejects the unit of work; so does the work, a later save or the commit. The queued
  events are then dropped and never put back on the aggregates: a retry reloads them.
- Outside any unit of work the save dispatches before it resolves, `before-commit` handlers
  then `after-commit` ones.

`pullEvents()` stays public for this wrapper and for the specs of an aggregate; a use case and
a repository adapter never call it. An aggregate is recognised by what it does (it has
`pullEvents`), so a context compiled against another copy of the kernel is followed too.

### Two phases

| Phase | Declared | Runs | A failure |
|---|---|---|---|
| `before-commit` (default) | `dispatcher.on(name, callback)` | at the end of the unit of work, inside its transaction | fails the command; everything rolls back |
| `after-commit` | `dispatcher.on(name, callback, { phase: 'after-commit' })` | once the transaction has committed, never when it rolled back, in dispatch order, awaited before the command answers | never fails the command: reported, and the other handlers still run |

With declarations the phase is an option of the decorator:
`@DomainEventHandler(OrderPaid, { name: OrderPaid.eventName, phase: 'after-commit' })`.

The `after-commit` phase is at most once: a crash between the commit and the run loses it. What
must not be lost goes through the outbox as an integration event. A `before-commit` handler
may only have effects the transaction covers, because the commit can still fail after it ran
(`domain-events/transactional-before-commit`).

`DomainEventDispatcher.dispatch(events, phase?)` runs the handlers of one phase,
`before-commit` by default. `InMemoryDomainEventDispatcher(failed?)` is told each failure of an
`after-commit` handler and keeps the last hundred in `afterCommitFailures`, for specs.
`reportAfterCommitFailures({ reporter, logger, scope? })` is the `failed` to give it wherever a
logger and an error reporter exist: one `Logger.error` entry ("A domain event handler failed
after the commit", with `domainEvent`, `errorType`, `errorCode`) and the error handed to the
`ErrorReporter` under the operation `after-commit <event name>`.

An `after-commit` handler that hands an aggregate to a wrapped repository (`save`, `saveAll`,
`remove(aggregate)`) is refused before the write with `SaveAfterCommitError`: the unit of work
is over. It sends a command through the `CommandBus`, which opens a unit of work of its own.
`unitOfWorkStage()` answers `'outside'`, `'open'`, `'before-commit'` or `'after-commit'`.

### A unit of work of your own

The queue lives in an `AsyncLocalStorage` scope opened by `withinUnitOfWork(work, transaction)`.
`InMemoryUnitOfWork` and the units of work of the ORM packages are built on it, so a `run`
called directly (a consumer, a script) has the timing of a command. `unitOfWorkMiddleware`
calls it too: a command is covered even with a `UnitOfWork` that does not. A nested `run`, or a
command sent from inside a unit of work, joins the scope in progress: one dispatch, at the end
of the outermost, and the `after-commit` phase after the outermost commit. Two concurrent
commands never share a scope.

A `UnitOfWork` written in a project builds `run` on it. `transaction` begins, calls what it is
given, commits when it resolved and rolls back when it rejected:

```ts
run<T>(work: () => Promise<T>): Promise<T> {
  return withinUnitOfWork(work, (scoped) => {
    if (this.current.getStore() !== undefined) { // nested: join the transaction
      return scoped();
    }

    return this.database.transaction((transaction) => this.current.run(transaction, scoped));
  });
}
```

`unitOfWorkContract` of `@ddd-ts-kit/testing/contracts` fails an adapter that forgot.

## Declarations

A class says what it is, and the composition root is assembled from what the classes say.
`@ddd-ts-kit/kernel/declarations` holds the decorators that record it. They are pure metadata:
a declaration instantiates nothing, resolves nothing, reads no configuration and knows no
container. That is why they live here, where the application layer may import them. Turning
declarations into bindings is the job of `@ddd-ts-kit/di` (`contextModule`,
`discoverContext`), and of nothing else.

```ts
// contexts/ordering/domain/repositories/order.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';
import type { Order } from '@/contexts/ordering/domain/aggregates/order.aggregate';

export abstract class OrderRepository extends Repository<Order> {
  abstract findOpenOf(customerId: string): Promise<readonly Order[]>;
}
```

```ts
// contexts/ordering/application/commands/place-order/place-order.handler.ts
import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderRepository } from '@/contexts/ordering/domain/repositories/order.repository';
import { PlaceOrder } from '@/contexts/ordering/application/commands/place-order/place-order.command';

@CommandHandler(PlaceOrder)
export class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrder): Promise<string> { /* ... */ }
}
```

```ts
// contexts/ordering/infrastructure/persistence/knex-order.repository.ts
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { Database } from '@/contexts/ordering/application/ports/database.port';
import { OrderRepository } from '@/contexts/ordering/domain/repositories/order.repository';

@Repository(OrderRepository)
export class KnexOrderRepository implements OrderRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  /* findById, save, findOpenOf */
}
```

`Repository` is two things under one name, each in its entry: the abstract class a repository
port extends (main entry, imported by the port) and the decorator of its adapter (this entry,
imported by the adapter). No file needs both.

### Ports and tokens

**A port is an abstract class, and the class is the injection token.** The class names the
dependency and carries its type: a constructor parameter typed by it names what is injected, and
`app.resolve(Clock)` answers a `Clock`. `Token<T>` is that type: `abstract new (...args: never) => T`.
There is no token constant and no token file. A port has one place, one abstract class per file:

| Port | File |
|---|---|
| a repository of the domain | `domain/repositories/*.repository.ts` |
| any other port, and a value class | `application/ports/*.port.ts` |

```ts
// contexts/ordering/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(orderId: string, amount: Money): Promise<PaymentReceipt>;
}
```

**The port rule.** A port has abstract members only: no body, no constructor parameter, no
private or protected member. A port may extend another port. An adapter `implements` its port
and never `extends` it. The type stays structural, so a fake, an in-memory class or a plain
object literal stands for a port without ceremony.

**`Repository<A, Id>`** is the contract every repository shares (`findById`, `save`), as an
abstract class. The repository port of an aggregate extends it and adds its own finders, as
`OrderRepository` above; the adapter implements that port.

**A value that is no port** (a configuration object, a database handle, a list, a primitive)
is typed by an abstract class too, with `abstract readonly` properties, and a plain object is
bound to it with `toValue` of `@ddd-ts-kit/di`:

```ts
// contexts/ordering/application/ports/database.port.ts
export abstract class Database {
  abstract readonly client: Knex;
}

// contexts/ordering/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly apiKey: string;
}

// composition root
builder.bind(Database).toValue({ client: knex });
builder.bind(PaymentSettings).toValue({ apiKey: configuration.paymentApiKey });
```

That is the one way: no string token, no symbol token, no helper.

**Identity across copies.** A class is its own identity, and two copies of a package loaded in
one process (a duplicated install, a bundle next to `node_modules`) hold two classes. A port
that declares `static readonly tokenKey = '<package>.<Port>'` is known by that key instead,
the same in every copy: `tokenIdentity(port)` answers what a container keys by, and
`describeToken(port)` its name. Every injectable port of the kernel carries one (`kernel.Clock`,
`kernel.CommandBus`, ...); `Repository<A, Id>` is a base to extend, never a token, and carries
none.

```ts
export abstract class PaymentGateway {
  static readonly tokenKey = 'ordering.PaymentGateway';

  abstract charge(orderId: string, amount: Money): Promise<PaymentReceipt>;
}
```

The limit, plainly: **a port of your own that declares no `tokenKey` and is loaded twice is
two tokens.** What is bound under one copy is not found under the other. An application
compiled as one program never meets it; a port published in a package that may be installed
twice, or bundled next to `node_modules`, declares a `tokenKey`. The key is the identity: two
ports that declare the same key are the same token, so prefix it with the package or the
context. It is declared, never inherited: a port that extends a keyed port declares its own.

When to declare one: only for a port that one process may load from two copies of its package.
A port of an application, compiled once into one program, never declares a key: the class is
identity enough, and a key would only be a name to keep unique by hand.

A port that extends a port of the kernel declares its key as any other does, without
`override`: the kernel ports carry theirs as an own property that is not a declared member
(`kernel.<ClassName>`, set in a static block), so nothing is overridden.

```ts
export abstract class OrderRepository extends Repository<Order> {
  static readonly tokenKey = 'ordering.OrderRepository';
}

export abstract class BusinessClock extends Clock {
  static readonly tokenKey = 'ordering.BusinessClock';
}
```

**What a class depends on is said by its constructor.** A decorator lists nothing: each
constructor parameter is typed by one class, its token, and `ddd-ts-kit docs` reads the
signatures from the sources into the generated file of the context, which registers them with
`injected`:

```ts
@CommandHandler(PlaceOrder)
export class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
  ) {}
}

// contexts/ordering/ordering.declarations.ts, generated
injected(PlaceOrderHandler, [OrderRepository, Clock]);
```

`injected(Class, [Tokens])` records one token per constructor parameter, in order, in a
registry shared by every copy of the kernel a process loads; `injectedDependencies(Class)`
reads it back, and a container (`@ddd-ts-kit/di`) is what uses it. Nothing here reads
`design:paramtypes`: that metadata exists only with legacy decorators compiled by `tsc` or
swc, not with standard decorators nor under `tsx` or esbuild. A decorator still accepts a list
as its last argument, `@CommandHandler(PlaceOrder, [OrderRepository, Clock])`: the form 0.1
projects wrote. A declaration then carries it in `dependencies`, which is `undefined` when
the constructor is the statement, and a container gives it precedence.

**What the compiler refuses**, in both decorator modes:

- a list, of `injected` or of a decorator, that does not name one port per constructor
  parameter, each of the type of its parameter, in order: a missing or extra entry, a wrong
  type, a wrong order; `injected(Class)` without a list for a constructor that takes something;
- a class that does not implement the port it is declared the adapter of, and an abstract class;
- a concrete class named where its port is expected: `[InMemoryOrderRepository, Clock]` for a
  parameter typed `OrderRepository`. A list names ports, never what implements them.

What changed with the list becoming optional: a decorator without a list accepts any
constructor, so the compiler no longer tells, at the decorator, a class whose list was
forgotten. It does not have to: the list is derived from the constructor, checked where it is
generated, and a class left without one is refused by name when the application is composed.

**What is refused when the file loads**, with a `DeclarationError` from `@Repository`,
`@Gateway` and `@Adapter`, because the compiler cannot see it:

- a port with a body: `TalkativePharmacy implements greet: a port is an abstract class with
  abstract members only`. A member inherited from a parent port counts;
- an adapter that extends its port: `CornerPharmacy extends Pharmacy: an adapter implements
  its port, it never extends it`.

`portDefect(port, implementation)` is that check, answering the reason or `undefined`; a
container applies it to a binding made by hand. A class bound to itself is no port and is
left alone.

### The decorators

| Decorator | On | Example |
|---|---|---|
| `Requires(permission, options?)` | a command or query that carries its actor | `@Requires(permissions['visit.schedule'], { resource: (c: ScheduleVisit) => ({ type: 'patient', id: c.patientId }), audited: ['startsAt'] })` |
| `Public(options?)` | a command or query anybody may send | `@Public()` |
| `CommandHandler(Message)` | the one handler of a command | `@CommandHandler(PlaceOrder)` |
| `QueryHandler(Message)` | the one handler of a query | `@QueryHandler(GetOrder)` |
| `IntegrationEventHandler(definition, { consumer, actorOf? })` | the handler of an integration event of another context | `@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })` |
| `DomainEventHandler(Event, { name })` | a handler of a domain event of its own context | `@DomainEventHandler(OrderPaid, { name: OrderPaid.eventName })`, the name the event class declares once in `static readonly eventName` |
| `Scheduled(name, schedule and options)` | a job run by time, which triggers use cases | `@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })` |
| `Projection(name)` with `On(definition)` on its methods | a projector: the class that keeps one read model up to date | `@Projection('scheduling.appointment-list')`, `@On(PaymentCaptured)` |
| `Repository(Port, options?)` | the adapter of a repository of the domain | `@Repository(OrderRepository)` |
| `Gateway(Port, options?)` | the adapter of a port that calls another context | `@Gateway(StockGateway)` |
| `Adapter(Port, options?)` | the adapter of any other port | `@Adapter(PaymentGateway, { kind: 'external' })` |
| `Policy(permission, { name })` | a rule that needs the loaded element | `@Policy(permissions['invoice.void'], { name: 'billing.only-issuer-voids' })` |

- **Access is said on the message.** A command extends `Command` or `AuthorizedCommand`, a
  query `Query` or `AuthorizedQuery`: the base class already says which of the two it is, so
  the decorator only says who may send it. `@Requires` is refused by the compiler on a message
  without an actor. `audited` lists the fields an audit trail may record (a name, or
  `{ field, masked: true }`), as plain data; the compiler checks that the message has them.
- **Dependencies are a list of ports**, checked against the constructor as said above. The
  list is left out for a constructor without parameters. There is no parameter decorator and
  no reflection.
- **The role is checked too**: a handler of another message or of another result, an event
  handler of another payload, a job without `run` are refused by the compiler.
- **Options of a repository, a gateway and an adapter**: `transient: true` (one instance per
  resolution instead of one per application), `replaces: true` (takes the place of a binding
  made earlier, such as a default of the kernel module), `aspects: [...]` (wrappers, the first
  outermost); an adapter also takes `kind: 'external' | 'publisher'`.
- **One name for the decorator and for the shape of its class**: `CommandHandler`,
  `QueryHandler`, `IntegrationEventHandler` and `DomainEventHandler` are each a decorator and a
  type, so one import serves `@IntegrationEventHandler(OrderPlaced, ...)` and
  `implements IntegrationEventHandler<OrderPlacedPayload>`. A job implements `ScheduledJob`.
- **Names are written, not derived**: the consumer name, the policy name, the job name and the
  name of the domain event survive the renaming of a class, and the empty string is refused.
- **A declared class is its own token**: `@ddd-ts-kit/di` binds a handler, a job or a policy
  under its class.

`declarationOf(Class)` answers what a class declared, as frozen plain data, or `undefined`;
`listDeclarations()` lists the declared classes the process still holds, for diagnostics. A
class plays one role: a second declaration on the same class throws `DeclarationError` when
the file loads, and so does `@Requires` or `@Public` on what is neither a `Command` nor a
`Query`, and `@Scheduled` with a name or a schedule that cannot be read. A declaration is not
inherited by a subclass.

The names of the main entry differ on purpose: there, `IntegrationEventCallback` and
`DomainEventCallback` are the plain functions given to `subscribe` and to `on`, and
`CommandHandler` and `QueryHandler` are the interfaces alone.

**Where it is stored.** In one registry per process, reached through `Symbol.for`, with the
classes held weakly. A context compiled against one copy of the kernel is therefore read by a
container holding another (a duplicated install, a bundle next to `node_modules`), and a module
reloaded by a watcher leaves no trace of its former classes. `Symbol.metadata` is not used:
Node 24 does not define it, and the legacy decorator mode has no context to carry it.

**Not in the domain.** `domain/` carries no decorator: aggregates, entities, value objects,
domain events, domain services and repository ports declare nothing. A domain event is
named by the handler that reacts to it, not by itself. `@UseCase` does not exist: the
canonical tree has one handler per command and no application service to bind.

### Integration events and their subscribers

`IntegrationEventPublisher` is what use cases publish through, `IntegrationEventSubscriber`
what handlers are subscribed on, and `EventBus` both at once. `EventSubscribers` gives each
bounded context its subscriber: `forContext(name)` answers an `IntegrationEventSubscriber`.
One bus serves every context by default; a broker gives each consuming context its own, so
that a context extracted into its own process keeps its queues. `@ddd-ts-kit/di` subscribes
the integration event handlers of a context on `EventSubscribers.forContext(<context name>)`.

### Scheduled

```ts
// contexts/billing/application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

A job lives in `application/scheduling/`, in a `*.job.ts` file, and only triggers use cases:
it receives buses and ports by its constructor and typically sends one command. The second
argument is the schedule and, next to it, the options:

| Key | Default | |
|---|---|---|
| `every` | | an interval, as milliseconds or `'30s'`, `'15m'`, `'2h'`, `'1d'`, aligned on the Unix epoch |
| `cron`, `timeZone` | `timeZone: 'UTC'` | the five standard fields, on the clocks of an IANA zone |
| `overlap` | `'skip'` | an occurrence that comes while the previous run is in progress is skipped, or `'queue'`d behind it |
| `missed` | `'skip'` | occurrences that passed without being reached are dropped, or the latest is `'run-once'` |
| `timeoutMs` | none | the signal of a longer run is aborted |
| `jitterMs` | `0` | a random delay before each run |
| `enabled` | `true` | meant to be overridden by configuration where the job is wired |
| `singleInstance` | `true` | the scheduler takes the `Lock` of each occurrence |

Exactly one of `every` and `cron` is written, and the compiler refuses the rest. The name is
`<context>.<job-name>` in lower case, unique in the application. `JobExecution` is what `run`
receives: `scheduledAt`, `startedAt`, `attempt` and an abort `signal`. What the schedules mean
across a change of clocks, what one instance among several guarantees and how a job is tested
are in the README of `@ddd-ts-kit/scheduling`.

### Background

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

A background job is named by its static `jobName`, which is how a use case enqueues it
(`jobs.enqueue(CompileStatementsBackgroundJob, { month })`, the payload typed by `run`). The decorator
takes the options, all optional: `maxAttempts` (5), `backoff` (`{ baseMs: 1000, factor: 2,
maxMs: 300000 }`), `timeout` and `lease` (30 s), as milliseconds or `'10m'`. A name that is not
`<context>.<job-name>` and options it cannot read throw a `DeclarationError` when the file
loads. `BackgroundJobExecution` is what `run` receives: `jobId`, `attempt`, `enqueuedAt`,
`startedAt`, the `checkpoint` an earlier attempt saved, an abort `signal`, `saveCheckpoint(value)`
and `reportProgress({ done, total })`.

### Decorator modes

Every decorator of this entry works under both decorator modes of TypeScript, and the same
source line type-checks under both, checks of the role and of a dependency list included.
Neither needs `emitDecoratorMetadata`, and what a constructor takes is known in both the same
way: read from the source, registered by `injected`.

| Stack | `tsconfig.json` |
|---|---|
| class-validator, NestJS, TypeORM entities, any library with legacy decorators | `"experimentalDecorators": true` |
| anything else | leave `experimentalDecorators` unset: standard (TC39) decorators need no flag |

One program has one mode, which is why the kit follows the project instead of choosing. A
class decorator receives the class first in both modes; the standard call adds a context,
which these decorators do not read. Nothing else differs: no `emitDecoratorMetadata`, no
`reflect-metadata`, no parameter decorator in either mode. Both are compiled by TypeScript 5,
6 and the native TypeScript 7. Under Vitest, legacy decorators need nothing; standard ones
need `decorators()` of `@ddd-ts-kit/testing/vitest`.

## Standard interfaces

Standard means that every project built with the kit has the same shape under the same name, so
an adapter, a middleware or a dashboard written once fits them all. Extensible means that a
project adds its own fields without forking the type (see "How to extend").

### Session

The authenticated session of an actor, as plain data.

| Field | |
|---|---|
| `id`, `actor`, `issuedAt`, `expiresAt?` | who, since when, until when |
| `authenticationMethod` | `none`, `password`, `sso`, `token`, `api-key`, `service`, or a string of the project |
| `authenticationStrength?` | `{ mfa?, assuranceLevel? }` |
| `impersonatedBy?` | id of the support actor acting as `actor`; `logFieldsOf` carries it to every log line |
| `locale?`, `timeZone?`, `client?` | BCP 47 tag, IANA zone, `{ ip?, userAgent? }` as opaque strings |
| `scopes?` | what the credential allows whoever presents it (the OAuth 2.0 `scope`): a limit on the client, never what the actor may do |
| `extensions` | the fields of the project |

`hasScope(session, scope)` reads the scopes; a project names its scope vocabulary once by
declaration merging of `SessionScopes` (`interface SessionScopes { readonly 'invoices:read': true }`),
and `SessionScope`, the type a guard takes, is then that vocabulary instead of any string.

`isExpired(session, clock.now())`, `isImpersonated(session)`, `anonymousSession()`,
`systemSession(name, issuedAt?)`, and `isSession(value)`, the structural guard a boundary uses on
what it received as a principal.

### ExecutionContext and ExecutionScope

What every unit of work carries, whatever started it: `correlationId`, `causationId?`, `actor`,
`session?`, `tenantId?`, `elevation?` (platform staff reading over tenants, see "Tenancy"),
`locale?`, `deadline?`, `scheduledAt?` (for a scheduled job, the instant it was due), `origin` (`http`, `event`, `schedule`, `cli`, or a string of the project) and `extensions`. `executionContext(init)` builds one and takes the tenant
of the actor; `withActor(context, actor)` is the same work seen as another actor.

`ExecutionScope` (`current()`, `require()`, `run(context, work)`) gives the context of the work
in progress to code that is not handed it. The boundary sets it once:

```ts
// presentation or platform: one run per request, consumed event, job
scope.run(executionContext({ correlationId, actor, session, origin: 'http' }), () => handle(request));
```

```ts
// infrastructure: a repository adapter
const row = { ...toRow(order), ...stampCreation(scope, clock), ...tenantScopeOf(scope) };
```

Use cases and the domain never read the scope: they receive the actor, and anything else they
need, in the command or query (`authz/actor-explicit`). The scope is for loggers, audit columns,
tenant scoping and outgoing headers.

A consumed event opens its own context: `executionContextOfEvent(event, { consumer })` has
origin `event`, the correlation of the event (its id when it names none), the event as
`causationId`, `systemActor(consumer)` as actor and the `tenantId` of the event, so the
consumer reads and writes in that tenant only; `inEventScope(scope, { consumer }, handler)`
wraps a handler with it. The standard envelope carries no actor, so that no personal data
travels by default: a project whose envelopes name one passes `actorOf`. On the way out,
`scopedPublisher(publisher, scope)` stamps the correlation and the tenant of the work in
progress on every event published without them, so everything one stimulus causes is found
again across processes and stays in its tenant.

`ActorContext` stays, unchanged. `ScopedActorContext` implements it on top of a scope: the
current actor is the actor of the current execution context, so the two cannot disagree.
`AsyncLocalStorageExecutionScope` follows the asynchronous call chain; `FixedExecutionScope` is
the test double, and follows a `FixedActorContext` when given one.

### Logger

`debug`, `info`, `warn`, `error(message, fields?)`, `child(fields)`, `isLevelEnabled(level)` and
`flush()`. `LogFields` spells the well-known keys once: `correlationId`, `causationId`,
`context`, `actorId`, `tenantId`, `errorType`, `errorCode`, `durationMs`; any other key is
accepted. A call never throws, whatever the fields: when they cannot be read or serialized the
entry is written with `UNWRITABLE_FIELDS` (`logError: "unserializable fields"`) in their place.
The kernel never writes to the console: `NoopLogger` is the default, `InMemoryLogger` records
`entries` for a test, a JSON lines adapter is in `@ddd-ts-kit/aspects`, and `@ddd-ts-kit/pino`
and `@ddd-ts-kit/winston` are the adapters of those libraries. The domain and use cases do not
log.

**Errors are log values.** `LogValue` admits an `Error`, so
`logger.error('payment failed', { error })` compiles as it is, and a project may name the key
once (`interface LogFields { error?: Error }`, see "Extending"). An `Error` directly under a
key of the fields is written by every logger as `describeError(error)` describes it, an
`ErrorDescription`:

| Key | |
|---|---|
| `type` | the class name |
| `code` | the `code` of a `DomainError`; absent for any other error |
| `message` | the message |
| `stack` | the stack of this error alone |
| `cause` | the cause, described the same way when it is an `Error`: eight errors deep at most, so a chain that loops ends |

Deeper in the fields (inside a nested object or a list) an error is left to the serializer of
the adapter: pass it under a key. `describeErrorFields(fields)` is the copy of the fields a
logger writes; an adapter of your own calls it and is held to the result by `loggerContract`.

**Messages of unexpected errors can be dropped.** Every logger of the kit takes
`scrubMessages: true` (`DescribeErrorOptions`): the message of every error that is not a
`DomainError` becomes `SCRUBBED_MESSAGE` (`[message removed]`) and its stack loses its first
line, which repeats it. Messages of `DomainError`s are written by the project and stay. It is
the option of the same name of `@ddd-ts-kit/sentry`, with the same rule and the same marker.
The default keeps the messages: a log that says `[message removed]` costs every investigation.

**What the kit logs on its own never holds a message.** The `logged` aspect,
`loggingMiddleware` and the job scheduler never hand an error to a logger: they write
`errorType` and `errorCode`, as `identifyError(error)` gives them, and the error itself goes to
the `ErrorReporter`. That holds whatever `scrubMessages` says. The full description is for the
error a project decides to log, in an adapter or a route; scrubbing is its opt-in for logs that
leave its hands.

**`isLevelEnabled(level)`** says whether an entry of that level would be written, for the
logger and its children. Ask it before building fields that cost; the kit does, in `logged`,
`loggingMiddleware` and the scheduler. `NoopLogger` answers `false`.

**`flush()`** resolves once every entry logged so far, through the logger or a child, was
handed to its destination, and never rejects. It is called once, when the process stops, after
the last entry: the application of `@ddd-ts-kit/di` calls it at the end of `stop()`. What is
logged after a flush is unspecified, and never throws: pino and `StdoutLogger` still write it,
winston, whose flush ends the logger, drops it. A second call resolves too.

`InMemoryLogger` takes `{ level?, fields?, base?, scrubMessages? }` like a real adapter: a
threshold (default `debug`, every entry), fields read at each entry, fields added to every
entry. Its `entries` hold what a logger writes: an error passed as a field is recorded as its
description. `CREDENTIAL_KEYS` and `REDACTED` are the field names and the marker the pino and
winston adapters redact with; `StdoutLogger` and `InMemoryLogger` redact nothing.

### Metrics

`counter(name).increment(labels?, by?)`, `histogram(name).record(value, labels?)`,
`gauge(name).set(value, labels?)`. Label values come from a small closed set, never an
identifier. `NoopMetrics` is the default; `InMemoryMetrics` records `samples` and answers
`counterValue`, `histogramValues` and `gaugeValue` for a subset of labels.

### ErrorReporter

`report(error, report)` and `flush(timeoutMs)`: where unexpected failures go to be looked at,
an error tracker. `report` is synchronous: it queues and returns, never throws and never waits
for the tracker; `flush` waits for the queue before the process stops and never rejects.
`ErrorReport` is plain data, identifiers only: `origin`, `operation`, `context`,
`correlationId`, `traceId`, `actorId`, `tenantId`, `errorCode`, `severity` (`fatal`, `error`,
`warning`) and the project's `extensions`. `NoopErrorReporter` is the default,
`InMemoryErrorReporter` records `reports` for a test, and `@ddd-ts-kit/sentry` is the adapter
for Sentry and GlitchTip.

No handler, aggregate or repository calls it: they throw. What stands around them reports,
each attached from outside:

| Capture point | Is | Reports |
|---|---|---|
| buses | `errorReportingMiddleware(reporter, scope)`, first on the bus | a command or query failing with anything but a `DomainError`; silent while an event is consumed |
| HTTP | `reportHttpErrors(reporter)` of `@ddd-ts-kit/http`, as `onError` | every request answered 5xx |
| jobs | `reportFailedRuns(reporter)` of `@ddd-ts-kit/scheduling`, as `onRun` | a run that failed with anything but a `DomainError` |
| events | `new DeadLetterReports(reporter)`: `onFailure` on the hook of the provider, `observing(subscriber)` around its subscriber | an event its provider gives up, never a retried delivery |
| process | `reportProcessFailures(reporter)` | `uncaughtException` and `unhandledRejection`, then exit code 1 after a flush |

A `DomainError` is a business refusal and is never reported, unless HTTP answers it as a 5xx or
it buries an event (a `warning`). All of them go through `reportOnce`: the first capture point
that sees an error object reports it, the boundaries it crosses afterwards recognise it, so a
command failing inside a request or a job is one report, named after the command.
`errorReportOf(error, source, executionContext?)` builds the report: origin, correlation, actor
and tenant ids come from the execution context, never threaded by hand.

### Cache

```ts
const quoteKey = (pair: string) => cacheKey<Quote>('quote', pair);

await cache.set(quoteKey('EUR-USD'), quote, { ttlMs: 60_000 });
const hit: Quote | undefined = await cache.get(quoteKey('EUR-USD'));
```

The key carries the type of its value. `InMemoryCache(clock, { maxEntries? })` expires by the
`Clock` and is bounded. `tenantCacheKey<Quote>(scope, 'quote', pair)` is the same key confined to
the tenant of the work in progress: what one tenant cached is never served to another.

### Purging the HTTP caches

Two ports, so that a use case can never purge before its commit:

| Port | Called by | Does |
|---|---|---|
| `CacheInvalidation.invalidate(tags)` | a `before-commit` handler of the domain event that changed what the answers show | asks for the tags to be purged once the work commits; `domain-events/transactional-before-commit` allows it |
| `CachePurger.purge(tags)` | the relay of the outbox, never a use case (refused before the commit) | purges a shared cache now: `InMemoryCachePurger` here, Varnish and the CDNs in `@ddd-ts-kit/http/purgers` |

`cacheTag('calendar', id)` names a resource (`calendar:c-1`, the identifier percent-encoded),
`cacheTag('calendar')` every resource of a kind; the routes of `@ddd-ts-kit/http` tag their
answers with the same function. `PublishedCacheInvalidation({ publisher, ids, clock, scope, perTenant? })`,
what `kernelModule()` of `@ddd-ts-kit/di` binds, publishes one `CachePurgeRequest` on the
publisher, the tags under the tenant of the work (`tenantCacheTags`) when `perTenant` is set, as
a multi-tenant application whose answers are tagged per tenant sets it (work that names no tenant
is then refused with `NoCurrentTenantError`: its purge would meet no answer): behind an outbox it
is a row of the transaction, gone with a rollback, kept across a crash after the commit.
`new PurgingPublisher(purger, broker)` is what the relay publishes through: the purge requests
go to the purger, the other events to the broker, and a failed purge throws so that the relay
retries it. `new RepeatedCachePurger(purger, { againAfterMs, onFailure? })` purges, then the same
tags once more `againAfterMs` later, for a read that loaded the previous state before the commit
and reached the cache after the first purge; the second purge is best effort, reported to
`onFailure`. `InMemoryCacheInvalidation` remembers the tags asked for (`invalidated`), for specs.

### Lock

```ts
const handle = await lock.acquire('nightly-export', { ttlMs: 60_000, waitMs: 0 });
if (handle === undefined) { // somebody else holds the key
  return;
}
try {
  await exportEverything();
} finally {
  await handle.release();
}
```

A mutex between processes, to avoid doing the same work twice. `acquire` answers `undefined`
when the key is held, at once or after `waitMs`; the lock frees itself after `ttlMs`; the
`fencingToken` of a `LockHandle` grows with each acquisition of a key, so a resource that
remembers the highest one refuses a holder whose lock expired. It is an efficiency tool, never
the guard of an invariant: what must not happen twice is refused by a database constraint.

`InMemoryLock(clock, { retryDelayMs?, sleep? })` excludes inside one process and expires by the
`Clock`: the fake, and enough for a single instance. The adapter between processes is in
`@ddd-ts-kit/redis`. `acquiring(attempt, waitMs, waiting)` is the retry loop an adapter shares.

### FileStorage, StoredFile, FileScanner

```ts
// The command wraps what the controller received: the bus stages it before the transaction opens.
this.document = new FileUpload(received, 'appointment-documents');

// The handler, inside the unit of work:
const { file, fileName } = command.document;                     // a StoredFile, staged and scanned
appointment.attachDocument(unwrap(AttachedDocument.create(file, fileName, now)), now);
await appointments.save(appointment);
await staging.promoteOnCommit(file.key);                         // moved to its key with the commit
```

`FileStorage` holds the content of files, never the database: `put` (a stream in, measured and
hashed, refused with `FILE_TOO_LARGE` beyond `maxBytes`, leaving nothing), `get` (a stream out),
`stat`, `delete`, `copy`, `move`, `list(prefix)`, and short signed links, `signedDownloadUrl` and
`signedUploadUrl` (at most `MAX_SIGNED_URL_SECONDS`, one hour). No method takes or returns a
whole file. A key is checked by `isFileKey` (segments of letters, digits, `.`, `-` and `_`, none
starting with a dot) before anything is touched, and `FileKeys` generates it on the server:
`TenantFileKeys(ids, clock, scope)` writes `tenants/<tenant>/<area>/<year>/<month>/<id>`, the
tenant segment only when the work in progress names one (the tenant id as it is: the kernel
refuses any other than letters, digits, `-` and `_`, so two tenants never share a prefix). The links of
`signedUploadUrl` carry a `maxBytes`, which the storages the application serves enforce.

`StoredFile` is what an aggregate keeps: `key`, `size`, `mediaType`, `checksum` (`sha256:<hex>`),
never the provider. `FileScanner` is the hook of an antivirus or a content check, called on the
staged file before it is accepted; `AcceptEveryFileScanner` is the one of a project that has
none yet. `FileError` carries the refusals: `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`,
`FILE_NOT_FOUND`, `INVALID_FILE_KEY`, `FILE_REJECTED`, `INVALID_FILE_URL_EXPIRY`.

A write to the storage is not rolled back with a transaction. `FileStaging(storage, scanner,
reporter)` gives the order that keeps both consistent, each step once:

- `stage(key, content, options)` writes under `staging/<key>` and scans; a refused file is
  removed (`FILE_REJECTED`). A file from a client travels in its command as a `FileUpload`
  (the `ReceivedFile` and the area of its key), staged by `fileUploadsMiddleware(desk)`, a bus
  middleware placed after the permission and before the unit of work, so no transaction waits
  on an upload. `upload.file` is the staged `StoredFile`.
- `promoteOnCommit(key)` moves the file to its key as the last step of the unit of work
  (`atCommit`, a `CommitStep` of `apply` and `undo`): a promotion that fails rolls the command
  back, and a transaction that rolls back after it returns the file to `staging/`. A committed
  row never points into `staging/`.
- `deleteAfterCommit(key)` deletes, once committed, a file the aggregate no longer references
  (`afterCommit`, at most once: a failure or a crash leaves an unreferenced file, reported).
- `purge(olderThan)` removes the staged files older than the instant, all orphans; the job
  `PurgeStagedFiles` runs it (the platform registers it as `files.purge-staged`, every hour,
  for files staged a day ago or more).

For a large file the client uploads straight to the storage: `uploadUrl(key, { expiresInSeconds,
mediaType, accepted, maxBytes })` answers the `link` for the client and the `pending` grant
(`PendingUpload`: key, size cap, media types) that the command records on the aggregate;
`confirm(pending)`, called by a command that reads the grant back from the aggregate, never
from the client, checks what arrived against the cap and on its bytes (`contentMatches`), scans
it, and answers the `StoredFile`. No final key may start with `staging/` (`assertFinalKey`).

`FileInspection` is the pass-through every connector streams through: it counts, hashes, and
with an expectation holds back the first bytes until they prove the declared media type
(`acceptsMediaType`, `contentMatches`: a PDF starts with `%PDF-`, office documents are zip
archives, text is UTF-8 without control characters, SVG and unknown binary formats never
match).

Connectors: `InMemoryFileStorage` for the tests (`keys()` lists what it holds) and
`LocalFileStorage({ directory, baseUrl, secret })` for development, both `ServedFileStorage`:
their signed links point at the application, which answers them with `signedFileRoutes` of
`@ddd-ts-kit/http`. The object store connector is `@ddd-ts-kit/s3`. Each passes
`fileStorageContract` of `@ddd-ts-kit/testing/contracts`. Background import and export (row by
row validation, an error report, resumption) needs a job queue the kit does not have yet: the
ports are ready for it, see `docs/concepts/file-storage.md`.

### JobScheduler

```ts
abstract class JobScheduler {
  abstract register(job: JobDefinition): void;      // { name, schedule, run, ...options }
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;                   // waits for the runs in progress, then aborts their signal
  abstract runNow(name: string): Promise<JobRun>;   // for an operation or a test
  abstract describe(): readonly JobDescription[];   // name, schedule, enabled, running, nextRunAt, lastRun
}
```

What runs the declared jobs when they are due. It is not the `Scheduler` of
`@ddd-ts-kit/aspects`, which is a timer for retry and timeout: this one knows jobs, schedules
and instances. A `JobRun` is one occurrence and its outcome (`succeeded`, `failed` with the
code of the error and never its message, `skipped-overlap`, `skipped-locked`, `missed`). A job
that fails stops neither the scheduler nor the other jobs, and `runNow` answers `failed`
instead of rejecting: only an unknown name rejects (`UnknownJobError`), and a name registered
twice throws (`DuplicateJobError`).

A run happens inside `ExecutionScope`, in the context `executionContextOfJob(name, { correlationId,
scheduledAt, deadline?, tenantId? })` builds: origin `schedule`, `systemActor(name)`, a correlation of its
own, and `scheduledAt`, the instant the run was due, which `ExecutionContext` carries for this
origin. A job is `global` by default and runs in no tenant; `tenancy: 'per-tenant'` makes the
scheduler run it once per tenant of a `TenantDirectory`, each run in that tenant.

`parseJobSchedule(schedule)` validates a schedule and answers the form occurrences are
computed from (`InvalidJobScheduleError`, code `INVALID_JOB_SCHEDULE`, otherwise);
`describeJobSchedule(schedule)` is its text; `jobPolicy(options)` validates the options and
fills in the defaults. The kernel holds no scheduler: the in-process one, the computation of
occurrences and the manual one for tests are `@ddd-ts-kit/scheduling`, and the contract of the
port is `jobSchedulerContract` of `@ddd-ts-kit/testing/contracts`.

### JobQueue

```ts
abstract class JobQueue {
  abstract enqueue<P>(job: BackgroundJobType<P>, payload: P, options?: EnqueueOptions): Promise<EnqueuedJob>;
  abstract cancel(id: string): Promise<boolean>;
  abstract find(id: string): Promise<QueuedJob | undefined>; // status, attempts, progress, last error code
}
```

Where a use case hands work to a worker. `EnqueueOptions` are `delay` or `runAt`, an
`idempotencyKey` (a job of the same name and key, enqueued for the same tenant and already kept,
is answered, `duplicate: true`) and a `subject` (the id of what the job works on, which `find`
answers next to the tenant: a query checks the job belongs to the element it was asked about).
`QueuedJobStatus` is the closed vocabulary of the statuses (`waiting`, `running`, `succeeded`,
`cancelled`, `dead`), to publish in a contract. Work done for a tenant finds and cancels the
jobs of that tenant only (an elevation, those of the tenants it names). Called inside a unit of
work, a job is added or cancelled with the business change: the stores of the ORM packages
write with the transaction, a store that cannot (Redis, memory) waits for the commit through
`whenCommitted(write, failed?)`, the helper any such adapter uses. A run happens inside
`ExecutionScope`, in the context `executionContextOfBackgroundJob({ jobId, enqueuedBy, deadline? })`
builds: origin `queue`, the correlation, actor and tenant of the work that enqueued it
(`EnqueuedBy`), the job as the cause. `backgroundJobPolicy(options)` fills in the defaults and
`retryDelayMs(policy, attempt)` is the backoff. The queue, its worker and its stores are
`@ddd-ts-kit/scheduling` and the ORM packages; why and how:
[Background jobs](../../docs/concepts/background-jobs.md).

### ProcessRunner and ProcessStore

```ts
abstract class ProcessRunner {
  abstract run<State>(process: ProcessType<State>, id: string, step: (current: State | undefined) => ProcessDecision<State> | undefined): Promise<void>;
  abstract timeout<State>(process: ProcessType<State>, due: ProcessTimeoutDue & { jobId: string }, step: (current: State) => ProcessDecision<State> | undefined): Promise<void>;
}

abstract class ProcessStore {
  abstract load(name: string, id: string): Promise<StoredProcess | undefined>;
  abstract save(process: StoredProcess): Promise<void>; // ConcurrencyError unless version is the stored one plus 1
}
```

Process managers: a class of `application/processes/` (`ProcessManager<State>`) with a static
`processName`, an optional static `timeoutJob` and a static `isState` guard; its steps answer a
`ProcessDecision` (`state`, `commands`, `timeouts` as `{ name, at }`, `cancel`, `ended`). A state
the guard does not recognise throws `UnreadableProcessStateError`. `InMemoryProcessStore` keeps
the instances as JSON, for tests and one process. The runner is `StoredProcessRunner` of
`@ddd-ts-kit/scheduling`; why and how:
[Sagas and process managers](../../docs/concepts/sagas-and-process-managers.md).

### RateLimiter

```ts
const decision = await limiter.consume(`password-reset:${accountId}`, { limit: 3, windowMs: 3_600_000 });
if (!decision.allowed) {
  throw new TooManyAttempts(decision.retryAfterMs);
}
```

A sliding window: at any instant, at most `limit` allowed calls in the `windowMs` before it. A
`RateLimitDecision` is `{ allowed, remaining, retryAfterMs }`; a refused call is not counted.
The key is whatever is limited: a client, a tenant, a route and an address together. In a
multi-tenant project, `tenantKey(scope, 'password-reset', accountId)` confines it to the tenant of
the work in progress (`tenant:<id>:password-reset:<account>`) and refuses work that names none.

`InMemoryRateLimiter(clock)` counts inside one process; the adapter shared by several instances
is in `@ddd-ts-kit/redis`. `rateLimitDecisionOf(counted, limit)` turns what an adapter counted
into the decision.

### Tenancy

The tenant of the work is `ExecutionContext.tenantId`, set at the boundary and read by
infrastructure only, like the rest of the context. The kernel holds what every strategy shares;
the isolation itself (tenant column, row-level security, schema or database per tenant) is in the
persistence packages, and the whole picture in
[Multitenancy](../../docs/concepts/multitenancy.md).

| Concept | What it does |
|---|---|
| `isTenantId(value)`, `assertTenantId(id)`, `InvalidTenantIdError` | the one grammar of a tenant id (letters, digits, `_`, `-`, at most 63): `executionContext`, `executionContextOfEvent`, `acrossTenants`, `InMemoryTenantDirectory`, `tenantScopeOf`, `tenantReachOf` and the row-level security settings refuse any other, so that no tenant id can be read as a wildcard, a list or a key separator |
| `tenantScopeOf(scope)` | the one tenant a write names; `NoCurrentTenantError` for work that names none |
| `tenantReachOf(scope)` | what a read may see: `{ kind: 'tenant', tenantId }`, or `{ kind: 'elevated', tenants }` under an elevation |
| `tenantsOf(actor)`, `isTenantMember(actor, tenantId)` | the tenants an actor belongs to: its `tenantId` and its `tenants` attribute |
| `acrossTenants({ scope, trail, clock, ids }, { reason, tenants }, work)` | platform staff reading over tenants: refused without a reason or a tenant, recorded in the `AuditTrail` (action `tenancy:elevate`) before the work runs; writes still name one tenant |
| `tenantKey(scope, ...segments)`, `tenantCacheKey(scope, ...segments)` | keys of rate limits, locks and caches confined to the tenant: `tenant:<id>:<segments>`, each segment percent-encoded, so that two lists of segments never give one key |
| `TenantDirectory`, `InMemoryTenantDirectory` | the tenants that exist, for per-tenant jobs, provisioning and migrations |
| `TENANT_SETTINGS`, `tenantSettingValues(context)`, `TENANT_ISOLATION_POLICIES`, `tenantPolicyExpressions(column)` | what the row-level security of the persistence packages shares: the three settings of a transaction (`ddd_ts_kit.tenant_id`, and for an elevation only `ddd_ts_kit.reach` and `ddd_ts_kit.every_tenant`), their values for the work in progress, the names of the four policies (one per command) and their `read` and `write` expressions |

An elevation is never implied by a role: the platform decides the permission to elevate (a use
case or a guard), then calls `acrossTenants`. A trail that fails to record it refuses it.

### Page and PageRequest

One shape for every search, in two variants:

```ts
offsetPage({ offset: 40, limit: 20, sort: [{ field: 'placedAt', direction: 'desc' }] });
cursorPage({ cursor, limit: 50 });
// both answer a Page<T>: { items, total?, nextCursor? }
```

A cursor is opaque to the client and plain to the reader: `encodeCursor(position)` writes the
sort values of the last item of a page, `decodeCursor(cursor)` reads them back and refuses what
it did not write. It is not signed: the read port checks the types of what it decodes before
they reach a statement. **A cursor needs a total order**: append a unique key (the primary key)
to the sort, in the same direction, put it in the position, and compare the whole tuple. Rows
that are equal on the sort field otherwise have no defined order, and a page could repeat or
skip one of them. The adapter packages show the query for each ORM.

`offsetPage` and `cursorPage` validate and raise `InvalidPageRequestError`
(`INVALID_PAGE_REQUEST`) beyond `PageLimits` (default size 20, maximum 100). `pageOf(items, more)`
and `mapPage(page, map)` build and translate the answer. The sortable fields are a type
parameter, `PageRequest<'placedAt' | 'total'>`: they differ for each read port, which a global
augmentation could not express.

### AuditStamp and TenantScoped

`AuditStamp` (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) and `TenantScoped` (`tenantId`)
are columns of a stored record, not properties of an aggregate. `stampCreation(scope, clock)`,
`stampUpdate(scope, clock)` and `tenantScopeOf(scope)` fill them in a repository adapter:

```ts
// insert: who creates is also who last updated
const row = { ...toRow(order), ...tenantScopeOf(scope), ...stampCreation(scope, clock) };
// update: the two columns to set, the creation is left alone; the tenant is part of every condition
await update({ ...toRow(order), ...stampUpdate(scope, clock) }, { id: order.id, ...tenantScopeOf(scope) });
```

`stampUpdate(stamp, scope, clock)` is the form for an adapter that holds the stored stamp (a
document store rewriting the whole record): it answers it whole, creation untouched.
`tenantScopeOf` raises `NoCurrentTenantError` for work that names no tenant, so a statement can
never run unscoped by omission. Every adapter package names the columns the same way:
`created_at`, `created_by`, `updated_at`, `updated_by`, `tenant_id`.

### AuditTrail, AuditReader and AuditEntry

```ts
abstract class AuditTrail {
  abstract record(record: AuditRecord): Promise<void>;
}

abstract class AuditReader {
  abstract search(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>>;
}
```

The two ports of an audit trail and the shape of one entry (`AuditEntry`, `AuditRecord` for
what a source hands over, `AuditFilter`, and the types they name), so that code which records
or lists depends on the kernel alone. `AuditTrail` is append only and is fed by infrastructure
and cross-cutting code (a bus middleware, the authorization hook, an event subscription), never
by a use case or an aggregate. `AuditReader` is what a query handler depends on to list
entries. A project adds fields to every entry through `AuditEntryExtensions`.

The kernel holds no implementation: the hash chain, the sources, redaction, verification and
the stores, the in-memory one included, are `@ddd-ts-kit/audit`.

### Not in the kernel

Feature flags have no port here. Their evaluation model (boolean or variant, targeting,
percentage, who the subject is) differs with each provider, and OpenFeature already is the
vendor-neutral contract: a project that needs flags declares a port in the context that reads
them, named after the decision it takes.

## Criteria

A read of a read model, described once for every search: filters, a sort, a page. A criteria
knows field names and nothing of a store. It is not a specification: a specification is a
business predicate on an aggregate and lives in the domain; a criteria describes a read.

<!-- checked sample -->
```ts
// contexts/scheduling/application/ports/appointment-list.port.ts
import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

export interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'confirmed' | 'cancelled';
  readonly startsAt: Date;
  readonly practitionerId: string;
  readonly cancelledAt: Date | null;
  readonly tenantId: string;
}

export const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    practitionerId: { type: 'string', filter: ['eq'] },
    cancelledAt: { type: 'instant', filter: ['isNull'], nullable: true },
    tenantId: { type: 'string' },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 50 },
});

export abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}
```

```ts
// contexts/scheduling/application/queries/search-appointments/search-appointments.handler.ts
const criteria = Criteria.of<AppointmentRow>()
  .where('status', 'in', ['booked', 'confirmed'])
  .where('startsAt', 'gte', query.from)
  .or((any) => any.where('practitionerId', 'eq', query.practitionerId).where('cancelledAt', 'isNull', false))
  .orderBy('startsAt', 'asc')
  .page(query.page);

const scope = await this.access.scope(query.actor, permissions['appointment.read'], 'appointment');

return this.appointments.search(scoped(criteria, scope, { ids: 'id', filter: { tenantId: 'tenantId' } }));
```

**Checked by the compiler.** `where` takes a field of the row, an operator that applies to
what the field holds, and a value of its type: `where('seats', 'contains', '2')`, an order on
a boolean, `isNull` on a field that is never null, a value outside a union of literals and a
field hydrated at query time are all refused. The same holds for a declaration: the type of
each field, its operators and `nullable` are checked against the row.

**Checked by the read port.** `validateCriteria(definition, criteria)` answers the violations,
never throws, and never quotes a value. `planCriteria(definition, criteria)` validates first and
throws `InvalidCriteriaError` (`INVALID_CRITERIA`): a criteria its definition refuses never
reaches a statement.

| Code | Path | Refused |
|---|---|---|
| `unknown_field` | `filter.<field>` | a field the definition does not declare |
| `operator_not_allowed` | `filter.<field>` | an operator the field does not declare |
| `invalid_value` | `filter.<field>` | a value that is not of the type of the field, an empty list, a `between` without two values, an empty text to search |
| `in_list_too_long` | `filter.<field>` | a list above `maxInList` (100) |
| `too_deep` | `filter` | groups nested deeper than `maxDepth` (1: `or(a, b)`; 2: `or(and(a, b), c)`) |
| `empty_group` | `filter` | a group without a filter |
| `too_many_filters` | `filter` | more conditions than `maxFilters` (20) |
| `unsortable_field` | `sort` | a sort on a field not declared `sortable` (the tie-breaker always is) |
| `page_too_large` | `page.limit` | a page above `maxPageSize` (100; the default size is 20) |
| `invalid_cursor` | `page.cursor` | a cursor that is not the `nextCursor` of a page of the same sort |

### What a criteria means

The reference is `evaluateCriteria(definition, rows, criteria)`, which runs a criteria over
rows held in memory and is what a fake of a read port answers with. Every store translator is
held to the same table by `criteriaContract` of `@ddd-ts-kit/testing/contracts`.

| Rule | Meaning |
|---|---|
| Types | `string`; `number`; `boolean`; `instant`, a `Date` compared by its time, to the millisecond; `decimal`, a string of digits (`-12.50`) compared as a number without the rounding of a float |
| `eq`, `ne`, `in` | by value: two instants of the same time are equal whatever the zone they were written in, `10.5` is `10.50` |
| `gt`, `gte`, `lt`, `lte` | numbers, decimals and instants by value; strings by Unicode code point, so upper case comes before lower case (`'B' < 'a'`); not on a boolean |
| `between` | both bounds included |
| `contains`, `startsWith` | on a string only, case sensitive, the text taken literally: `%`, `_` and `\` are characters. A search that ignores case reads a lower-cased column the projection writes |
| `isNull` | `true` keeps the rows without a value, `false` those with one; only on a field declared `nullable` |
| A null | never satisfies a comparison, `ne` included; only `isNull` sees it |
| Conditions | joined by AND |
| `and`, `or`, `not` | `not` holds on the rows that do not satisfy all its filters, **nulls included**: logic has two values, so `not(room eq 'B')` keeps the rows without a room, where SQL alone would drop them |
| Sort | the `orderBy` calls, then the sort of the page request for the fields not ordered yet; without any, the `defaultSort` of the definition |
| Total order | the tie-breaker of the definition ends every sort, in the direction of the last field, unless the sort names it |
| Null in a sort | the greatest value: last ascending, first descending (the default of PostgreSQL) |
| `false` and `true` | `false` first ascending |
| Offset page | the slice and `total`, the count of the filtered rows |
| Cursor page | no `total`; `nextCursor` when another page follows. The cursor holds the sort values of the last row, is checked against the declared types when it comes back, and belongs to one sort |
| No page | the first page of the default size |

Two things follow from where a store keeps its data, and are written in each adapter README.
**Strings are ordered by the collation of their column**: the reference is the `"C"` collation
of PostgreSQL, so a text column that is sorted or compared by range is declared `COLLATE "C"`.
**A decimal reads back as its column formats it** (`10.5`, or `10.5000` for a fixed scale):
compare decimals as numbers.

### The scope of the actor

`scoped(criteria, accessScope, mapping)` answers a `ScopedCriteria`, which is what a read port
asks for: a read cannot reach it without a scope. The scope is kept apart from the filters and
joined to them by AND, so nothing a caller writes, an `or` or a `not` included, widens what the
actor may read; `refine` changes the criteria and keeps the restriction.

| Scope | Becomes |
|---|---|
| `{ kind: 'all' }` | nothing: the criteria as it is |
| `{ kind: 'none' }`, or `ids` without any id | an empty page, without a query |
| `{ kind: 'ids', ids }` | `in` on the field `mapping.ids` names; the list is the authorizer's and is not bounded by `maxInList` |
| `{ kind: 'filter', filter }` | one `eq` per entry, on the field `mapping.filter` names for its key |

A scope the mapping cannot express throws `UnmappedReadScopeError` instead of reading without
the restriction, and so does a mapped field the definition does not declare. The fields of a
scope need no operator in the definition: the read port chose them, not the caller. The scope
is the shape `AccessScope` of `@ddd-ts-kit/auth`, named `ReadScope` here so that the kernel
depends on no authorization model.

### For a store

`planCriteria` answers a `CriteriaPlan`, plain data a translator renders and nothing else: the
predicate of the filters and the scope, the predicate of the keyset for a cursor page, the
total order, the rows to fetch. Negations are already pushed down to the comparisons, so a
translator renders `and`, `or` and tests; the keyset is a predicate like another, so paging by
cursor is written once. `pageOfPlan(plan, rows, total?)` turns the rows a query answered into
the `Page`. The adapter packages hold the translators: `criteriaToKnex`, `criteriaToDrizzle`,
`criteriaToPrisma`, `criteriaToTypeOrm`.

**Limits.** No join: a field of another context is filtered once a projection copied it. No
aggregation, no full-text search. A long `ids` scope is a long `IN` list: beyond a few
thousand identifiers, project the right the scope stands for into the read model.

## Hydration

Completing the rows of a read with data of another bounded context, at query time, through a
gateway port: for detail views and small pages whose foreign data must be fresh. A list that
filters or sorts by the foreign field needs a projection instead.

```ts
const page = await this.appointments.search(criteria);

return hydrate(page)
  .with('practitioner', (row) => row.practitionerId, this.practitioners.byIds)
  .with('location', (row) => row.locationId, this.locations.byIds)
  .orElse('practitioner', unknownPractitioner, { onFailure: 'fallback', timeoutMs: 300 });
```

`lookup` is `(ids: readonly string[]) => Promise<ReadonlyMap<string, T>>`, a method of the
gateway port; the `cached` aspect of `@ddd-ts-kit/aspects` goes around the gateway as around
any other.

| Rule | |
|---|---|
| Calls | one per relation for the whole page, with each key once; none when no row has a key. Never one per row |
| Concurrency | the relations are looked up at the same time |
| Result | the row and the hydrated properties, typed; a `Page` stays a `Page` with the same `total` and `nextCursor`, a list of rows becomes a page of them; `warnings` is added |
| A row without a key, or unknown on the other side | left without the property, which is typed optional |
| `orElse(name, fallback)` | every row has the property, typed required: the fallback where nothing was found |
| A lookup that rejects | fails the whole hydration (policy `fail`, the default), fallback or not |
| `orElse(name, fallback, { onFailure: 'fallback' })` | the rows take the fallback and `warnings` holds `{ relation, code: 'lookup_failed' }`: never a silent success, never the error message |
| `timeoutMs` | the lookup is given up after that long (`HydrationTimeoutError`, warning code `lookup_timed_out`), then follows `onFailure` |

A hydrated property cannot be named by a criteria definition: `FieldOf<Row>` keeps the fields
that hold a scalar, and the compiler refuses the rest. The traces show one `gateway
<Port>.byIds` span per relation, as for any call to a gateway: hydration opens no span itself.

## Projections

A projector keeps one read model up to date from events: integration events of upstream
contexts, domain events of its own. It writes its read model through a port and does nothing
else: it sends no command and reads no other context.

```ts
// contexts/scheduling/application/projections/appointment-list.projection.ts
import { stampOf, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';

@Projection('scheduling.appointment-list')
export class AppointmentListProjection {
  constructor(private readonly appointments: AppointmentList) {}

  @On(AppointmentBooked, { name: 'scheduling.appointment.booked' })
  booked(event: AppointmentBooked) {
    return this.appointments.upsertIfNewer(event.aggregateId, stampOf(event), () => rowOf(event));
  }

  @On(PaymentCaptured)
  paid(event: IntegrationEvent<PaymentCapturedPayload>) {
    return this.appointments.upsertIfNewer(event.payload.appointmentId, stampOf(event), (row) =>
      row === undefined ? undefined : { ...row, paid: true },
    );
  }

  @On(AppointmentCancelled, { name: 'scheduling.appointment.cancelled' })
  cancelled(event: AppointmentCancelled) {
    return this.appointments.delete(event.aggregateId, stampOf(event));
  }
}
```

`@Projection('<context>.<name>')` is a declaration like the others: both decorator
modes, its dependencies stated by its constructor, one class per file, in
`application/projections/`, in a `*.projection.ts` file. `@On(definition)` on a method says
"this method applies that integration event"; `@On(EventClass, { name })` says it for a domain
event of the projection's own context. A method that takes another event is refused by the
compiler, a projection without any `@On` and an `@On` on a class without `@Projection` throw
when the file loads. A method answers what its store answered, which is how the application
counts what was applied and what was stale.

**A role of the CLI.** `application/projections/` is a directory of the canonical tree,
`ddd-ts-kit generate projection <context> <Name> <event-type>` writes a projector with its
spec, the generated barrel `<context>.declarations.ts` exports it and registers what its
constructor takes, and `ddd-ts-kit describe` and the reference of `CONTEXT.md` list it with
the events it applies.

### Idempotent and ordered by construction

`ReadModelStore<Row>` is the port of a read model: `get`, `upsertIfNewer`, `delete` and
`search(scopedCriteria)`. Every row carries the stamp of the event that last changed it, and a
write happens only if its event is newer:

| Rule | |
|---|---|
| Stamp | `stampOf(event)`: the id and the instant of an integration event; the name, the aggregate and the instant of a domain event; plus `stampOf(event, version)` when the event carries a per-key version |
| Newer | a greater `version` when both stamps carry one; else a later instant; at the same instant, the greater event id. The same event is never newer than itself |
| `upsertIfNewer(key, stamp, next)` | writes `next(current)`; `stale` when the row holds this event or a later one; `ignored` when `next` answers `undefined` (a patch of a row that does not exist) |
| `delete(key, stamp)` | the row is gone for `get` and `search`, and its stamp stays: an older event delivered late does not bring it back, a later one does |
| Concurrency | a write is conditional on the stamp it read and is read again when another got there first; five attempts, then `ConcurrencyError` and the redelivery of the event |
| Transaction | the store writes on the executor of the unit of work, so the row and the processed-event mark of the event commit or roll back together |

So a redelivery, a duplicate and two events of one key delivered out of order all end on the
same row. **What this does not give**: an older event skipped as stale is not applied later, so
an event should carry the state of the fields it sets, or come in order per key (the outbox
orders per key); a deletion that reaches a row never seen leaves no trace; with instants and
no version, the order of two events of one key is the order of the clocks that stamped them;
a version is compared with the version the row holds, so pass one only when every event of a
row comes from the same stream. One write is one row: an event that concerns many rows lists
them with a criteria and writes each.

`TableReadModelStore` is the one implementation of the port, over a `ReadModelTable` an
adapter gives (three statements and the query of a plan): `InMemoryReadModelStore` here for
the fakes, `KnexReadModelStore`, `DrizzleReadModelStore`, `PrismaReadModelStore` and
`TypeOrmReadModelStore` in the adapter packages, all held to `readModelStoreContract`.

### Rebuild

A read model fed by events that no event store keeps is rebuilt from the source of truth, the
read contract the owning context publishes, behind a gateway port that answers stamped rows. A
read model of event-sourced aggregates is rebuilt from the store instead:
[Fed by the event store](#fed-by-the-event-store).

```ts
await new ProjectionRebuild({ table: appointments.table, source, unitOfWork }).run();
// source.export(cursor): a page of { key, row, stamp } and its nextCursor
// source.lookup(keys):   the rows of these keys as they are now
```

| Step | What happens |
|---|---|
| 1 | an empty copy of the table is opened, with its indexes and constraints and the traces of the deleted rows; from then on every write of the projection records its key before it writes |
| 2 | the export is copied, page by page, into the copy. Events keep being applied to the table, which keeps answering reads |
| 3 | the recorded keys are read again from the source, in rounds, until few remain |
| 4 | in one transaction: the writers are held, the last recorded keys are read again, the copy takes the name of the table, the old table is dropped |

The copy is filled from the source alone, never from the table being replaced, so a rebuild
repairs rows the projection got wrong. **No event is lost**: an event is delivered after its
source committed it, so either the export read its row afterwards, or its key was recorded and
read again, or it is applied after the swap to a row whose stamp is older. **No event is
applied twice**: an event the source already reflected is `stale` against the stamp its row
came with. Both rest on what the source says of each row: the stamp of the last event its
state reflects. With the id and instant of that event, or a per-key version, the guarantee is
exact; with an `updatedAt` alone, an event of the very same instant is applied once more over
the state that already holds it, which is harmless for an event that sets state and wrong for
one that counts.

**The window.** Reads are never interrupted until step 4. Writers wait during step 4, for the
time it takes to read the last keys again (at most `settledBelow`, 50 by default, unless the
table changes faster than `maxRounds` rounds can follow) and to rename two tables. A write that
had started just before fails and is redelivered. A rebuild that fails drops its copy and
leaves the table as it was. On PostgreSQL the copy is made `LIKE ... INCLUDING ALL`:
privileges granted on the table by name, row security policies and triggers are not copied
and are restored by the migration that follows, and the indexes of the copy keep the names
PostgreSQL derived for them.

### Fed by the event store

A projection of event-sourced aggregates can be fed by the store rather than where the domain
events are dispatched: `@Projection('scheduling.attendance-history', { feed: 'event-store' })`.
The dispatcher then never calls it (`@ddd-ts-kit/di` registers no handler for it); a catch-up
subscription does, under the name of the projection, and the same projection rebuilds its read
model from position zero.

```ts
const apply = applyingProjection(projection, serializer); // the @On methods, by event name

const subscription = new CatchUpSubscription({ name: 'scheduling.attendance-history', store, checkpoints, unitOfWork, apply });

await subscription.catchUp(); // or poll() from a job: one batch, one unit of work

await new EventStoreProjectionRebuild({
  table: history.table,
  store,
  unitOfWork,
  applierOn: (copy) => applyingProjection(new AttendanceHistoryProjection(copy), serializer),
}).run();
```

| Piece | What it does |
|---|---|
| `CatchUpSubscription` | Reads the store after the checkpoint of its subscriber (`CheckpointStore`), applies a batch and moves the checkpoint in one unit of work. A failure applies none of the batch; two runs of one subscriber never both move it (`ConcurrencyError`). A new projection starts at zero, so it catches up on the whole history |
| `applyingProjection(projection, serializer)` | (`@ddd-ts-kit/kernel/declarations`) hands each stored event an `@On` method applies, read back by the serializer of its aggregate, to that method; passes over the rest of the store |
| `storedStampOf(event)` | The stamp of an event read from the store: its id, instant and version in its stream, so the rows of one stream are ordered by the stream, not by clocks. `undefined` for an event that did not come from a store |
| `EventStoreProjectionRebuild` | Fills an empty copy of the table by replaying the store from position zero through the projection built over the copy (`ShadowReadModelStore`); then, in one transaction, holds the writers, replays what was appended meanwhile and puts the copy in place of the table. The subscription goes on from its checkpoint; what it applies again is stale against the copy. A failed rebuild leaves the table as it was |

A projection fed by the store applies the domain events of its context only: an integration
event reaches a projection where it is consumed, and `@On(definition)` on such a projection
throws when the file loads.

### Seen from outside

Through the ports that exist. `@ddd-ts-kit/di` counts `projection_events_total` by `context`,
`projection`, `event` and `result` (`applied`, `stale`, `ignored`, `failed`) on `Metrics`, and
sets `projection_last_event_age_ms`, the age of the last event applied when it was: the lag.
A projection is subscribed as a consumer under its name, so each delivery is one `process
<projection>` span, with the calls to its read model below it, and an event buried after its
retries reaches the error reporter as for any consumer.

## Event sourcing

Chosen per aggregate, never per project: the other aggregates of the context keep their state
in tables. When to choose it and what it costs:
[docs/concepts/event-sourcing.md](../../docs/concepts/event-sourcing.md).

```ts
// domain/aggregates/attendance-record.aggregate.ts
type AttendanceEvent = AttendanceRecordOpened | NoShowNoted;

export class AttendanceRecord extends EventSourcedAggregate<AttendanceEvent, AttendanceState> {
  private state: AttendanceState = { noShows: 0 };

  private constructor(id: string) {
    super(id);
  }

  static open(id: string, now: Date): AttendanceRecord {
    const record = new AttendanceRecord(id);

    record.record(new AttendanceRecordOpened(id, now));

    return record;
  }

  static rehydrate(id: string, history: AggregateHistory<AttendanceEvent, AttendanceState>): AttendanceRecord {
    const record = new AttendanceRecord(id);

    return record.replay(history, (state) => record.restore(state));
  }

  noteNoShow(appointmentId: string, now: Date): void {
    if (this.state.noShows >= 3) {
      throw AttendanceRecordError.alreadyBarred(this.id);
    }

    this.record(new NoShowNoted(this.id, now, appointmentId));
  }

  protected appliers(): Appliers<AttendanceEvent> {
    return {
      [AttendanceRecordOpened.eventName]: () => undefined,
      [NoShowNoted.eventName]: (event) => this.applyNoShowNoted(event),
    };
  }

  private restore(state: AttendanceState): void {
    this.state = state;
  }

  private applyNoShowNoted(event: NoShowNoted): void {
    this.state = { noShows: this.state.noShows + 1 };
  }
}
```

| Piece | What it does |
|---|---|
| `EventSourcedAggregate<E, S>` | A command checks its invariants on the state, then `record(event)`: the event is applied through the method `appliers()` names for it, and kept for the save. Only apply methods (and `restore`, for a snapshot) change the state (`event-sourcing/state-in-apply`). `appliers()` must name every event of the union, or it does not compile |
| `replay(history, restore?)` | Rebuilds from `{ snapshot?, events }`, through the same apply methods, recording nothing. `version` is the number of events of the stream the aggregate reflects |
| `appendChanges(aggregate, append)` | What a repository adapter calls: the events recorded since the load and the version the stream must still have; on success the aggregate is at the new version |
| `EventStore` | The port: `append(stream, expectedVersion, events)` (a `ConcurrencyError` when somebody appended first, nothing kept of it), `readStream(stream, after?)`, `readAll(after, limit)` in the order the appends committed, `head()`. `InMemoryEventStore` here; PostgreSQL through every ORM adapter. Held to `eventStoreContract` |
| `defineStoredEvent(Event, spec)` | How one event is stored: `version` of its shape, `encode(event): NamedData` (plain data, dates kept as ISO text), `decode(data, envelope)` reading each field by type (`data.text('x')`, `data.instant('at')`, `data.record('amount')`), and `upcasters` from each older version |
| `EventSerializer<E>` | Every stored event of one aggregate (`StoredEventTypes<E>`: one entry per event, or it does not compile). A stored event is never rewritten: it is upcast when read. An event of a later shape than the release knows, or a version without upcaster, is an `UnreadableEventError` |
| `EventSourcedRepository` | What the repository adapter delegates to: `findById` replays the stream `<category>-<id>` (from the last snapshot), `save` appends in the transaction of the unit of work; the events then leave with the save like any other |
| `SnapshotPolicy` | Per aggregate: `every` so many events, a `version` of the shape (another one is ignored, the stream replayed), `encode` and `decode`. `expectSnapshotEquivalence` of `@ddd-ts-kit/testing` proves a snapshot rebuilds the state a full replay does |
| `personalData(subject, value)` | Marks a personal value in `encode`. `PersonalDataCipher` over a `SubjectKeyStore` seals it with the key of its data subject (AES-256-GCM); `SubjectKeyStore.erase(subject)` destroys the key, and a replay then reads `ERASED_PERSONAL_DATA` |

```ts
// infrastructure/persistence/event-store-attendance-record.repository.ts
@Repository(AttendanceRecordRepository)
export class EventStoreAttendanceRecordRepository implements AttendanceRecordRepository {
  private readonly streams: EventSourcedRepository<AttendanceRecord, AttendanceEvent, AttendanceState>;

  constructor(store: EventStore, snapshots: SnapshotStore, cipher: PersonalDataCipher) {
    this.streams = new EventSourcedRepository({
      store,
      category: 'scheduling.attendance-record',
      serializer: new EventSerializer<AttendanceEvent>(attendanceRecordEvents, { cipher }),
      rehydrate: (id, history) => AttendanceRecord.rehydrate(id, history),
      snapshots: { store: snapshots, every: 50, version: 1, encode: (record) => record.toState(), decode: stateOf },
    });
  }

  findById(id: string): Promise<AttendanceRecord | undefined> {
    return this.streams.findById(id);
  }

  save(record: AttendanceRecord): Promise<void> {
    return this.streams.save(record);
  }
}
```

**No double write.** The store joins the transaction of the unit of work, and the publisher of
the integration events is a handler of the domain events that runs before the commit and
writes the outbox: the stream and the outbox records commit together or not at all.
`eventStoreUnitOfWorkContract` of `@ddd-ts-kit/testing` proves it for each transactional store:
nothing is published for an append rolled back or refused by a concurrency conflict.

## How to extend

`Session`, `ExecutionContext`, `Actor`, `AuditEntry` and `ErrorReport` each have an empty interface that a project fills by
declaration merging, once, in a declaration file of its platform:

```ts
// src/platform/kernel-extensions.d.ts
import '@ddd-ts-kit/kernel';

declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly plan: 'free' | 'team';
  }
  interface ExecutionContextExtensions {
    readonly region: string;
  }
  interface ActorExtensions {
    readonly department: string;
  }
  interface AuditEntryExtensions {
    readonly region: 'eu' | 'us';
  }
  interface ErrorReportExtensions {
    readonly deployment: 'blue' | 'green';
  }
  interface LogFields {
    orderId?: string;
    error?: Error;
  }
  interface MetricLabels {
    region?: 'eu' | 'us' | undefined;
  }
}
```

```ts
session.extensions.plan;          // 'free' | 'team' | undefined
context.extensions.region;        // string | undefined
actor.attributes.department;      // string | undefined
entry.extensions.region;          // 'eu' | 'us' | undefined
logger.info('shipped', { orderId: 42 });   // compile error: orderId is a string
```

- **`extensions`, not top-level fields.** A project field lives under `extensions`, so a
  standard field added to `Session` or `ExecutionContext` in a later version can never collide
  with it.
- **Optional when read.** `anonymousSession()`, `systemSession()` and `executionContext()` carry
  no extension, and they must stay truthful in every project: an extension reads as
  `T | undefined`.
- **`Actor` keeps its bag.** Authorizers already read `actor.attributes` by name, and actors
  travel in messages: `ActorExtensions` gives known attributes a name and a type inside that
  bag instead of adding a second one. An extension that is not an `ActorAttribute` (a string, a
  number, a boolean or a list of strings) reads as `never`.
- **`AuditEntryExtensions` holds JSON.** An entry is hashed and stored as it is: an extension
  that is not plain JSON (a `Date`, a class) reads as `never`.
- **`LogFields` and `MetricLabels`** take new well-known keys the same way; unknown keys stay
  allowed.
- **Nothing to register.** The augmentation is types only. Adapters of the kit keep compiling:
  they never read a project extension.
