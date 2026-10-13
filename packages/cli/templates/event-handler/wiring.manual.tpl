@@imports
import { {{event.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{event.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
@@registrations
const {{event.camel}}EventHandler = platform.adapter(new {{event.pascal}}EventHandler(), { kind: 'domain-event-handler', context: '{{context.kebab}}' });

{{#if handler.afterCommit}}
platform.domainEvents.on(
  {{event.reference}},
  async (event) => {
    if (event instanceof {{event.pascal}}) {
      await {{event.camel}}EventHandler.handle(event);
    }
  },
  { phase: 'after-commit' },
);
{{/if}}
{{#unless handler.afterCommit}}
platform.domainEvents.on({{event.reference}}, async (event) => {
  if (event instanceof {{event.pascal}}) {
    await {{event.camel}}EventHandler.handle(event);
  }
});
{{/unless}}
