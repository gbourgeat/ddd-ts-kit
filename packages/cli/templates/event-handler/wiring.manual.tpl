@@imports
import { {{handler.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{handler.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
@@reactions
const {{handler.camel}}EventHandler = platform.adapter(new {{handler.pascal}}EventHandler(), { kind: 'domain-event-handler', context: '{{context.kebab}}' });

{{#if handler.afterCommit}}
platform.domainEvents.on(
  {{event.reference}},
  async (event) => {
    if (event instanceof {{event.pascal}}) {
      await {{handler.camel}}EventHandler.handle(event);
    }
  },
  { phase: 'after-commit' },
);
{{/if}}
{{#unless handler.afterCommit}}
platform.domainEvents.on({{event.reference}}, async (event) => {
  if (event instanceof {{event.pascal}}) {
    await {{handler.camel}}EventHandler.handle(event);
  }
});
{{/unless}}
