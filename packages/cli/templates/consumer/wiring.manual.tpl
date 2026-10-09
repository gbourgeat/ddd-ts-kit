@@imports
{{#if consumer.declarative}}
import { on, subscribeAll } from '@ddd-ts-kit/events';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#if consumer.transactional}}
import { consume, subscribeAll } from '@ddd-ts-kit/events';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#if consumer.untyped}}
import { idempotent, inEventScope } from '@ddd-ts-kit/kernel';
{{/if}}
import { {{name.pascal}}Consumer } from './application/integration/consumers/{{name.kebab}}.consumer.js';
@@registrations
const {{name.camel}}Consumer = new {{name.pascal}}Consumer(platform.commands);
{{#if consumer.declarative}}
subscribeAll({{consumer.subscriber}}, [
  on({{name.camel}}Definition, (event) => {{name.camel}}Consumer.handle(event), { consumer: '{{context.kebab}}.{{name.kebab}}', processed: platform.persistence.processedEvents, scope: platform.scope }),
]);
{{/if}}
{{#if consumer.transactional}}
subscribeAll({{consumer.subscriber}}, [
  consume({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}', processed: platform.persistence.processedEvents, unitOfWork: platform.persistence.unitOfWork, scope: platform.scope }, (event) => {{name.camel}}Consumer.handle(event)),
]);
{{/if}}
{{#if consumer.untyped}}
{{consumer.subscriber}}.subscribe(
  {{name.pascal}}Consumer.eventType,
  idempotent('{{context.kebab}}.{{name.kebab}}', platform.persistence.processedEvents, inEventScope(platform.scope, { consumer: '{{context.kebab}}.{{name.kebab}}' }, (event) => {{name.camel}}Consumer.handle(event))),
);
{{/if}}
