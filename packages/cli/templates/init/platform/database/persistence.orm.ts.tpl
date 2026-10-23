import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, {{#if queue.processTable}}ProcessStore, {{/if}}UnitOfWork } from '@ddd-ts-kit/kernel';
{{#if queue.database}}
import type { JobStore } from '@ddd-ts-kit/scheduling';
{{/if}}
{{#if persistence.packagedToken}}
import type { {{persistence.token}} } from '{{persistence.tokenPackage}}';
{{/if}}
{{#if persistence.ownDatabase}}
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
{{/if}}

/** Where state lives and how a command is made atomic. The composition root binds each member to its port. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  {{#if queue.database}}
  /** The background jobs, enqueued in the transaction of the command that asks for them. */
  readonly jobs: JobStore;
  {{/if}}
  {{#if queue.processTable}}
  /** The instances of the process managers, saved in the transaction of each step. */
  readonly processes: ProcessStore;
  {{/if}}
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: {{persistence.token}};

  close(): Promise<void>;
}
