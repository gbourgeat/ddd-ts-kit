import type { Actor, ExecutionScope, IntegrationEvent } from '@ddd-ts-kit/kernel';

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
