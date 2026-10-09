import {
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  InMemoryQueryBus,
  InMemoryUnitOfWork,
  SystemClock,
  UuidGenerator,
  unitOfWorkMiddleware,
  type Clock,
  type CommandBus,
  type EventBus,
  type IdGenerator,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
  type ProcessedEventStore,
  type QueryBus,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  ID_GENERATOR,
  PROCESSED_EVENTS,
  QUERY_BUS,
  UNIT_OF_WORK,
} from './kernel-tokens.js';
import { defineContextModule, type ContextModule, type Resolve } from './module.js';

/** An instance, or a factory when it needs other bindings. A port is never itself a function. */
export type Provided<T> = T | ((resolve: Resolve) => T);

export interface KernelModuleOptions {
  readonly clock?: Provided<Clock>;
  readonly ids?: Provided<IdGenerator>;
  readonly unitOfWork?: Provided<UnitOfWork>;
  /** Handlers declared with `builder.command(...)` need a bus with `register`, such as the default. */
  readonly commandBus?: Provided<CommandBus>;
  readonly queryBus?: Provided<QueryBus>;
  readonly eventBus?: Provided<EventBus>;
  /** Defaults to the event bus. An outbox goes here. */
  readonly eventPublisher?: Provided<IntegrationEventPublisher>;
  /** Defaults to the event bus. A broker adapter goes here. */
  readonly eventSubscriber?: Provided<IntegrationEventSubscriber>;
  readonly processedEvents?: Provided<ProcessedEventStore>;
}

/**
 * Binds the kernel tokens to in-process defaults: system clock, UUIDs, in-memory buses, a
 * command bus running every command in the unit of work. Replace one through the options,
 * or from a later module with `builder.rebind(TOKEN)`.
 */
export function kernelModule(options: KernelModuleOptions = {}): ContextModule {
  return defineContextModule({
    name: 'kernel',
    register(builder) {
      builder.bind(CLOCK).toFactory(either(options.clock, () => new SystemClock()));
      builder.bind(ID_GENERATOR).toFactory(either(options.ids, () => new UuidGenerator()));
      builder.bind(UNIT_OF_WORK).toFactory(either(options.unitOfWork, () => new InMemoryUnitOfWork()));
      builder.bind(COMMAND_BUS).toFactory(either(options.commandBus, transactionalCommandBus));
      builder.bind(QUERY_BUS).toFactory(either(options.queryBus, () => new InMemoryQueryBus()));
      builder.bind(EVENT_BUS).toFactory(either(options.eventBus, () => new InMemoryEventBus()));
      builder.bind(EVENT_PUBLISHER).toFactory(either(options.eventPublisher, (resolve) => resolve(EVENT_BUS)));
      builder.bind(EVENT_SUBSCRIBER).toFactory(either(options.eventSubscriber, (resolve) => resolve(EVENT_BUS)));
      builder
        .bind(PROCESSED_EVENTS)
        .toFactory(either(options.processedEvents, () => new InMemoryProcessedEventStore()));
    },
  });
}

function either<T>(provided: Provided<T> | undefined, fallback: (resolve: Resolve) => T): (resolve: Resolve) => T {
  if (provided === undefined) return fallback;
  return isFactory(provided) ? provided : () => provided;
}

function isFactory<T>(provided: Provided<T>): provided is (resolve: Resolve) => T {
  return typeof provided === 'function';
}

/**
 * The unit of work is resolved at each command, not when the bus is built: the application
 * resolves the bus at creation to attach the handlers, and that must not open a database.
 */
export function transactionalCommandBus(resolve: Resolve): InMemoryCommandBus {
  return new InMemoryCommandBus().use(
    unitOfWorkMiddleware({ run: (work) => resolve(UNIT_OF_WORK).run(work) }),
  );
}
