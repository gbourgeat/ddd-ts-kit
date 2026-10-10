import type { AuthorizationContext } from '@ddd-ts-kit/auth';
import type { RoleGrant } from '#src/platform/auth/role-grant.js';

/**
 * What a role of the token grants before any relationship is read. Kept short on purpose: a
 * right over one element (a practice, a calendar, an appointment) is a relationship, never a
 * role. `support` grants nothing: support staff read through the user they impersonate.
 */
export const roleGrants: readonly RoleGrant[] = [
  { role: 'platform-admin', permissions: ['identity:practice.open', 'audit:trail.read'], listing: 'all' },
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
