import type { AuthorizationContext } from '@ddd-ts-kit/auth';
import type { RoleGrant } from '@/platform/auth/role-grant';

/**
 * What a role of the token grants before any relationship is read. Kept short on purpose: a
 * right over one element (a practice, a calendar, an appointment) is a relationship, never a
 * role. `support` grants nothing: support staff read through the user they impersonate. The
 * administrator of a network opens its practices, in the network of the token; platform staff
 * (`platform-admin`) belong to no network and read the audit trail of all of them through an
 * elevation the trail records (ADR-0003).
 */
export const roleGrants: readonly RoleGrant[] = [
  { role: 'network-admin', permissions: ['identity:practice.open'], listing: 'all' },
  { role: 'platform-admin', permissions: ['audit:trail.read'], listing: 'all' },
  {
    permissions: [
      'identity:person.register',
      'scheduling:calendar.browse',
      'scheduling:appointment.search',
      'notification:notification.read',
    ],
    listing: 'relationships',
  },
  {
    role: 'patient',
    permissions: ['scheduling:appointment.book', 'scheduling:waitlist.join'],
    listing: 'relationships',
    when: selfService,
  },
  { role: 'support', permissions: [], listing: 'relationships' },
];

/** The command says the patient books for themselves: `@Requires(..., { context: () => ({ selfService: true }) })`. */
function selfService(context: AuthorizationContext): boolean {
  return context['selfService'] === true;
}
