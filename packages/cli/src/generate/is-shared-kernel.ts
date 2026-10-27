import type { Scope } from './scope';

/** True when a kind writes in the shared kernel rather than in a context. */
export function isSharedKernel(scope: Scope): boolean {
  return scope.dir === scope.config.sharedKernelDir;
}
