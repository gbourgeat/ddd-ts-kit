import { AsyncLocalStorage } from 'node:async_hooks';
import type { AspectRuntime } from './aspect-runtime.js';

let installed: AspectRuntime = {};
const scoped = new AsyncLocalStorage<AspectRuntime>();

/** Called once by the composition root. A later call replaces the runtime as a whole. */
export function installAspectRuntime(runtime: AspectRuntime): void {
  installed = runtime;
}

/** The runtime for the duration of the work and of what it awaits. For tests: see `./testing`. */
export function runWithAspectRuntime<T>(runtime: AspectRuntime, work: () => T): T {
  return scoped.run(runtime, work);
}

/** The runtime of the work in progress, otherwise the installed one. */
export function currentRuntime(): AspectRuntime {
  return scoped.getStore() ?? installed;
}
