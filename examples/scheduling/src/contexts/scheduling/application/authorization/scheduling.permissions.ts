import { definePermissions } from '@ddd-ts-kit/auth';

export const schedulingPermissions = definePermissions('scheduling', {
  // ddd-ts-kit:permissions
  'appointment.cancel': { description: 'Patient cancels until notice' },
  'appointment.reschedule': { description: 'Patient reschedules until notice' },
  'appointment.expire': { description: 'Expire unconfirmed appointments' },
  'calendar.create': { description: 'Create calendar' },
  'appointment.book': { description: 'Book appointment' },
  'appointment.confirm': { description: 'Confirm appointment' },
  'appointment.complete': { description: 'Complete appointment' },
  'appointment.mark-no-show': { description: 'Mark appointment no show' },
  'calendar.set-opening-hours': { description: 'Set opening hours' },
  'calendar.add-exception': { description: 'Add exception' },
  'calendar.add-time-off': { description: 'Add time off' },
  'calendar.define-appointment-type': { description: 'Define appointment type' },
  'waitlist.join': { description: 'Join waitlist' },
  'waitlist.offer': { description: 'Offer freed slot' },
  'appointment.search': { description: 'Search appointments' },
  'agenda.read': { description: 'Search practice agenda' },
  'appointment.read': { description: 'Get appointment' },
  'calendar.browse': { description: 'Get calendar day' },
  // /ddd-ts-kit:permissions
});
