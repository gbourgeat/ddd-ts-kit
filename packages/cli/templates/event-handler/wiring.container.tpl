@@imports
import { {{#unless handler.afterCommit}}CommandBus, {{/unless}}DomainEventDispatcher } from '@ddd-ts-kit/kernel';
import { {{handler.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{handler.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
@@registrations
builder.bind({{handler.pascal}}EventHandler).toClass({{handler.pascal}}EventHandler{{#unless handler.afterCommit}}, [CommandBus]{{/unless}}).as('domain-event-handler');
@@start
{{#if handler.afterCommit}}
resolve(DomainEventDispatcher).on(
  {{event.reference}},
  async (event) => {
    if (event instanceof {{event.pascal}}) {
      await resolve({{handler.pascal}}EventHandler).handle(event);
    }
  },
  { phase: 'after-commit' },
);
{{/if}}
{{#unless handler.afterCommit}}
resolve(DomainEventDispatcher).on({{event.reference}}, async (event) => {
  if (event instanceof {{event.pascal}}) {
    await resolve({{handler.pascal}}EventHandler).handle(event);
  }
});
{{/unless}}
