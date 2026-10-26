{{#if persistence.signals}}
import type { OutboxStore, RelaySignal } from '@ddd-ts-kit/events';
{{/if}}
{{#unless persistence.signals}}
import type { OutboxStore } from '@ddd-ts-kit/events';
{{/unless}}
{{#if eventSourcing.on}}
import type { EventSourcingStores, {{#if tenancy.any}}ExecutionScope, {{/if}}ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless eventSourcing.on}}
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
{{/unless}}

/** Where state lives and how a command is made atomic. The composition root binds each member to its port. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  {{#if persistence.signals}}
  /** Raised after each stored event, so that the relay need not poll fast. */
  readonly relaySignal: RelaySignal;
  {{/if}}
  readonly processedEvents: ProcessedEventStore;
  {{#if eventSourcing.on}}
  /** The event store, the snapshots, the checkpoints and the keys of the data subjects: what an event-sourced aggregate is saved through, and what seals its personal values. */
{{#if tenancy.any}}
  /** Given the execution scope, each stream keeps the tenant of the work that first appended to it. */
  readonly eventSourcing: (scope: ExecutionScope) => EventSourcingStores;
{{/if}}
{{#unless tenancy.any}}
  readonly eventSourcing: EventSourcingStores;
{{/unless}}
  {{/if}}

  close(): Promise<void>;
}
