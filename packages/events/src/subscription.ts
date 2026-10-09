import {
  executionContextOfEvent,
  type Actor,
  type ExecutionScope,
  type IntegrationEvent,
  type IntegrationEventHandler,
  type IntegrationEventSubscriber,
  type ProcessedEventStore,
  type Subscription,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { InvalidEventPayloadError, type IntegrationEventDefinition } from './definition.js';

export interface EventSubscription {
  readonly type: string;
  readonly handler: IntegrationEventHandler;
}

/** How a consumed event becomes the execution context of its handler. */
export interface EventScopeOptions {
  /**
   * When given, the handler, its idempotency mark and its unit of work run inside
   * `scope.run(...)`: origin `event`, the correlation of the event (its id when it names
   * none), the event as cause, and the consumer as system actor.
   */
  readonly scope?: ExecutionScope;
  /** The actor an event names, for a project whose envelopes carry a reference to one. */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}

export interface OnOptions extends EventScopeOptions {
  /** Name of the consuming context or handler: the idempotency scope. */
  readonly consumer: string;
  /** When given, a redelivered event is handled once per consumer. */
  readonly processed?: ProcessedEventStore;
  /**
   * When given with `processed`, the mark and the handler run in this one unit of work, so
   * they commit together and a failed handler takes its mark back with it.
   */
  readonly unitOfWork?: UnitOfWork;
}

export interface ConsumeOptions extends EventScopeOptions {
  /** Name of the consuming context or handler: the idempotency scope. */
  readonly consumer: string;
  readonly processed: ProcessedEventStore;
  /** The unit of work the mark and the state change of the handler commit in. */
  readonly unitOfWork: UnitOfWork;
}

/**
 * A processed-event store that can take a mark back. A store that is not transactional needs
 * it: with no rollback to erase the mark of a handler that failed, the redelivery would be
 * skipped and the event lost.
 */
export interface ReleasableProcessedEventStore extends ProcessedEventStore {
  /** Forgets `(consumer, eventId)`: the next delivery is handled again. */
  release(consumer: string, eventId: string): Promise<void>;
}

/**
 * The consumer of `events/consumer-idempotent`: deduplication and the handler run in ONE
 * unit of work, so "processed" and the state change it stands for commit or roll back
 * together. An event whose handler threw is handled again when it is redelivered.
 */
export function consume<P>(
  definition: IntegrationEventDefinition<P>,
  options: ConsumeOptions,
  handler: (event: IntegrationEvent<P>) => Promise<void>,
): EventSubscription {
  return on(definition, handler, options);
}

/**
 * Typed subscription to one version of one event. Another version of the same type is
 * skipped (subscribe to it with its own definition); an invalid payload throws so that the
 * provider retries or dead-letters instead of silently losing the event.
 *
 * With `processed` alone, the mark is taken before the handler runs and survives its failure
 * unless the store is transactional and already inside a unit of work, or is a
 * `ReleasableProcessedEventStore`. Prefer `consume`, or pass `unitOfWork`.
 */
export function on<P>(
  definition: IntegrationEventDefinition<P>,
  handler: (event: IntegrationEvent<P>) => Promise<void>,
  options?: OnOptions,
): EventSubscription {
  return {
    type: definition.type,
    handler: async (event) => {
      const parsed = definition.parse(event);
      if (!parsed.ok) {
        if (parsed.error.reason === 'invalid-payload') {
          throw new InvalidEventPayloadError(event.type, event.version, parsed.error.issues);
        }
        return;
      }
      // Deduplicated only once the event is known to be ours and valid, so a skipped or
      // rejected delivery never consumes the idempotency key.
      await inScope(event, options, () => handleOnce(event.id, options, () => handler(parsed.value)));
    },
  };
}

function inScope(
  event: IntegrationEvent,
  options: OnOptions | undefined,
  work: () => Promise<void>,
): Promise<void> {
  if (options?.scope === undefined) return work();
  return options.scope.run(executionContextOfEvent(event, options), work);
}

async function handleOnce(
  eventId: string,
  options: OnOptions | undefined,
  handle: () => Promise<void>,
): Promise<void> {
  const processed = options?.processed;
  if (options === undefined || processed === undefined) {
    await handle();
    return;
  }
  const mark = { taken: false };
  try {
    await (options.unitOfWork ?? WITHOUT_TRANSACTION).run(async () => {
      mark.taken = await processed.markProcessed(options.consumer, eventId);
      if (mark.taken) {
        await handle();
      }
    });
  } catch (error) {
    // Only a mark taken by this delivery: one left by an earlier success must stay.
    if (mark.taken && isReleasable(processed)) {
      await processed.release(options.consumer, eventId);
    }
    throw error;
  }
}

const WITHOUT_TRANSACTION: UnitOfWork = { run: (work) => work() };

function isReleasable(store: ProcessedEventStore): store is ReleasableProcessedEventStore {
  return 'release' in store && typeof store.release === 'function';
}

/** Reference releasable store, for tests and single-process apps without a database. */
export class InMemoryReleasableProcessedEventStore implements ReleasableProcessedEventStore {
  readonly #seen = new Set<string>();

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = keyOf(consumer, eventId);
    if (this.#seen.has(key)) {
      return false;
    }
    this.#seen.add(key);
    return true;
  }

  async release(consumer: string, eventId: string): Promise<void> {
    this.#seen.delete(keyOf(consumer, eventId));
  }
}

// JSON keeps the pair unambiguous: 'a:b' + 'c' must not equal 'a' + 'b:c'.
function keyOf(consumer: string, eventId: string): string {
  return JSON.stringify([consumer, eventId]);
}

/** Registers every subscription and returns one handle that removes them all. */
export function subscribeAll(
  subscriber: IntegrationEventSubscriber,
  subscriptions: readonly EventSubscription[],
): Subscription {
  const handles = subscriptions.map(({ type, handler }) => subscriber.subscribe(type, handler));
  return {
    unsubscribe: () => {
      for (const handle of handles) {
        handle.unsubscribe();
      }
    },
  };
}
