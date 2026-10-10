{{#if persistence.signals}}
import type { OutboxStore, RelaySignal } from '@ddd-ts-kit/events';
{{/if}}
{{#unless persistence.signals}}
import type { OutboxStore } from '@ddd-ts-kit/events';
{{/unless}}
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';

/** Where state lives and how a command is made atomic. The platform module binds each member to its port. */
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
