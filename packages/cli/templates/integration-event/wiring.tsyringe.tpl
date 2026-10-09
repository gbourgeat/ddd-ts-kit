@@imports
import { EVENT_PUBLISHER, ID_GENERATOR } from '@ddd-ts-kit/di';
import { DOMAIN_EVENTS } from '{{paths.contextToPlatform}}/platform.module.js';
import { {{publisher.pascal}}Publisher } from './application/integration/publishers/{{publisher.kebab}}.publisher.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@tokens
export const {{publisher.constant}}_PUBLISHER = token<{{publisher.pascal}}Publisher>('{{context.kebab}}.{{publisher.pascal}}Publisher');
@@registrations
builder.bind({{publisher.constant}}_PUBLISHER).toClass({{publisher.pascal}}Publisher, [EVENT_PUBLISHER, ID_GENERATOR]);
@@start
resolve(DOMAIN_EVENTS).on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) await resolve({{publisher.constant}}_PUBLISHER).publish(event);
});
