import { defineContextModule, kernelModule, token, type ContextModule } from '@ddd-ts-kit/di';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
import { InMemoryDomainEventDispatcher, InMemoryEventBus, type DomainEventDispatcher } from '@ddd-ts-kit/kernel';
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

export const DOMAIN_EVENTS = token<DomainEventDispatcher>('platform.DomainEventDispatcher');
{{#if persistence.hasDatabase}}
export const DATABASE = token<DatabaseContext>('platform.Database');
{{/if}}

/**
 * The kernel tokens (clock, identifiers, buses, unit of work, event bus) on the persistence
 * of the project, then what this platform adds. Replacing a provider happens here and nowhere else.
 */
export function platformModules(persistence: Persistence): readonly ContextModule[] {
  const bus = new InMemoryEventBus();
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
{{#if persistence.hasDatabase}}
    builder.bind(DATABASE).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });
{{/if}}
  },
});
