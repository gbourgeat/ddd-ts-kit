import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jobSchedulerContract } from '@ddd-ts-kit/testing/contracts';
import { aBench } from './support.js';

jobSchedulerContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'InProcessJobScheduler on manual timers',
    createScheduler: () => {
      const { scheduler, scope } = aBench();
      return { scheduler, scope, elapse: (ms) => scheduler.advance(ms) };
    },
  },
);
