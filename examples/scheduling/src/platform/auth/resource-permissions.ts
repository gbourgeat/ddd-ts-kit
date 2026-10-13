import type { PermissionMapping } from '@ddd-ts-kit/auth/rebac';
import { analyticsPermissions } from '@/contexts/analytics/application/authorization/analytics.permissions';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/**
 * Per type of element, the permission of the relationship schema each permission of a context
 * stands for there. Keyed by permission id: the same permission may be asked of two types
 * (`scheduling:agenda.read` of a practice or of one calendar) and mean something else on each.
 */
export const resourcePermissions: PermissionMapping = {
  practice: {
    [identityPermissions['member.add'].id]: 'manage',
    [identityPermissions['member.remove'].id]: 'manage',
    [schedulingPermissions['agenda.read'].id]: 'work',
    [schedulingPermissions['attendance.read'].id]: 'work',
    [analyticsPermissions['occupancy.read'].id]: 'work',
  },
  desk: {
    [identityPermissions['delegation.grant'].id]: 'own',
    [identityPermissions['delegation.revoke'].id]: 'own',
    [schedulingPermissions['calendar.create'].id]: 'own',
  },
  calendar: {
    [schedulingPermissions['calendar.set-opening-hours'].id]: 'plan',
    [schedulingPermissions['calendar.add-exception'].id]: 'plan',
    [schedulingPermissions['calendar.add-time-off'].id]: 'plan',
    [schedulingPermissions['calendar.define-appointment-type'].id]: 'plan',
    [schedulingPermissions['appointment.book'].id]: 'run',
    [schedulingPermissions['waitlist.join'].id]: 'run',
    [schedulingPermissions['agenda.read'].id]: 'run',
    [analyticsPermissions['occupancy.read'].id]: 'measure',
    [schedulingPermissions['appointment.note.read'].id]: 'staff',
    [schedulingPermissions['appointment.note.write'].id]: 'own',
  },
  appointment: {
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
  person: {
    [notificationPermissions['notification.read'].id]: 'be',
  },
};
