import { OutboxRelay, type OutboxStore, type RelaySignal } from '@ddd-ts-kit/events';
import { DeadLetterReports, NoopErrorReporter, SystemClock, type ErrorReporter, type IntegrationEventPublisher, type Logger } from '@ddd-ts-kit/kernel';

export interface OutboxRelayOptions {
  readonly store: OutboxStore;
  /** The provider events are delivered to once their command has committed. */
  readonly publisher: IntegrationEventPublisher;
  readonly intervalMs: number;
  /** How many times a publication is tried before its record is declared dead; left out, the default of the relay. */
  readonly maxAttempts?: number;
  readonly logger: Logger;
  /** Where an event whose publication the relay declares dead is reported; left out (the tests), nowhere. */
  readonly errors?: ErrorReporter;
  /** Wakes the relay as soon as an event is stored; the interval stays as the safety net. */
  readonly wakeOn?: RelaySignal;
}

export interface RunningRelay {
  stop(): Promise<void>;
}

export function startOutboxRelay(options: OutboxRelayOptions): RunningRelay {
  const deadLetters = new DeadLetterReports(options.errors ?? new NoopErrorReporter());

  const relay = new OutboxRelay({
    store: options.store,
    publisher: options.publisher,
    clock: new SystemClock(),
    ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts }),
    ...(options.wakeOn === undefined ? {} : { wakeOn: options.wakeOn }),
    // Codes only reach this hook, never messages: it is safe to log as is.
    onFailure: (failure) => {
      options.logger.error('outbox relay failure', { ...failure });
      deadLetters.onFailure(failure);
    },
  });

  relay.start({ intervalMs: options.intervalMs });

  return { stop: async () => relay.stop() };
}
