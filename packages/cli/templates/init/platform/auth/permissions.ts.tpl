import { PermissionRegistry } from '@ddd-ts-kit/auth';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** Every permission of every context: the authorization model is laid out over it. */
export const permissionRegistry = PermissionRegistry.of(
  // ddd-ts-kit:permission-sets
  // /ddd-ts-kit:permission-sets
);
