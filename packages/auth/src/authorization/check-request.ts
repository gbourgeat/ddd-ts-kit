import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission';
import type { AuthorizationContext } from './authorization-context';
import type { ResourceRef } from './resource-ref';

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
