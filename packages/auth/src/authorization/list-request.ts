import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission';

export interface ListRequest {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resourceType: string;
  /** The tenant of the work the list is read in, as the execution scope names it. See `CheckRequest`. */
  readonly workTenantId?: string;
}
