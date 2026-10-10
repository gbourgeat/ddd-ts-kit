{{#if persistence.signals}}
import { InMemoryOutboxStore, InMemoryRelaySignal } from '@ddd-ts-kit/events';
{{/if}}
{{#unless persistence.signals}}
import { InMemoryOutboxStore } from '@ddd-ts-kit/events';
{{/unless}}
import { InMemoryProcessedEventStore, InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

{{#if orm.custom}}
/**
 * Starts in memory. TODO(platform): replace each of the three adapters by the one of your
 * storage: a UnitOfWork keeping its transaction in an AsyncLocalStorage, an OutboxStore and a
 * ProcessedEventStore writing in that transaction. open-persistence.contract.spec.ts holds
 * them to the contract suites; repositories then receive your connection from here.
 */
{{/if}}
export function openPersistence(): Persistence {
{{#if persistence.signals}}
  const relaySignal = new InMemoryRelaySignal();

  return {
    unitOfWork: new InMemoryUnitOfWork(),
    outbox: new InMemoryOutboxStore({ signal: relaySignal }),
    relaySignal,
{{/if}}
{{#unless persistence.signals}}
  return {
    unitOfWork: new InMemoryUnitOfWork(),
    outbox: new InMemoryOutboxStore(),
{{/unless}}
    processedEvents: new InMemoryProcessedEventStore(),
    close: () => Promise.resolve(),
  };
}
