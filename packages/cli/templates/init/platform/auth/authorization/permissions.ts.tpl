import { PermissionRegistry } from '@ddd-ts-kit/auth';
{{#if audit.route}}
import { auditPermissions } from '{{alias.platform}}/audit/audit.permissions{{alias.ext}}';
{{/if}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** Every permission of every context{{#if audit.route}}, and the one of the audit trail{{/if}}: the authorization model is laid out over it. */
export const permissions = PermissionRegistry.of(
{{#if audit.route}}
  auditPermissions,
{{/if}}
  // ddd-ts-kit:permission-sets
  // /ddd-ts-kit:permission-sets
);
