@@imports
{{#if consumer.declarative}}
import { COMMAND_BUS } from '@ddd-ts-kit/di';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#if consumer.transactional}}
import { COMMAND_BUS, EXECUTION_SCOPE, PROCESSED_EVENTS, UNIT_OF_WORK } from '@ddd-ts-kit/di';
import { consume, subscribeAll } from '@ddd-ts-kit/events';
import { CONTEXT_EVENTS } from '{{paths.contextToPlatform}}/platform.module.js';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#if consumer.untyped}}
{{#if broker.external}}
import { COMMAND_BUS, EXECUTION_SCOPE, PROCESSED_EVENTS } from '@ddd-ts-kit/di';
import { CONTEXT_EVENTS } from '{{paths.contextToPlatform}}/platform.module.js';
{{/if}}
{{#unless broker.external}}
import { COMMAND_BUS, EVENT_SUBSCRIBER, EXECUTION_SCOPE, PROCESSED_EVENTS } from '@ddd-ts-kit/di';
{{/unless}}
import { idempotent, inEventScope } from '@ddd-ts-kit/kernel';
{{/if}}
import { {{name.pascal}}Consumer } from './application/integration/consumers/{{name.kebab}}.consumer.js';
{{#unless consumer.declarative}}
@@tokens
export const {{name.constant}}_CONSUMER = token<{{name.pascal}}Consumer>('{{context.kebab}}.{{name.pascal}}Consumer');
{{/unless}}
@@registrations
{{#if consumer.declarative}}
builder.on({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}' }).handledBy({{name.pascal}}Consumer, [COMMAND_BUS]);
{{/if}}
{{#unless consumer.declarative}}
builder.bind({{name.constant}}_CONSUMER).toClass({{name.pascal}}Consumer, [COMMAND_BUS]).as('consumer');
@@start
{{/unless}}
{{#if consumer.transactional}}
subscribeAll(resolve(CONTEXT_EVENTS)('{{context.kebab}}'), [
  consume({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}', processed: resolve(PROCESSED_EVENTS), unitOfWork: resolve(UNIT_OF_WORK), scope: resolve(EXECUTION_SCOPE) }, (event) => resolve({{name.constant}}_CONSUMER).handle(event)),
]);
{{/if}}
{{#if consumer.untyped}}
{{consumer.subscriber}}.subscribe(
  {{name.pascal}}Consumer.eventType,
  idempotent('{{context.kebab}}.{{name.kebab}}', resolve(PROCESSED_EVENTS), inEventScope(resolve(EXECUTION_SCOPE), { consumer: '{{context.kebab}}.{{name.kebab}}' }, (event) => resolve({{name.constant}}_CONSUMER).handle(event))),
);
{{/if}}
