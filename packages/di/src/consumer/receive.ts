import {
  executionContextOfEvent,
  idempotent,
  type IntegrationEvent,
  type IntegrationEventCallback,
} from '@ddd-ts-kit/kernel';
import type { EventContract } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerOptions } from './consumer-options';
import type { ConsumerRuntime } from './consumer-runtime';
import { UnreadableEventError } from './unreadable-event-error';

interface Reception<Payload> {
  readonly contract: EventContract<Payload>;
  readonly options: ConsumerOptions;
  readonly runtime: ConsumerRuntime;
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}

/**
 * The handler to subscribe for one consumer. Another version of the same type is skipped
 * (it has its own contract); an unreadable event throws so that the provider retries or
 * dead-letters it instead of losing it silently. With a scope, the consumer runs in the
 * execution context of the event: origin `event`, its correlation, the event as cause. With a
 * processed-event store and a unit of work, the idempotency mark and the work of the handler
 * are one unit of work: a handler that fails leaves no mark, and its event is handled again.
 */
export function receive<Payload>(reception: Reception<Payload>): IntegrationEventCallback {
  const { contract, options, runtime, handle } = reception;
  const { scope } = runtime;

  return async (event) => {
    const parsed = contract.parse(event);

    if (!parsed.ok) {
      rejectUnlessMeantForAnother(event, parsed.error.reason);

      return;
    }

    // Marked only once the event is known to be valid, so a skipped or rejected delivery
    // never consumes the idempotency key.
    const once = (): Promise<void> => handledOnce(event, reception, () => handle(parsed.value));

    await (scope === undefined ? once() : scope.run(executionContextOfEvent(event, options), once));
  };
}

const MEANT_FOR_ANOTHER = new Set(['type-mismatch', 'version-mismatch']);

function rejectUnlessMeantForAnother(event: IntegrationEvent, reason: string): void {
  if (!MEANT_FOR_ANOTHER.has(reason)) {
    throw new UnreadableEventError(event.type, event.version, reason);
  }
}

function handledOnce<Payload>(
  event: IntegrationEvent,
  { options, runtime }: Reception<Payload>,
  deliver: () => Promise<void>,
): Promise<void> {
  const { processed, unitOfWork } = runtime;

  if (processed === undefined) {
    return deliver();
  }

  const marked = (): Promise<void> => idempotent(options.consumer, processed, deliver)(event);

  return unitOfWork === undefined ? marked() : unitOfWork.run(marked);
}
