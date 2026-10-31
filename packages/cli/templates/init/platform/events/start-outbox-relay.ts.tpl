import { OutboxRelay, type OutboxStore{{#if events.wakeable}}, type RelaySignal{{/if}} } from '@ddd-ts-kit/events';
{{#if errors.none}}
import { SystemClock, type IntegrationEventPublisher, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if errors.sentry}}
import {
  DeadLetterReports,
  NoopErrorReporter,
  SystemClock,
  type ErrorReporter,
  type IntegrationEventPublisher,
  type Logger,
  type Metrics,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#if broker.kafka}}
import { aggregateKeyOf } from '{{alias.platform}}/events/aggregate-key-of{{alias.ext}}';
{{/if}}

export interface OutboxRelayOptions {
  readonly store: OutboxStore;
  /** The provider events are delivered to once their command has committed. */
  readonly publisher: IntegrationEventPublisher;
  readonly intervalMs: number;
  /** How many times a publication is tried before its record is declared dead; left out, the default of the relay. */
  readonly maxAttempts?: number;
  readonly logger: Logger;
  /** Where the depth of the outbox goes after each tick (`outbox_pending`, `outbox_failed`, `outbox_dead`); left out (the tests), nowhere. */
  readonly metrics?: Metrics;
{{#if errors.sentry}}
  /** Where an event whose publication the relay declares dead is reported; left out (the tests), nowhere. */
  readonly errors?: ErrorReporter;
{{/if}}
{{#if events.wakeable}}
  /** Wakes the relay as soon as an event is stored; the interval stays as the safety net. */
  readonly wakeOn?: RelaySignal;
{{/if}}
}

export interface RunningRelay {
  stop(): Promise<void>;
}

export function startOutboxRelay(options: OutboxRelayOptions): RunningRelay {
{{#if errors.sentry}}
  const deadLetters = new DeadLetterReports(options.errors ?? new NoopErrorReporter());

{{/if}}
  const relay = new OutboxRelay({
    store: options.store,
    publisher: options.publisher,
    clock: new SystemClock(),
    ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts }),
    ...(options.metrics === undefined ? {} : { metrics: options.metrics }),
{{#if broker.kafka}}
    // The events of one aggregate leave in the order they were stored, under the key Kafka orders them by: it takes a single running relay.
    ordering: 'per-key',
    keyOf: aggregateKeyOf,
{{/if}}
{{#if events.wakeable}}
    ...(options.wakeOn === undefined ? {} : { wakeOn: options.wakeOn }),
{{/if}}
    // Codes only reach this hook, never messages: it is safe to log as is.
{{#if errors.none}}
    onFailure: (failure) => options.logger.error('outbox relay failure', { ...failure }),
{{/if}}
{{#if errors.sentry}}
    onFailure: (failure) => {
      options.logger.error('outbox relay failure', { ...failure });
      deadLetters.onFailure(failure);
    },
{{/if}}
  });

  relay.start({ intervalMs: options.intervalMs });

  return { stop: async () => relay.stop() };
}
