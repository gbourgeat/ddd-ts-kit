import type { Actor } from '../actor/actor.js';
import type { IntegrationEvent } from './integration-event.js';

export interface EventExecutionOptions {
  /** Stable name of the consumer: the handler runs as `systemActor(consumer)`. */
  readonly consumer: string;
  /**
   * The actor an event names, for a project whose envelopes carry a reference to one. The
   * standard envelope carries none, so that no personal data travels by default.
   */
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
}
