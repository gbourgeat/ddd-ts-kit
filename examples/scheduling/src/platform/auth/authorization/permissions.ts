import { PermissionRegistry } from '@ddd-ts-kit/auth';
import { auditPermissions } from '@/platform/audit/audit.permissions';
// ddd-ts-kit:imports
import { identityPermissions } from '@/contexts/identity/identity.permissions';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import { notificationPermissions } from '@/contexts/notification/notification.permissions';
import { analyticsPermissions } from '@/contexts/analytics/analytics.permissions';
// /ddd-ts-kit:imports

/** Every permission of every context, and the one of the audit trail: the authorization model is laid out over it. */
export const permissions = PermissionRegistry.of(
  auditPermissions,
  // ddd-ts-kit:permission-sets
  identityPermissions,
  schedulingPermissions,
  notificationPermissions,
  analyticsPermissions,
  // /ddd-ts-kit:permission-sets
);
