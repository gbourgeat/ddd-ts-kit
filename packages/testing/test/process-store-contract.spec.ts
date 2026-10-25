import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryProcessStore } from '@ddd-ts-kit/kernel';
import { processStoreContract } from '../src/contracts';
import { TenantProcesses } from './support/tenant-processes';
import { TransactionalProcesses } from './support/transactional-processes';

// The reference store of the port, held to the contract as every adapter is.
processStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  { name: 'InMemoryProcessStore', createStore: () => new InMemoryProcessStore() },
);

// A store with transactions is also held to what a rolled back unit of work leaves.
let processes = new TransactionalProcesses();

processStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'a process store in memory with transactions',
    createStore: () => (processes = new TransactionalProcesses()),
    unitOfWork: () => processes.unitOfWork,
  },
);

// A store that keys an instance by its tenant is also held to what each tenant keeps apart.
let tenantProcesses = new TenantProcesses();

processStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'a process store in memory keyed by tenant',
    createStore: () => (tenantProcesses = new TenantProcesses()),
    storeInTenant: (scope) => tenantProcesses.inTenant(scope),
  },
);
