import type { Actor } from '../../application/actor/actor.js';
import type { PolicyVerdict } from './policy-verdict.js';

/**
 * A rule that needs loaded state, as a class of `application/authorization/`. `allows` uses
 * method syntax on purpose: a method parameter is compared bivariantly, so policies about
 * different subjects can be listed together.
 */
export interface DeclaredPolicy {
  appliesTo?(subject: unknown): boolean;
  allows(actor: Actor, subject: unknown, context: { readonly now: Date }): boolean | PolicyVerdict;
}
