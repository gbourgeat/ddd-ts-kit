import {
  executionContextOfEvent,
  type IntegrationEvent,
  type ProcessedEventStore,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { IntegrationEventDefinition } from '../definition/integration-event-definition';
import { InvalidEventPayloadError } from '../definition/invalid-event-payload-error';
import type { EventScopeOptions } from './event-scope-options';
import type { EventSubscription } from './event-subscription';
import type { ReleasableProcessedEventStore } from './releasable-processed-event-store';

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

function inScope(event: IntegrationEvent, options: OnOptions | undefined, work: () => Promise<void>): Promise<void> {
  if (options?.scope === undefined) {
    return work();
  }

  return options.scope.run(executionContextOfEvent(event, options), work);
}

async function handleOnce(eventId: string, options: OnOptions | undefined, handle: () => Promise<void>): Promise<void> {
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
  return typeof store.release === 'function';
}
