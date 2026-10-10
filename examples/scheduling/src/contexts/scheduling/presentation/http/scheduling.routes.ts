import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { createCalendarRoute } from '@/contexts/scheduling/presentation/http/create-calendar.route.js';
import { bookAppointmentRoute } from '@/contexts/scheduling/presentation/http/book-appointment.route.js';
import { confirmAppointmentRoute } from '@/contexts/scheduling/presentation/http/confirm-appointment.route.js';
import { cancelAppointmentRoute } from '@/contexts/scheduling/presentation/http/cancel-appointment.route.js';
import { rescheduleAppointmentRoute } from '@/contexts/scheduling/presentation/http/reschedule-appointment.route.js';
import { completeAppointmentRoute } from '@/contexts/scheduling/presentation/http/complete-appointment.route.js';
import { markAppointmentNoShowRoute } from '@/contexts/scheduling/presentation/http/mark-appointment-no-show.route.js';
import { setOpeningHoursRoute } from '@/contexts/scheduling/presentation/http/set-opening-hours.route.js';
import { addExceptionRoute } from '@/contexts/scheduling/presentation/http/add-exception.route.js';
import { addTimeOffRoute } from '@/contexts/scheduling/presentation/http/add-time-off.route.js';
import { defineAppointmentTypeRoute } from '@/contexts/scheduling/presentation/http/define-appointment-type.route.js';
import { joinWaitlistRoute } from '@/contexts/scheduling/presentation/http/join-waitlist.route.js';
import { searchAppointmentsRoute } from '@/contexts/scheduling/presentation/http/search-appointments.route.js';
import { searchPracticeAgendaRoute } from '@/contexts/scheduling/presentation/http/search-practice-agenda.route.js';
import { getAppointmentRoute } from '@/contexts/scheduling/presentation/http/get-appointment.route.js';
import { getCalendarDayRoute } from '@/contexts/scheduling/presentation/http/get-calendar-day.route.js';
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
    searchAppointmentsRoute(queries),
    searchPracticeAgendaRoute(queries),
    getAppointmentRoute(queries),
    getCalendarDayRoute(queries),
    // /ddd-ts-kit:routes
  ];
}
