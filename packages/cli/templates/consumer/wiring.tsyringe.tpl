@@imports
{{#if upstream.known}}
import { COMMAND_BUS } from '@ddd-ts-kit/di';
import { {{upstream.definition}} as {{name.camel}}Definition } from '{{upstream.moduleImport}}';
{{/if}}
{{#unless upstream.known}}
import { COMMAND_BUS, EVENT_SUBSCRIBER, PROCESSED_EVENTS } from '@ddd-ts-kit/di';
import { idempotent } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{name.pascal}}Consumer } from './application/integration/consumers/{{name.kebab}}.consumer.js';
{{#unless upstream.known}}
@@tokens
export const {{name.constant}}_CONSUMER = token<{{name.pascal}}Consumer>('{{context.kebab}}.{{name.pascal}}Consumer');
{{/unless}}
@@registrations
{{#if upstream.known}}
builder.on({{name.camel}}Definition, { consumer: '{{context.kebab}}.{{name.kebab}}' }).handledBy({{name.pascal}}Consumer, [COMMAND_BUS]);
{{/if}}
{{#unless upstream.known}}
builder.bind({{name.constant}}_CONSUMER).toClass({{name.pascal}}Consumer, [COMMAND_BUS]).as('consumer');
@@start
resolve(EVENT_SUBSCRIBER).subscribe(
  {{name.pascal}}Consumer.eventType,
  idempotent('{{context.kebab}}.{{name.kebab}}', resolve(PROCESSED_EVENTS), (event) => resolve({{name.constant}}_CONSUMER).handle(event)),
);
{{/unless}}
