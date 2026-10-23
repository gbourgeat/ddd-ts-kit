import { injected } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentCancelledEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-cancelled.event-handler';
import { AppointmentExpiredEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-expired.event-handler';
import { AppointmentRescheduledEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-rescheduled.event-handler';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-cancelled.event-handler';
export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-expired.event-handler';
export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-rescheduled.event-handler';

injected(AppointmentCancelledEventHandler, [CommandBus]);
injected(AppointmentExpiredEventHandler, [CommandBus]);
injected(AppointmentRescheduledEventHandler, [CommandBus]);
