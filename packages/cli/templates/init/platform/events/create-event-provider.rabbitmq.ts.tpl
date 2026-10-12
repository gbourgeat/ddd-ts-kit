{{#if errors.broker}}
import { DeadLetterReports, NoopErrorReporter, type ErrorReporter } from '@ddd-ts-kit/kernel';
{{/if}}
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';

/**
 * RabbitMQ: the relay of the outbox publishes with publisher confirms, each consuming context
 * reads its own durable queues and acknowledges after its unit of work committed.
 */
{{#unless errors.broker}}
export function createEventProvider(config: AppConfig): EventProvider {
{{/unless}}
{{#if errors.broker}}
export function createEventProvider(config: AppConfig, errors: ErrorReporter = new NoopErrorReporter()): EventProvider {
  // An event the broker gives up (retries exhausted, poison message) is reported; a delivery that fails and is retried is not.
  const deadLetters = new DeadLetterReports(errors);

{{/if}}
  const bus = new RabbitMqEventBus({
    connection: config.amqpUrl,
    // Codes only reach this hook, never messages: it is safe to log as is.
{{#unless errors.broker}}
    onFailure: (failure) => console.error(JSON.stringify({ level: 'error', message: 'event bus failure', ...failure })),
{{/unless}}
{{#if errors.broker}}
    onFailure: (failure) => {
      console.error(JSON.stringify({ level: 'error', message: 'event bus failure', ...failure }));
      deadLetters.onFailure(failure);
    },
{{/if}}
  });

  return {
    bus,
{{#unless errors.broker}}
    forConsumer: (name) => bus.forConsumer(name),
{{/unless}}
{{#if errors.broker}}
    // Remembers what a handler threw, so that the report of an event given up carries the real error and its stack.
    forConsumer: (name) => deadLetters.observing(bus.forConsumer(name)),
{{/if}}
    // Fails at startup, not at the first message.
    start: () => bus.assertTopology(),
    close: () => bus.close(),
  };
}
