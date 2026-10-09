@@imports
import { DOMAIN_EVENTS } from '{{paths.contextToPlatform}}/platform.module.js';
import { {{event.pascal}}EventHandler } from './application/event-handlers/{{event.kebab}}.event-handler.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@tokens
export const {{event.constant}}_EVENT_HANDLER = token<{{event.pascal}}EventHandler>('{{context.kebab}}.{{event.pascal}}EventHandler');
@@registrations
builder.bind({{event.constant}}_EVENT_HANDLER).toClass({{event.pascal}}EventHandler);
@@start
resolve(DOMAIN_EVENTS).on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) await resolve({{event.constant}}_EVENT_HANDLER).handle(event);
});
