{{#if errors.broker}}
import { DeadLetterReports, NoopErrorReporter, type ErrorReporter } from '@ddd-ts-kit/kernel';
{{/if}}
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';
import type { AppConfig } from '../config/app-config.js';
import type { EventProvider } from './event-provider.js';

/**
 * Redis Streams, on Redis, Dragonfly or Valkey: the relay of the outbox appends to one stream per
 * event type and marks a record published once the server answered its entry, each consuming
 * context reads through a consumer group of its own name and acknowledges after its unit of work
 * committed. The server is the one of `REDIS_URL`, shared with whatever else the platform keeps there.
 */
{{#unless errors.broker}}
export function createEventProvider(config: AppConfig): EventProvider {
{{/unless}}
{{#if errors.broker}}
export function createEventProvider(config: AppConfig, errors: ErrorReporter = new NoopErrorReporter()): EventProvider {
  // An event the broker gives up (retries exhausted, poison message) is reported; a delivery that fails and is retried is not.
  const deadLetters = new DeadLetterReports(errors);

{{/if}}
  const bus = new RedisStreamsEventBus({
    connection: config.redisUrl,
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
