import { systemActor, type Actor } from './actor.js';
import { executionContext, type ExecutionContext, type ExecutionScope } from './execution-context.js';
import type {
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventPublisher,
} from './integration-event.js';

export interface EventExecutionOptions {
  /** Stable name of the consumer: the handler runs as `systemActor(consumer)`. */
  readonly consumer: string;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * standard envelope carries none, so that no personal data travels by default.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}

/**
 * The execution context of a consumed event: origin `event`, the correlation of the event (its
 * own id when it names none, which starts a new chain), and the event as the direct cause.
 */
export function executionContextOfEvent(
  event: IntegrationEvent,
  options: EventExecutionOptions,
): ExecutionContext {
  return executionContext({
    correlationId: event.correlationId ?? event.id,
    causationId: event.id,
    actor: options.actorOf?.(event) ?? systemActor(options.consumer),
    origin: 'event',
  });
}

/** Wraps a handler so that every event it receives is handled inside `scope.run`. */
export function inEventScope(
  scope: ExecutionScope,
  options: EventExecutionOptions,
  handler: IntegrationEventCallback,
): IntegrationEventCallback {
  return (event) => scope.run(executionContextOfEvent(event, options), () => handler(event));
}

/**
 * Decorates a publisher: an event published without `correlationId` takes the one of the work
 * in progress, so everything one stimulus causes can be found again. An event that names its
 * correlation keeps it, and outside of any execution context nothing is stamped.
 */
export function scopedPublisher(
  publisher: IntegrationEventPublisher,
  scope: ExecutionScope,
): IntegrationEventPublisher {
  return {
    publish: (events) => publisher.publish(events.map((event) => correlated(event, scope.current()))),
  };
}

function correlated(event: IntegrationEvent, context: ExecutionContext | undefined): IntegrationEvent {
  if (event.correlationId !== undefined || context === undefined) return event;
  return { ...event, correlationId: context.correlationId };
}
