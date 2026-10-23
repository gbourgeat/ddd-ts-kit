import type { FixedClock } from '@ddd-ts-kit/kernel';
import { defineAspect, type Aspect } from '../../src';

/** Makes the call inside last a known time on the fake clock. */
export function lasting(clock: FixedClock, durationMs: number): Aspect {
  return defineAspect(() => async ({ proceed }) => {
    clock.advance(durationMs);

    return proceed();
  });
}
