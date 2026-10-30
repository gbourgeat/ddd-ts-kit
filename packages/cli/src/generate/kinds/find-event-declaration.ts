import type { Scope } from '../scope';
import { declarationsOf } from './declarations-of';
import type { EventDeclaration } from './event-declaration';
import { pickDeclaration } from './pick-declaration';

/** An event type, at one version when the caller asks for one. */
export type WantedEvent = { readonly type: string; readonly version?: number | undefined };

/** Looks for the declaration of an event in the published language of an upstream of this repository. */
export function findEventDeclaration(
  scope: Scope,
  upstream: string,
  wanted: WantedEvent,
): EventDeclaration | undefined {
  return pickDeclaration(scope, declarationsOf(scope, upstream, wanted.type), wanted.version);
}
