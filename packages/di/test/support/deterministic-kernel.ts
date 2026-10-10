import { FixedClock, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { kernelModule } from '../../src/index.js';

/** The kernel module on a fixed clock, with ids numbered from `order-1`. */
export const deterministicKernel = (): ReturnType<typeof kernelModule> =>
  kernelModule({
    clock: new FixedClock(new Date('2026-05-01T08:00:00.000Z')),
    ids: () => new SequentialIdGenerator('order'),
  });
