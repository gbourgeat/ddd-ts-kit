import { definePermissions } from '@ddd-ts-kit/auth';

export const analyticsPermissions = definePermissions('analytics', {
  // ddd-ts-kit:permissions
  'occupancy.read': { description: 'Search occupancy' },
  // /ddd-ts-kit:permissions
});
