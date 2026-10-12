import type { PermissionMapping } from '@ddd-ts-kit/auth/rebac';
import { permissions } from '{{alias.platform}}/auth/permissions{{alias.ext}}';

/** Which permission of the relationship schema each permission of a context stands for. */
export function permissionMapping(): PermissionMapping {
  return { context: Object.fromEntries(permissions.all().map((permission) => [permission.id, 'operate'])) };
}
