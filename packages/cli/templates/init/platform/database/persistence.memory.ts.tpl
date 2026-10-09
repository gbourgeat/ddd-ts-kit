{{#if persistence.signals}}
import { InMemoryOutboxStore, InMemoryRelaySignal, type OutboxStore, type RelaySignal } from '@ddd-ts-kit/events';
{{/if}}
{{#unless persistence.signals}}
import { InMemoryOutboxStore, type OutboxStore } from '@ddd-ts-kit/events';
{{/unless}}
import { InMemoryProcessedEventStore, InMemoryUnitOfWork, type ProcessedEventStore, type UnitOfWork } from '@ddd-ts-kit/kernel';

/** Where state lives and how a command is made atomic. Everything else receives these ports. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
{{#if persistence.signals}}
  /** Raised after each stored event, so that the relay need not poll fast. */
  readonly relaySignal: RelaySignal;
{{/if}}
  readonly processedEvents: ProcessedEventStore;
  close(): Promise<void>;
}

{{#if orm.custom}}
/**
 * Starts in memory. TODO(platform): replace each of the three adapters by the one of your
 * storage: a UnitOfWork keeping its transaction in an AsyncLocalStorage, an OutboxStore and a
 * ProcessedEventStore writing in that transaction. test/integration/persistence.contract.spec.ts
 * holds them to the contract suites; repositories then receive your connection from here.
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

{{#if persistence.inert}}

/** For the scripts that only list routes: nothing to connect to here. */
export function inertPersistence(): Persistence {
  return openPersistence();
}
{{/if}}
