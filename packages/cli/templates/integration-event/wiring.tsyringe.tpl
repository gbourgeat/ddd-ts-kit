@@imports
import { DomainEventDispatcher, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { {{publisher.pascal}}Publisher } from '{{alias.context}}/application/integration/publishers/{{publisher.kebab}}.publisher.js';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event.js';
@@registrations
builder.bind({{publisher.pascal}}Publisher).toClass({{publisher.pascal}}Publisher, [IntegrationEventPublisher, IdGenerator]).as('domain-event-handler');
@@start
resolve(DomainEventDispatcher).on('{{event.name}}', async (event) => {
  if (event instanceof {{event.pascal}}) {
    await resolve({{publisher.pascal}}Publisher).handle(event);
  }
});
