import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { PROVIDED_BROKERS } from './provided-brokers.js';
import { WITH_DATABASE } from './with-database.js';

/** How integration events leave a use case, and what `main.ts` calls to get the event provider of the chosen broker. */
export function eventVars(config: Config): RenderContext {
  const { events } = config.stack;

  return { outbox: events === 'outbox', inMemory: events !== 'outbox', wakeable: wakesTheRelay(config), ...providerVars(config) };
}

/** Whether something can wake the outbox relay before its next poll: the in-memory store, or a Redis protocol server. */
function wakesTheRelay(config: Config): boolean {
  const { orm, events, cache } = config.stack;

  return events === 'outbox' && (!WITH_DATABASE.includes(orm) || cache === 'redis');
}

/** A provided broker is handed the error reporter of the project that has one: the events it gives up are reported. */
function providerVars(config: Config): RenderContext {
  const { broker, errors } = config.stack;

  if (broker === 'none') return { providerName: 'inProcessEvents', providerFile: 'in-process-events', provider: 'inProcessEvents()' };

  const given = errors === 'sentry' ? 'config, errors' : 'config';
  const provider = PROVIDED_BROKERS.includes(broker) ? `createEventProvider(${given})` : 'createEventProvider()';

  return { providerName: 'createEventProvider', providerFile: 'create-event-provider', provider };
}
