import { AsyncLocalStorage } from 'node:async_hooks';
import { SystemClock, type Cache, type Clock, type Logger, type Metrics } from '@ddd-ts-kit/kernel';

/** Runs work later. Injected so that a test advances time instead of waiting for it. */
export interface Scheduler {
  /** Answers the function that cancels the work. */
  schedule(work: () => void, delayMs: number): () => void;
}

export const systemScheduler: Scheduler = Object.freeze({
  schedule(work: () => void, delayMs: number): () => void {
    const timer = setTimeout(work, delayMs);
    return () => {
      clearTimeout(timer);
    };
  },
});

/**
 * The collaborators aspects resolve when a call is made, not when a class is decorated or an
 * instance wrapped. Install what the aspects in use need: `logged` a logger, `timed` metrics,
 * `cached` a cache. The clock and the scheduler default to the system ones.
 */
export interface AspectRuntime {
  readonly logger?: Logger;
  readonly metrics?: Metrics;
  readonly cache?: Cache;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
}

/** An aspect needs a collaborator that neither its options nor the runtime provide. */
export class AspectRuntimeError extends Error {
  readonly code = 'ASPECT_RUNTIME_MISSING';

  constructor(collaborator: string) {
    super(
      `No ${collaborator} for aspects: call installAspectRuntime({ ${collaborator} }) in the composition root, or pass it in the options of the aspect`,
    );
    this.name = 'AspectRuntimeError';
  }
}

let installed: AspectRuntime = {};
const scoped = new AsyncLocalStorage<AspectRuntime>();
const systemClock = new SystemClock();

/** Called once by the composition root. A later call replaces the runtime as a whole. */
export function installAspectRuntime(runtime: AspectRuntime): void {
  installed = runtime;
}

/** The runtime for the duration of the work and of what it awaits. For tests: see `./testing`. */
export function runWithAspectRuntime<T>(runtime: AspectRuntime, work: () => T): T {
  return scoped.run(runtime, work);
}

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

function currentRuntime(): AspectRuntime {
  return scoped.getStore() ?? installed;
}

function missing(collaborator: string): never {
  throw new AspectRuntimeError(collaborator);
}
