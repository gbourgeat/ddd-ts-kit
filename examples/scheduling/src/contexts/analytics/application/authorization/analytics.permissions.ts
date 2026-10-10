import { definePermissions } from '@ddd-ts-kit/auth';

export const analyticsPermissions = definePermissions('analytics', {
  // ddd-ts-kit:permissions
  'occupancy.verify': { description: 'Verify occupancy' },
  'occupancy.read': { description: 'List occupancy' },
  // /ddd-ts-kit:permissions
});
