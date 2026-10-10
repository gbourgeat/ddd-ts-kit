import type { AspectRuntime } from '../runtime/aspect-runtime.js';
import { runWithAspectRuntime } from '../runtime/installed-runtime.js';

/**
 * Runs the work, and everything it awaits, with these collaborators in place of the installed
 * runtime: a decorated adapter is tested without any constructor parameter for them.
 * Concurrent tests do not see each other's runtime.
 */
export function withAspectRuntime<T>(runtime: AspectRuntime, work: () => T): T {
  return runWithAspectRuntime(runtime, work);
}
