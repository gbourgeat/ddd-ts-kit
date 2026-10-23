import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { InMemoryJobStore } from '../src';

jobStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'InMemoryJobStore',
    createStore: () => new InMemoryJobStore(),
    unitOfWork: () => new InMemoryUnitOfWork(),
  },
);
