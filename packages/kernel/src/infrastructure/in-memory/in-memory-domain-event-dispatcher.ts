import type { AfterCommitFailure } from '../../application/events/after-commit-failure.js';
import type { DomainEventCallback } from '../../application/events/domain-event-callback.js';
import type { DomainEventPhase } from '../../application/events/domain-event-phase.js';
import type { DomainEventSubscription } from '../../application/events/domain-event-subscription.js';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher.js';
import type { DomainEvent } from '../../domain/domain-event.js';

/**
 * Calls the callbacks in process, in registration order. A failure of the `after-commit` phase
 * is kept in `afterCommitFailures`, the last hundred of them, and told to `failed`: give it
 * `reportAfterCommitFailures(...)` wherever a logger and an error reporter exist.
 */
export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  /** What `after-commit` handlers threw, oldest first, for a spec to assert. */
  readonly afterCommitFailures: { readonly error: unknown; readonly event: DomainEvent }[] = [];

  private readonly handlers = new Map<string, DomainEventCallback[]>();

  constructor(private readonly failed?: AfterCommitFailure) {}

  on(name: string, handler: DomainEventCallback, subscription: DomainEventSubscription = {}): void {
    const key = keyOf(subscription.phase ?? 'before-commit', name);

    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
  }

  async dispatch(events: readonly DomainEvent[], phase: DomainEventPhase = 'before-commit'): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(keyOf(phase, event.name)) ?? []) {
        if (phase === 'before-commit') {
          await handler(event);
        } else {
          await this.attempted(handler, event);
        }
      }
    }
  }

  private async attempted(handler: DomainEventCallback, event: DomainEvent): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      this.afterCommitFailures.push({ error, event });

      if (this.afterCommitFailures.length > KEPT_FAILURES) {
        this.afterCommitFailures.shift();
      }

      this.tell(error, event);
    }
  }

  private tell(error: unknown, event: DomainEvent): void {
    try {
      this.failed?.(error, event);
    } catch {
      return;
    }
  }
}

const KEPT_FAILURES = 100;

function keyOf(phase: DomainEventPhase, name: string): string {
  return `${phase} ${name}`;
}
