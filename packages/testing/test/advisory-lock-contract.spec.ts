import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advisoryLockContract } from '../src/contracts';
import { InMemoryAdvisoryLocks } from './support/in-memory-advisory-locks';

// The globals of the runner are passed as they are: the suites import no runner themselves.
const runner = { describe, it, expect, beforeEach, afterEach };

advisoryLockContract(runner, {
  name: 'locks held in memory, where two transactions meet',
  createLocks: () => new InMemoryAdvisoryLocks(),
  concurrent: true,
});

advisoryLockContract(runner, {
  name: 'locks held in memory, on one connection',
  createLocks: () => new InMemoryAdvisoryLocks(),
});
