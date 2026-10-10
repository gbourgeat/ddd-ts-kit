import type { PermissionMapping } from '@ddd-ts-kit/auth/rebac';
import { permissions } from './permissions.js';
import { resourcePermissions } from './resource-permissions.js';

/**
 * Which permission of the relationship schema each permission of a context stands for: every
 * one of them means `operate` when asked of a bounded context, and what `resource-permissions.ts`
 * says when asked of an element.
 */
export function permissionMapping(): PermissionMapping {
  return {
    ...resourcePermissions,
    context: Object.fromEntries(permissions.all().map((permission) => [permission.id, 'operate'])),
  };
}
