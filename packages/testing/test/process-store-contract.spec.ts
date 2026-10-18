import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryProcessStore } from '@ddd-ts-kit/kernel';
import { processStoreContract } from '../src/contracts.js';
import { TransactionalProcesses } from './support/transactional-processes.js';

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
