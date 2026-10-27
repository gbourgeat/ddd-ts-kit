@@imports
{{#if consumer.declarative}}
import { on, subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
{{#if consumer.transactional}}
import { consume, subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
import { {{event.definition}} as {{name.camel}}Definition } from '{{alias.contexts}}/{{publisher.kebab}}/published-language{{alias.index}}';
import { {{name.pascal}}Projection } from '{{alias.context}}/application/projections/{{name.kebab}}.projection{{alias.ext}}';
@@reactions
const {{name.camel}}Projection = new {{name.pascal}}Projection();

{{#if consumer.declarative}}
subscribeAll({{consumer.subscriber}}, [
  on({{name.camel}}Definition, (event) => {{name.camel}}Projection.{{event.method}}(event), { consumer: '{{context.kebab}}.{{name.kebab}}', processed: platform.persistence.processedEvents, scope: platform.scope }),
]);
{{/if}}
{{#if consumer.transactional}}
subscribeAll({{consumer.subscriber}}, [
  consume({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}', processed: platform.persistence.processedEvents, unitOfWork: platform.persistence.unitOfWork, scope: platform.scope }, (event) => {{name.camel}}Projection.{{event.method}}(event)),
]);
{{/if}}
