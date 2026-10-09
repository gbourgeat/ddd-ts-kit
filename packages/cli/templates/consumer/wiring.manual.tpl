@@imports
{{#if upstream.known}}
import { on, subscribeAll } from '@ddd-ts-kit/events';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#unless upstream.known}}
import { idempotent } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{name.pascal}}Consumer } from './application/integration/consumers/{{name.kebab}}.consumer.js';
@@registrations
const {{name.camel}}Consumer = new {{name.pascal}}Consumer(platform.commands);
{{#if upstream.known}}
subscribeAll(platform.subscriber, [
  on({{name.camel}}Definition, (event) => {{name.camel}}Consumer.handle(event), { consumer: '{{context.kebab}}.{{name.kebab}}', processed: platform.persistence.processedEvents }),
]);
{{/if}}
{{#unless upstream.known}}
platform.subscriber.subscribe(
  {{name.pascal}}Consumer.eventType,
  idempotent('{{context.kebab}}.{{name.kebab}}', platform.persistence.processedEvents, (event) => {{name.camel}}Consumer.handle(event)),
);
{{/unless}}
