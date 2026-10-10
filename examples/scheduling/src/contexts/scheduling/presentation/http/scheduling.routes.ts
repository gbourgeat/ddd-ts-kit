import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { createCalendarRoute } from './create-calendar.route.js';
import { bookAppointmentRoute } from './book-appointment.route.js';
import { confirmAppointmentRoute } from './confirm-appointment.route.js';
import { cancelAppointmentRoute } from './cancel-appointment.route.js';
import { rescheduleAppointmentRoute } from './reschedule-appointment.route.js';
import { completeAppointmentRoute } from './complete-appointment.route.js';
import { markAppointmentNoShowRoute } from './mark-appointment-no-show.route.js';
import { setOpeningHoursRoute } from './set-opening-hours.route.js';
import { addExceptionRoute } from './add-exception.route.js';
import { addTimeOffRoute } from './add-time-off.route.js';
import { defineAppointmentTypeRoute } from './define-appointment-type.route.js';
import { joinWaitlistRoute } from './join-waitlist.route.js';
import { listAppointmentsRoute } from './list-appointments.route.js';
import { listPracticeAgendaRoute } from './list-practice-agenda.route.js';
import { getAppointmentRoute } from './get-appointment.route.js';
import { getCalendarDayRoute } from './get-calendar-day.route.js';
// /ddd-ts-kit:imports

export function schedulingRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {
  return [
    // ddd-ts-kit:routes
    createCalendarRoute(commands),
    bookAppointmentRoute(commands),
    confirmAppointmentRoute(commands),
    cancelAppointmentRoute(commands),
    rescheduleAppointmentRoute(commands),
    completeAppointmentRoute(commands),
    markAppointmentNoShowRoute(commands),
    setOpeningHoursRoute(commands),
    addExceptionRoute(commands),
    addTimeOffRoute(commands),
    defineAppointmentTypeRoute(commands),
    joinWaitlistRoute(commands),
    listAppointmentsRoute(queries),
    listPracticeAgendaRoute(queries),
    getAppointmentRoute(queries),
    getCalendarDayRoute(queries),
    // /ddd-ts-kit:routes
  ];
}
