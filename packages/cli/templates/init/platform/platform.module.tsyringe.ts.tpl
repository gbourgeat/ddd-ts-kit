import { defineContextModule, {{#if broker.external}}EVENT_SUBSCRIBER, {{/if}}kernelModule, token, type ContextModule } from '@ddd-ts-kit/di';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
{{#if broker.external}}
import { InMemoryDomainEventDispatcher, type DomainEventDispatcher, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless broker.external}}
import { InMemoryDomainEventDispatcher, type DomainEventDispatcher } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if events.outbox}}
import { tracedSubscriber } from '@ddd-ts-kit/tracing';
{{/if}}
{{#unless events.outbox}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
{{/unless}}
{{#if persistence.hasDatabase}}
import type { DatabaseContext } from './database/database.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';

export const DOMAIN_EVENTS = token<DomainEventDispatcher>('platform.DomainEventDispatcher');
{{#if broker.external}}
/** The subscriber of one consuming context: a broker gives each context queues of its own. */
export const CONTEXT_EVENTS = token<(context: string) => IntegrationEventSubscriber>('platform.ContextEvents');
{{/if}}
{{#if persistence.hasDatabase}}
export const DATABASE = token<DatabaseContext>('platform.Database');
{{/if}}

/**
 * The kernel tokens (clock, identifiers, buses, unit of work, event bus) on the persistence
 * of the project, then what this platform adds. Replacing a provider happens here and nowhere else.
 */
export function platformModules(persistence: Persistence, events: EventProvider): readonly ContextModule[] {
  const { bus } = events;
  const kernel = kernelModule({
    unitOfWork: persistence.unitOfWork,
    processedEvents: persistence.processedEvents,
    eventBus: bus,
{{#if events.outbox}}
    eventPublisher: new OutboxPublisher(persistence.outbox),
{{/if}}
{{#unless events.outbox}}
    eventPublisher: tracedPublisher(bus),
{{/unless}}
    eventSubscriber: tracedSubscriber(bus),
  });
  const platform = defineContextModule({
    name: 'platform',
    register(builder) {
      builder.bind(DOMAIN_EVENTS).toClass(InMemoryDomainEventDispatcher);
{{#if broker.external}}
      builder.bind(CONTEXT_EVENTS).toValue((context) => tracedSubscriber(events.subscriberFor(context)));
{{/if}}
{{#if persistence.hasDatabase}}
      builder.bind(DATABASE).toValue(persistence.database);
{{/if}}
    },
  });
  return [kernel, platform];
}

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(DOMAIN_EVENTS).toClass(InMemoryDomainEventDispatcher);
{{#if broker.external}}
    builder.bind(CONTEXT_EVENTS).toFactory((resolve) => () => resolve(EVENT_SUBSCRIBER));
{{/if}}
{{#if persistence.hasDatabase}}
    builder.bind(DATABASE).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });
{{/if}}
  },
});
