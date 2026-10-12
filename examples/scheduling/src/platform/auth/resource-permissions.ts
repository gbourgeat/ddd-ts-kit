import type { PermissionMapping } from '@ddd-ts-kit/auth/rebac';

/**
 * Per type of element, the permission of the relationship schema each permission of a context
 * stands for there. Keyed by permission id: the same permission may be asked of two types
 * (`scheduling:agenda.read` of a practice or of one calendar) and mean something else on each.
 */
export const resourcePermissions: PermissionMapping = {
  practice: {
    'identity:member.add': 'manage',
    'identity:member.remove': 'manage',
    'scheduling:agenda.read': 'work',
    'scheduling:attendance.read': 'work',
    'analytics:occupancy.read': 'work',
  },
  desk: {
    'identity:delegation.grant': 'own',
    'identity:delegation.revoke': 'own',
    'scheduling:calendar.create': 'own',
  },
  calendar: {
    'scheduling:calendar.set-opening-hours': 'plan',
    'scheduling:calendar.add-exception': 'plan',
    'scheduling:calendar.add-time-off': 'plan',
    'scheduling:calendar.define-appointment-type': 'plan',
    'scheduling:appointment.book': 'run',
    'scheduling:waitlist.join': 'run',
    'scheduling:agenda.read': 'run',
    'analytics:occupancy.read': 'measure',
  },
  appointment: {
    'scheduling:appointment.read': 'read',
    'scheduling:appointment.cancel': 'change',
    'scheduling:appointment.reschedule': 'change',
    'scheduling:appointment.confirm': 'change',
    'scheduling:appointment.complete': 'close',
    'scheduling:appointment.mark-no-show': 'close',
  },
  person: {
    'notification:notification.read': 'be',
  },
};
