import { definePermissions } from '@ddd-ts-kit/auth';

export const analyticsPermissions = definePermissions('analytics', {
  // ddd-ts-kit:permissions
  'occupancy.read': { description: 'List occupancy' },
  // /ddd-ts-kit:permissions
});
