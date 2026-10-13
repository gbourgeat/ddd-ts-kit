import type { AuthorizationContext } from '@ddd-ts-kit/auth';
import type { RoleGrant } from '@/platform/auth/role-grant';
import { auditPermissions } from '@/platform/audit/audit.permissions';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { Role } from '@/platform/auth/role';

/**
 * What a role of the token grants before any relationship is read. Kept short on purpose: a
 * right over one element (a practice, a calendar, an appointment) is a relationship, never a
 * role. `support` grants nothing: support staff read through the user they impersonate. The
 * administrator of a network opens its practices, in the network of the token; platform staff
 * (`platform-admin`) belong to no network and read the audit trail of all of them through an
 * elevation the trail records (ADR-0003).
 */
export const roleGrants: readonly RoleGrant[] = [
  { role: Role.NetworkAdmin, permissions: [identityPermissions['practice.open'].id], listing: 'all' },
  { role: Role.PlatformAdmin, permissions: [auditPermissions['trail.read'].id], listing: 'all' },
  {
    permissions: [
      identityPermissions['person.register'].id,
      schedulingPermissions['calendar.browse'].id,
      schedulingPermissions['appointment.search'].id,
      notificationPermissions['notification.read'].id,
    ],
    listing: 'relationships',
  },
  {
    role: Role.Patient,
    permissions: [schedulingPermissions['appointment.book'].id, schedulingPermissions['waitlist.join'].id],
    listing: 'relationships',
    when: selfService,
  },
  { role: Role.Support, permissions: [], listing: 'relationships' },
];

/** The command says the patient books for themselves: `@Requires(..., { context: () => ({ selfService: true }) })`. */
function selfService(context: AuthorizationContext): boolean {
  return context['selfService'] === true;
}
