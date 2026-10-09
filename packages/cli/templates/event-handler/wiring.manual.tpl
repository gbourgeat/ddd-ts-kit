@@imports
import { {{event.pascal}}EventHandler } from './application/event-handlers/{{event.kebab}}.event-handler.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@registrations
const {{event.camel}}EventHandler = new {{event.pascal}}EventHandler();
platform.domainEvents.on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) await {{event.camel}}EventHandler.handle(event);
});
