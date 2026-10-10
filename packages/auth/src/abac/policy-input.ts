import type { Actor } from '@ddd-ts-kit/kernel';
import type { AuthorizationContext } from '../authorization/authorization-context.js';
import type { ResourceRef } from '../authorization/resource-ref.js';
import type { Permission } from '../permissions/permission.js';
import type { ResourceAttributeValues } from './resource-attribute-values.js';

/** Everything a rule may look at. */
export interface PolicyInput {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resource?: ResourceRef;
  /** Empty when the request names no resource or the port knows nothing about it. */
  readonly attributes: ResourceAttributeValues;
  readonly context: AuthorizationContext;
  /** From the `Clock` port. */
  readonly now: Date;
}
