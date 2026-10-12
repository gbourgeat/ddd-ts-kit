import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { createCalendarRoute } from '@/contexts/scheduling/presentation/http/create-calendar.route';
import { bookAppointmentRoute } from '@/contexts/scheduling/presentation/http/book-appointment.route';
import { confirmAppointmentRoute } from '@/contexts/scheduling/presentation/http/confirm-appointment.route';
import { cancelAppointmentRoute } from '@/contexts/scheduling/presentation/http/cancel-appointment.route';
import { rescheduleAppointmentRoute } from '@/contexts/scheduling/presentation/http/reschedule-appointment.route';
import { completeAppointmentRoute } from '@/contexts/scheduling/presentation/http/complete-appointment.route';
import { markAppointmentNoShowRoute } from '@/contexts/scheduling/presentation/http/mark-appointment-no-show.route';
import { setOpeningHoursRoute } from '@/contexts/scheduling/presentation/http/set-opening-hours.route';
import { addExceptionRoute } from '@/contexts/scheduling/presentation/http/add-exception.route';
import { addTimeOffRoute } from '@/contexts/scheduling/presentation/http/add-time-off.route';
import { defineAppointmentTypeRoute } from '@/contexts/scheduling/presentation/http/define-appointment-type.route';
import { joinWaitlistRoute } from '@/contexts/scheduling/presentation/http/join-waitlist.route';
import { searchAppointmentsRoute } from '@/contexts/scheduling/presentation/http/search-appointments.route';
import { searchPracticeAgendaRoute } from '@/contexts/scheduling/presentation/http/search-practice-agenda.route';
import { getAppointmentRoute } from '@/contexts/scheduling/presentation/http/get-appointment.route';
import { getCalendarDayRoute } from '@/contexts/scheduling/presentation/http/get-calendar-day.route';
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
