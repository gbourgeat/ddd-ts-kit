import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryProcessStore } from '@ddd-ts-kit/kernel';
import { processStoreContract } from '../src/contracts.js';

// The reference store of the port, held to the contract as every adapter is.
processStoreContract(
  { describe, it, expect, beforeEach, afterEach },
  { name: 'InMemoryProcessStore', createStore: () => new InMemoryProcessStore() },
);
