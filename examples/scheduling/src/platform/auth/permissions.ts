import { PermissionRegistry } from '@ddd-ts-kit/auth';
import { auditPermissions } from '#src/platform/audit/audit.permissions.js';
// ddd-ts-kit:imports
import { identityPermissions } from '#src/contexts/identity/application/authorization/identity.permissions.js';
import { schedulingPermissions } from '#src/contexts/scheduling/application/authorization/scheduling.permissions.js';
import { notificationPermissions } from '#src/contexts/notification/application/authorization/notification.permissions.js';
import { analyticsPermissions } from '#src/contexts/analytics/application/authorization/analytics.permissions.js';
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
