@@imports
{{#if upstream.known}}
import { CommandBus } from '@ddd-ts-kit/kernel';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index{{alias.ext}}';
{{/if}}
{{#unless upstream.known}}
import { CommandBus, EventSubscribers, ExecutionScope, ProcessedEventStore, idempotent, inEventScope } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{name.pascal}}IntegrationHandler } from '{{alias.context}}/application/integration/handlers/{{name.kebab}}.integration-handler{{alias.ext}}';
@@registrations
{{#if upstream.known}}
builder.on({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}' }).handledBy({{name.pascal}}IntegrationHandler, [CommandBus]);
{{/if}}
{{#unless upstream.known}}
builder.bind({{name.pascal}}IntegrationHandler).toClass({{name.pascal}}IntegrationHandler, [CommandBus]).as('consumer');
@@start
resolve(EventSubscribers)
  .forContext('{{context.kebab}}')
  .subscribe(
    {{name.pascal}}IntegrationHandler.eventType,
    idempotent('{{context.kebab}}.{{name.kebab}}', resolve(ProcessedEventStore), inEventScope(resolve(ExecutionScope), { consumer: '{{context.kebab}}.{{name.kebab}}' }, (event) => resolve({{name.pascal}}IntegrationHandler).handle(event))),
  );
{{/unless}}
