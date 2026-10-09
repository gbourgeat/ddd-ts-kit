import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { SystemClock, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export interface OutboxRelayOptions {
  readonly store: OutboxStore;
  /** The provider events are delivered to once their command has committed. */
  readonly publisher: IntegrationEventPublisher;
  readonly intervalMs: number;
}

export interface RunningRelay {
  stop(): Promise<void>;
}

export function startOutboxRelay(options: OutboxRelayOptions): RunningRelay {
  const relay = new OutboxRelay({
    store: options.store,
    publisher: options.publisher,
    clock: new SystemClock(),
    // Codes only reach this hook, never messages: it is safe to log as is.
    onFailure: (failure) => console.error(JSON.stringify({ level: 'error', message: 'outbox relay failure', ...failure })),
  });
  relay.start({ intervalMs: options.intervalMs });
  return { stop: async () => relay.stop() };
}
