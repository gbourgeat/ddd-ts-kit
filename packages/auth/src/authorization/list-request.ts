import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from '../permissions/permission.js';

export interface ListRequest {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resourceType: string;
}
