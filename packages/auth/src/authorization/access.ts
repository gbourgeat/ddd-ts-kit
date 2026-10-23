import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission';
import type { AccessQuestion } from './access-question';
import type { AccessScope } from './access-scope';
import type { Decision } from './decision';

/**
 * What a handler asks once it has loaded the element:
 * `await this.access.authorize(command.actor, permissions.edit, article)`.
 */
export abstract class Access {
  static readonly tokenKey = 'auth.Access';

  /** Raises `ForbiddenError`, or `UnauthenticatedError` for the anonymous actor. */
  abstract authorize(actor: Actor, permission: Permission, subject: unknown): Promise<void>;

  abstract decide(actor: Actor, permission: Permission, subject: unknown): Promise<Decision>;

  /**
   * `decide`, with a context and without recording when the question says so: what decides the
   * fields of an answer (`fieldDeciderOf` of `@ddd-ts-kit/http`). Absent from an `Access` of the
   * project, which is then asked `decide`.
   */
  abstract decideOn?(question: AccessQuestion): Promise<Decision>;

  /** What the actor may list of one resource type, to hand to a read port. */
  abstract scope(actor: Actor, permission: Permission, resourceType: string): Promise<AccessScope>;
}
