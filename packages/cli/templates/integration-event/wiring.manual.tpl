@@imports
import { {{publisher.pascal}}Publisher } from './application/integration/publishers/{{publisher.kebab}}.publisher.js';
import { {{event.pascal}} } from './domain/events/{{event.kebab}}.event.js';
@@registrations
const {{publisher.camel}}Publisher = new {{publisher.pascal}}Publisher(platform.publisher, platform.ids);
platform.domainEvents.on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) await {{publisher.camel}}Publisher.publish(event);
});
