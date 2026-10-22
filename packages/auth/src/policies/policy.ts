import type { Actor } from '@ddd-ts-kit/kernel';
import type { Decision } from '../authorization/decision';
import type { Permission } from '../permissions/permission';
import type { PolicyContext } from './policy-context';

/**
 * A named rule that needs loaded state: "only the author may edit, and not after publication".
 * `allows` is declared with method syntax on purpose: a method parameter is compared
 * bivariantly, so policies about different subjects can be listed together.
 */
export interface Policy<Subject> {
  /** Stable: it is the reason of the refusal when `allows` answers `false`. */
  readonly name: string;
  readonly permission: Permission;
  /** Tells whether a value is a subject of this policy; anything else is refused. */
  appliesTo?(subject: unknown): subject is Subject;
  allows(actor: Actor, subject: Subject, context: PolicyContext): boolean | Decision;
}
