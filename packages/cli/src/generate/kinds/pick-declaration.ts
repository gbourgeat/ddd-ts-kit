import type { Scope } from '../scope';
import type { FoundDeclaration } from './declarations-of';
import type { EventDeclaration } from './event-declaration';

/**
 * The declaration at `version` when one is asked for, the newest otherwise (a new consumer has no
 * reason to start on an old contract); the file of the one found is what the command builds on.
 */
export function pickDeclaration(
  scope: Scope,
  found: readonly FoundDeclaration[],
  version: number | undefined,
): EventDeclaration | undefined {
  const newest = found
    .filter(
      (candidate) => candidate.declaration !== undefined && (version === undefined || candidate.version === version),
    )
    .reduce<FoundDeclaration | undefined>(
      (best, candidate) => (best === undefined || candidate.version > best.version ? candidate : best),
      undefined,
    );

  if (newest !== undefined) {
    scope.flags.builtOn?.(newest.file);
  }

  return newest?.declaration;
}
