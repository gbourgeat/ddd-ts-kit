import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import type { AspectRuntime } from '../runtime/aspect-runtime';
import { runWithAspectRuntime } from '../runtime/installed-runtime';

/**
 * Runs the work, and everything it awaits, with these collaborators in place of the installed
 * runtime: a decorated adapter is tested without any constructor parameter for them.
 * Concurrent tests do not see each other's runtime. Unless the runtime gives one, a scope that
 * names no tenant is in place, which `cached` needs.
 */
export function withAspectRuntime<T>(runtime: AspectRuntime, work: () => T): T {
  return runWithAspectRuntime({ scope: new FixedExecutionScope(), ...runtime }, work);
}
