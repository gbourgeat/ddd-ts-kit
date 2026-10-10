import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryQueryBus,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  executionContext,
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
}

export interface TestBuses {
  readonly commandBus: InMemoryCommandBus;
  readonly queryBus: InMemoryQueryBus;
  readonly eventBus: InMemoryEventBus;
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
  /** The integration events published so far, optionally of one type only. */
  publishedEvents<Payload = unknown>(type?: string): IntegrationEvent<Payload>[];
}

/**
 * Everything a handler spec needs, in memory and deterministic: register the handler under
 * test, execute a command, assert the repository fake and `publishedEvents()`.
 */
export function createTestBuses(options: TestBusesOptions = {}): TestBuses {
  const eventBus = new InMemoryEventBus();
  const context = options.executionContext ?? DEFAULT_EXECUTION_CONTEXT;
  const actorContext = new FixedActorContext(context.actor);

  return {
    commandBus: new InMemoryCommandBus(),
    queryBus: new InMemoryQueryBus(),
    eventBus,
    unitOfWork: new InMemoryUnitOfWork(),
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
