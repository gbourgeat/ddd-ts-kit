import { SystemClock, type Cache, type Clock, type Logger, type Metrics } from '@ddd-ts-kit/kernel';
import { AspectRuntimeError } from './aspect-runtime-error.js';
import { currentRuntime } from './installed-runtime.js';
import type { Scheduler } from './scheduler.js';
import { systemScheduler } from './system-scheduler.js';

const systemClock = new SystemClock();

export function loggerOr(given: Logger | undefined): Logger {
  return given ?? currentRuntime().logger ?? missing('logger');
}

export function metricsOr(given: Metrics | undefined): Metrics {
  return given ?? currentRuntime().metrics ?? missing('metrics');
}

export function cacheOr(given: Cache | undefined): Cache {
  return given ?? currentRuntime().cache ?? missing('cache');
}

export function clockOr(given: Clock | undefined): Clock {
  return given ?? currentRuntime().clock ?? systemClock;
}

export function schedulerOr(given: Scheduler | undefined): Scheduler {
  return given ?? currentRuntime().scheduler ?? systemScheduler;
}

function missing(collaborator: string): never {
  throw new AspectRuntimeError(collaborator);
}
