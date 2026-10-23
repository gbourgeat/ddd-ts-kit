import { defineSchema, via } from '@ddd-ts-kit/auth/rebac';
import { analyticsPermissions } from '@/contexts/analytics/application/authorization/analytics.permissions';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import { permissions } from '@/platform/auth/authorization/permissions';

/**
 * Who is what to which element, who counts as what, and which permission each one grants. A
 * practice has its members; a desk is the post of one practitioner in one practice (object id
 * `<practiceId>.<practitionerId>`), held by the practitioner, delegated in whole or for the
 * availabilities only, and managed by whoever manages the practice; a calendar belongs to a desk,
 * and whoever works in its practice is its staff; an appointment belongs to a calendar and to its
 * patient; a person is one user. A derived relation named after a permission id grants it on
 * that type: the same permission may be asked of two types (`scheduling:agenda.read` of a
 * practice or of one calendar) and mean something else on each. A bounded context and who
 * operates it stays the resource of the use cases the application runs on its own behalf: a
 * system actor (a scheduled job, an integration event handler) is a subject of type `system`.
 */
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  context: {
    relations: { operator: ['user', 'system'] },
    derived: Object.fromEntries(permissions.all().map((permission) => [permission.id, 'operator'])),
  },
  practice: {
    relations: { manager: ['user'], practitioner: ['user'], assistant: ['user'] },
    derived: {
      manage: 'manager',
      work: { anyOf: ['manager', 'practitioner', 'assistant'] },
      [identityPermissions['member.add'].id]: 'manage',
      [identityPermissions['member.remove'].id]: 'manage',
      [schedulingPermissions['agenda.read'].id]: 'work',
      [schedulingPermissions['attendance.read'].id]: 'work',
      [analyticsPermissions['occupancy.read'].id]: 'work',
    },
  },
  desk: {
    relations: { holder: ['user'], delegate: ['user'], availability_delegate: ['user'], practice: ['practice'] },
    derived: {
      own: { anyOf: ['holder', via('practice', 'manage')] },
      run: { anyOf: ['holder', 'delegate', via('practice', 'manage')] },
      plan: { anyOf: ['holder', 'availability_delegate', via('practice', 'manage')] },
      [identityPermissions['delegation.grant'].id]: 'own',
      [identityPermissions['delegation.revoke'].id]: 'own',
      [schedulingPermissions['calendar.create'].id]: 'own',
    },
  },
  calendar: {
    relations: { desk: ['desk'], practice: ['practice'] },
    derived: {
      plan: via('desk', 'plan'),
      run: via('desk', 'run'),
      own: via('desk', 'own'),
      staff: via('practice', 'work'),
      [schedulingPermissions['calendar.set-opening-hours'].id]: 'plan',
      [schedulingPermissions['calendar.add-exception'].id]: 'plan',
      [schedulingPermissions['calendar.add-time-off'].id]: 'plan',
      [schedulingPermissions['calendar.define-appointment-type'].id]: 'plan',
      [schedulingPermissions['calendar.clear'].id]: 'run',
      [schedulingPermissions['appointment.book'].id]: 'run',
      [schedulingPermissions['waitlist.join'].id]: 'run',
      [schedulingPermissions['agenda.read'].id]: 'run',
      [analyticsPermissions['occupancy.read'].id]: 'own',
      [schedulingPermissions['appointment.note.read'].id]: 'staff',
      [schedulingPermissions['appointment.note.write'].id]: 'own',
    },
  },
  appointment: {
    relations: { patient: ['user'], calendar: ['calendar'] },
    derived: {
      read: { anyOf: ['patient', via('calendar', 'run')] },
      change: { anyOf: ['patient', via('calendar', 'run')] },
      close: via('calendar', 'run'),
      [schedulingPermissions['appointment.read'].id]: 'read',
      [schedulingPermissions['appointment.cancel'].id]: 'change',
      [schedulingPermissions['appointment.reschedule'].id]: 'change',
      [schedulingPermissions['appointment.confirm'].id]: 'change',
      [schedulingPermissions['appointment.complete'].id]: 'close',
      [schedulingPermissions['appointment.mark-no-show'].id]: 'close',
      [schedulingPermissions['appointment.attach-document'].id]: 'change',
      [schedulingPermissions['appointment.remove-document'].id]: 'change',
      [schedulingPermissions['appointment.read-document'].id]: 'read',
    },
  },
  person: {
    relations: { self: ['user'] },
    derived: { [notificationPermissions['notification.read'].id]: 'self' },
  },
});
