@@imports
import { {{event.pascal}}EventHandler } from './application/event-handlers/{{event.kebab}}.event-handler.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@registrations
const {{event.camel}}EventHandler = platform.adapter(new {{event.pascal}}EventHandler(), { kind: 'domain-event-handler', context: '{{context.kebab}}' });

platform.domainEvents.on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) await {{event.camel}}EventHandler.handle(event);
}{{#if handler.afterCommit}}, { phase: 'after-commit' }{{/if}});
