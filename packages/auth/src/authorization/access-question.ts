import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission';
import type { AuthorizationContext } from './authorization-context';

/** One question to `Access.decideOn`: more than `decide` says, a context and whether to record the decision. */
export interface AccessQuestion {
  readonly actor: Actor;
  readonly permission: Permission;
  /** The element the permission is asked about; absent, none. */
  readonly subject?: unknown;
  /** Facts beside the actor and the element, as `@Requires(..., { context })` gives a use case. */
  readonly context?: AuthorizationContext;
  /**
   * Whether the decision goes to `onDecision`, the audit trail. Default: true. A decision that
   * only shapes an answer (a field shown or left out of it) is no act, and is not recorded.
   */
  readonly recorded?: boolean;
}
