import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCommandBus,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  InMemoryQueryBus,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  dispatchingOnSave,
  unitOfWorkMiddleware,
  executionContext,
  type EventBusFailures,
  type ExecutionContext,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';

export interface TestBusesOptions {
  /** The instant the clock is frozen at. Default 2026-01-01T00:00:00.000Z. */
  readonly now?: Date;
  /** Prefix of the generated identifiers. Default `id`, giving `id-1`, `id-2`... */
  readonly idPrefix?: string;
  /**
   * What infrastructure sees as the work in progress. Default: the user `test-user`, without
   * role, correlation `test-correlation`, origin `test`.
   */
  readonly executionContext?: ExecutionContext;
  /**
   * How `eventBus` rejects when its handlers fail: `as-thrown` rethrows the failure of a single
   * handler as it is. Default `aggregated`, which becomes `as-thrown` in a later minor version.
   */
  readonly eventBusFailures?: EventBusFailures;
}

export interface TestBuses {
  /** Runs every command in `unitOfWork`, as the bus of the application does. */
  readonly commandBus: InMemoryCommandBus;
  readonly queryBus: InMemoryQueryBus;
  readonly eventBus: InMemoryEventBus;
  /**
   * Where the domain events of what the repositories wrapped by `dispatching` saved are
   * dispatched: at the end of the command, as in the application. `domainEvents.on(name, handler,
   * { phase: 'after-commit' })` attaches a handler of the other phase, and
   * `domainEvents.afterCommitFailures` holds what such handlers threw.
   */
  readonly domainEvents: InMemoryDomainEventDispatcher;
  readonly unitOfWork: InMemoryUnitOfWork;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
  /**
   * For the fakes and adapters that stamp audit columns or scope by tenant. Replace the context
   * with `executionScope.enter(context)`, or run a block in another one with `scoped`.
   */
  readonly executionScope: FixedExecutionScope;
  /** Follows `executionScope`; `actorContext.actAs(actor)` changes the actor of both. */
  readonly actorContext: FixedActorContext;
  /**
   * The repository fake as the application hands it to a handler: its save hands the domain
   * events of the aggregate to `domainEvents`, which hears them once the command handler has
   * returned. The handler under test only saves.
   */
  dispatching<T extends object>(repository: T): T;
  /** The integration events published so far, optionally of one type only. */
  publishedEvents<Payload = unknown>(type?: string): IntegrationEvent<Payload>[];
}

/**
 * Everything a handler spec needs, in memory and deterministic: register the handler under
 * test, execute a command, assert the repository fake and `publishedEvents()`.
 */
export function createTestBuses(options: TestBusesOptions = {}): TestBuses {
  const eventBus = new InMemoryEventBus({ failures: options.eventBusFailures });
  const context = options.executionContext ?? DEFAULT_EXECUTION_CONTEXT;
  const actorContext = new FixedActorContext(context.actor);
  const domainEvents = new InMemoryDomainEventDispatcher();
  const unitOfWork = new InMemoryUnitOfWork();

  return {
    commandBus: new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork)),
    queryBus: new InMemoryQueryBus(),
    eventBus,
    domainEvents,
    dispatching: (repository) => dispatchingOnSave(repository, () => domainEvents),
    unitOfWork,
    clock: new FixedClock(options.now ?? new Date('2026-01-01T00:00:00.000Z')),
    ids: new SequentialIdGenerator(options.idPrefix),
    executionScope: new FixedExecutionScope(context, actorContext),
    actorContext,
    publishedEvents<Payload = unknown>(type?: string) {
      const events = eventBus.published.filter((event) => type === undefined || event.type === type);

      // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the payload type is the caller's claim about what the handler under test published; nothing here can check it
      return events as IntegrationEvent<Payload>[];
    },
  };
}

const DEFAULT_EXECUTION_CONTEXT = executionContext({
  correlationId: 'test-correlation',
  actor: { id: 'test-user', type: 'user', roles: [], attributes: {} },
  origin: 'test',
});
