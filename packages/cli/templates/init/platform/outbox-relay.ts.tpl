import { OutboxRelay, type OutboxStore{{#if events.wakeable}}, type RelaySignal{{/if}} } from '@ddd-ts-kit/events';
import { SystemClock, type IntegrationEventPublisher, type Logger } from '@ddd-ts-kit/kernel';

export interface OutboxRelayOptions {
  readonly store: OutboxStore;
  /** The provider events are delivered to once their command has committed. */
  readonly publisher: IntegrationEventPublisher;
  readonly intervalMs: number;
  readonly logger: Logger;
{{#if events.wakeable}}
  /** Wakes the relay as soon as an event is stored; the interval stays as the safety net. */
  readonly wakeOn?: RelaySignal;
{{/if}}
}

export interface RunningRelay {
  stop(): Promise<void>;
}

export function startOutboxRelay(options: OutboxRelayOptions): RunningRelay {
  const relay = new OutboxRelay({
    store: options.store,
    publisher: options.publisher,
    clock: new SystemClock(),
{{#if events.wakeable}}
    ...(options.wakeOn === undefined ? {} : { wakeOn: options.wakeOn }),
{{/if}}
    // Codes only reach this hook, never messages: it is safe to log as is.
    onFailure: (failure) => options.logger.error('outbox relay failure', { ...failure }),
  });
  relay.start({ intervalMs: options.intervalMs });
  return { stop: async () => relay.stop() };
}
