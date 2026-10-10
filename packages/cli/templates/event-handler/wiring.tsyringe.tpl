@@imports
import { DomainEventDispatcher } from '@ddd-ts-kit/kernel';
import { {{event.pascal}}EventHandler } from './application/event-handlers/{{event.kebab}}.event-handler.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@registrations
builder.bind({{event.pascal}}EventHandler).toClass({{event.pascal}}EventHandler).as('domain-event-handler');
@@start
{{#if handler.afterCommit}}
resolve(DomainEventDispatcher).on(
  '{{event.name}}',
  async (event) => {
    if (event instanceof {{event.pascal}}) {
      await resolve({{event.pascal}}EventHandler).handle(event);
    }
  },
  { phase: 'after-commit' },
);
{{/if}}
{{#unless handler.afterCommit}}
resolve(DomainEventDispatcher).on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) {
    await resolve({{event.pascal}}EventHandler).handle(event);
  }
});
{{/unless}}
