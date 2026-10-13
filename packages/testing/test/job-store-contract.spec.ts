import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import { InMemoryJobStore } from '@ddd-ts-kit/scheduling';
import { jobStoreContract } from '../src/contracts.js';

// The reference store of the port, held to the contract as every adapter is.
jobStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'InMemoryJobStore',
    createStore: () => new InMemoryJobStore(),
    unitOfWork: () => new InMemoryUnitOfWork(),
  },
);
