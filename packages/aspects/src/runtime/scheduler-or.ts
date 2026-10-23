import { currentRuntime } from './installed-runtime';
import type { Scheduler } from './scheduler';
import { systemScheduler } from './system-scheduler';

export function schedulerOr(given: Scheduler | undefined): Scheduler {
  return given ?? currentRuntime().scheduler ?? systemScheduler;
}
