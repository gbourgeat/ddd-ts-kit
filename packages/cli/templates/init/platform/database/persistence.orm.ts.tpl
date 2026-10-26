import type { OutboxStore } from '@ddd-ts-kit/events';
import type { {{#if eventSourcing.on}}EventSourcingStores, {{/if}}{{#if queue.processTable}}ExecutionScope, {{/if}}{{#unless queue.processTable}}{{#if tenancy.any}}{{#if eventSourcing.on}}ExecutionScope, {{/if}}{{/if}}{{/unless}}ProcessedEventStore, {{#if queue.processTable}}ProcessStore, {{/if}}UnitOfWork } from '@ddd-ts-kit/kernel';
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
{{#if tenancy.any}}
  /** The instances of the process managers, saved in the transaction of each step, each in the tenant of the work `scope` runs. */
{{/if}}
{{#unless tenancy.any}}
  /** The instances of the process managers, saved in the transaction of each step; `scope` serves a multi-tenant project. */
{{/unless}}
  readonly processes: (scope: ExecutionScope) => ProcessStore;
  {{/if}}
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: {{persistence.token}};
  {{#if eventSourcing.on}}
  /**
   * The event store, the snapshots, the checkpoints of the projections it feeds and the keys of the
   * data subjects, in the `event_store` schema: what an event-sourced aggregate is loaded and saved
   * through, and what seals its personal values. The platform binds each store to its port.
{{#if tenancy.any}}
   * It is given the execution scope: each stream keeps the tenant of the work that first appended to it.
{{/if}}
   */
{{#if tenancy.any}}
  readonly eventSourcing: (scope: ExecutionScope) => EventSourcingStores;
{{/if}}
{{#unless tenancy.any}}
  readonly eventSourcing: EventSourcingStores;
{{/unless}}
  {{/if}}

  close(): Promise<void>;
}
