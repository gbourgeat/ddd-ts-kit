import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission.js';
import type { AuthorizationContext } from './authorization-context.js';
import type { ResourceRef } from './resource-ref.js';

export interface CheckRequest {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resource?: ResourceRef;
  readonly context?: AuthorizationContext;
  /**
   * The tenant of the work the question is asked in, as the execution scope names it. The guard
   * of the bus and `PolicyAccess` set it when they are given the scope; absent otherwise.
   */
  readonly workTenantId?: string;
}
