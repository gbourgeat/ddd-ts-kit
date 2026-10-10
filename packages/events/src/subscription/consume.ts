import type { IntegrationEvent, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import type { IntegrationEventDefinition } from '../definition/integration-event-definition.js';
import type { EventScopeOptions } from './event-scope-options.js';
import type { EventSubscription } from './event-subscription.js';
import { on } from './on.js';

export interface ConsumeOptions extends EventScopeOptions {
  /** Name of the consuming context or handler: the idempotency scope. */
  readonly consumer: string;
  readonly processed: ProcessedEventStore;
  /** The unit of work the mark and the state change of the handler commit in. */
  readonly unitOfWork: UnitOfWork;
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
