import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, FixedClock, InMemoryLock, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';
import { jobSchedulerContract } from '../src/contracts.js';

// The in-process scheduler on manual timers, held to the contract as every adapter is.
jobSchedulerContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'InProcessJobScheduler on manual timers',
    createScheduler: () => {
      const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
      const scope = new AsyncLocalStorageExecutionScope();

      const scheduler = new ManualJobScheduler({
        clock,
        scope,
        lock: new InMemoryLock(clock),
        ids: new SequentialIdGenerator('run'),
      });

      return { scheduler, scope, elapse: (ms) => scheduler.advance(ms) };
    },
  },
);
