import type { Scope } from '../scope';
import { declarationsOf, type FoundDeclaration } from './declarations-of';
import type { EventDeclaration } from './event-declaration';

/** An event type, at one version when the caller asks for one. */
export type WantedEvent = { readonly type: string; readonly version?: number | undefined };

/**
 * Looks for the declaration of an event in the published language of an upstream of this
 * repository, at its version when one is asked for, the newest otherwise; the file of the one
 * found is what the command builds on.
 */
export function findEventDeclaration(
  scope: Scope,
  upstream: string,
  wanted: WantedEvent,
): EventDeclaration | undefined {
  const declarations = declarationsOf(scope, upstream, wanted.type).filter(
    ({ declaration }) => wanted.version === undefined || declaration.version === wanted.version,
  );

  // A new consumer has no reason to start on an old contract.
  const newest = declarations.reduce<FoundDeclaration | undefined>(
    (found, candidate) =>
      found === undefined || candidate.declaration.version > found.declaration.version ? candidate : found,
    undefined,
  );

  if (newest !== undefined) {
    scope.flags.builtOn?.(newest.file);
  }

  return newest?.declaration;
}
