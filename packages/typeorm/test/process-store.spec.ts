import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { TypeOrmProcessStore, createTypeOrmUnitOfWork, processEntity } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };
const messagingProcesses = processEntity({ schema: 'messaging' });

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([messagingProcesses, processEntity({ tableName: 'billing_processes' })]);
});

afterAll(async () => {
  await database.close();
});

const context = () => createTypeOrmUnitOfWork(database.dataSource);

let shared: ReturnType<typeof context>;

processStoreContract(runner, {
  name: 'TypeOrmProcessStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new TypeOrmProcessStore(shared, { entity: messagingProcesses });
  },
  unitOfWork: () => shared,
  storeInTenant: (tenant) => new TypeOrmProcessStore(shared, { entity: messagingProcesses, tenant }),
});

processStoreContract(runner, {
  name: 'TypeOrmProcessStore in a table of its own name',
  createStore: async () => {
    await database.truncate();

    return new TypeOrmProcessStore(context(), { entity: processEntity({ tableName: 'billing_processes' }) });
  },
});

describe('the state of a process instance', () => {
  it('comes back null when it was saved without one', async () => {
    await database.truncate();

    const store = new TypeOrmProcessStore(context(), { entity: messagingProcesses });
    const started = { name: 'billing.dunning', id: 'inv-1', version: 1, ended: false, timeouts: {} };

    await store.save({ ...started, state: { step: 1 } });
    await store.save({ ...started, version: 2, state: undefined });

    expect(await store.load(started.name, started.id)).toMatchObject({ version: 2, state: null });
  });
});
