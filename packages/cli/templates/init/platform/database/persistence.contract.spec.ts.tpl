import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
{{#if queue.processTable}}
import { FixedExecutionScope, executionContext, systemActor } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if queue.database}}
import {
{{#if eventSourcing.on}}
  eventStoreContract,
{{/if}}
  jobStoreContract,
  outboxStoreContract,
  processedEventStoreContract,
  processStoreContract,
} from '@ddd-ts-kit/testing/contracts';
{{/if}}
{{#unless queue.database}}
{{#if queue.processTable}}
{{#if eventSourcing.on}}
import {
  eventStoreContract,
  outboxStoreContract,
  processedEventStoreContract,
  processStoreContract,
} from '@ddd-ts-kit/testing/contracts';
{{/if}}
{{#unless eventSourcing.on}}
import { outboxStoreContract, processedEventStoreContract, processStoreContract } from '@ddd-ts-kit/testing/contracts';
{{/unless}}
{{/if}}
{{#unless queue.processTable}}
import { {{#if eventSourcing.on}}eventStoreContract, {{/if}}outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
{{/unless}}
{{/unless}}
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

// The stores of the kit as this platform wires them, held to the contracts of their ports with the
// capabilities the stack turns on: a store bound without what the stack asks for fails here.

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

outboxStoreContract(runner, {
  name: 'The outbox store of the platform',
  createStore: async () => (await emptied()).outbox,
  leaseMs: 30_000,
{{#if tenancy.any}}
  carriesTenant: true,
{{/if}}
});

processedEventStoreContract(runner, {
  name: 'The processed-event store of the platform',
  createStore: async () => (await emptied()).processedEvents,
});
{{#if eventSourcing.on}}

eventStoreContract(runner, {
  name: 'The event store of the platform',
  createStore: async () => (await emptied()).eventSourcing.events,
  createCompanions: async () => (await emptied()).eventSourcing,
});
{{/if}}
{{#if queue.database}}

jobStoreContract(runner, {
  name: 'The job store of the platform',
  createStore: async () => (await emptied()).jobs,
  unitOfWork: () => database.persistence.unitOfWork,
});
{{/if}}
{{#if queue.processTable}}

{{#if tenancy.any}}
/** The work of a tenant of its own, beside the two of the contract. */
{{/if}}
{{#unless tenancy.any}}
/** The work of the platform. */
{{/unless}}
const work = new FixedExecutionScope(
{{#if tenancy.any}}
  executionContext({ correlationId: 'contract', actor: systemActor('contract'), origin: 'test', tenantId: 'initech' }),
{{/if}}
{{#unless tenancy.any}}
  executionContext({ correlationId: 'contract', actor: systemActor('contract'), origin: 'test' }),
{{/unless}}
);

processStoreContract(runner, {
  name: 'The process store of the platform',
  createStore: async () => (await emptied()).processes(work),
  unitOfWork: () => database.persistence.unitOfWork,
{{#if tenancy.any}}
  storeInTenant: (scope) => database.persistence.processes(scope),
{{/if}}
});
{{/if}}

/** The persistence of the platform, on a database emptied before each test. */
async function emptied(): Promise<Persistence> {
  await database.reset();

  return database.persistence;
}
