@@imports
import { {{publisher.pascal}}Publisher } from '{{alias.context}}/application/integration/publishers/{{publisher.kebab}}.publisher{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
@@registrations
const {{publisher.camel}}Publisher = platform.adapter(new {{publisher.pascal}}Publisher(platform.publisher, platform.ids), { kind: 'domain-event-handler', context: '{{context.kebab}}' });

platform.domainEvents.on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) {
    await {{publisher.camel}}Publisher.handle(event);
  }
});
