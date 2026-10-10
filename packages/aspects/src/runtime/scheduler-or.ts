import { currentRuntime } from './installed-runtime.js';
import type { Scheduler } from './scheduler.js';
import { systemScheduler } from './system-scheduler.js';

export function schedulerOr(given: Scheduler | undefined): Scheduler {
  return given ?? currentRuntime().scheduler ?? systemScheduler;
}
