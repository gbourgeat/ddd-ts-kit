import { injected } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentBookedPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-booked.publisher';
import { AppointmentCancelledPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-cancelled.publisher';
import { AppointmentCompletedPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-completed.publisher';
import { AppointmentConfirmedPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-confirmed.publisher';
import { AppointmentExpiredPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-expired.publisher';
import { AppointmentMarkedNoShowPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-marked-no-show.publisher';
import { AppointmentRescheduledPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-rescheduled.publisher';
import { CalendarCreatedPublisher } from '@/contexts/scheduling/application/calendars/integration/publishers/calendar-created.publisher';
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-booked.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-cancelled.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-completed.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-confirmed.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-expired.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-marked-no-show.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/appointment-rescheduled.publisher';
export * from '@/contexts/scheduling/application/calendars/integration/publishers/calendar-created.publisher';

injected(AppointmentBookedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentCancelledPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentCompletedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentConfirmedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentExpiredPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentMarkedNoShowPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(AppointmentRescheduledPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(CalendarCreatedPublisher, [IntegrationEventPublisher, IdGenerator]);
