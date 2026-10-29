import type { Scope } from './scope';

/**
 * True when a file the command builds on is there; the probe of `plan-waves` then hears it, where
 * it was found. The caller refuses with a `MissingPrerequisite` when it is not.
 */
export function foundPrerequisite(scope: Scope, file: string): boolean {
  if (!scope.ws.exists(file)) {
    return false;
  }

  scope.flags.builtOn?.(scope.ws.placed(file));

  return true;
}
