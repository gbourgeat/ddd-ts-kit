import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
{{#if persistence.packagedToken}}
import type { {{persistence.token}} } from '{{persistence.tokenPackage}}';
{{/if}}
{{#if persistence.ownDatabase}}
import type { Database } from './database.js';
{{/if}}

/** Where state lives and how a command is made atomic. The platform module binds each member to its port. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: {{persistence.token}};

  close(): Promise<void>;
}
