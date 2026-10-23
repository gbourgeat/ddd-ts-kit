import { injected } from '@ddd-ts-kit/kernel/declarations';
import { JoinWaitlistHandler } from '@/contexts/scheduling/application/waitlist/commands/join-waitlist/join-waitlist.handler';
import { OfferFreedSlotHandler } from '@/contexts/scheduling/application/waitlist/commands/offer-freed-slot/offer-freed-slot.handler';
import { AppointmentCancelledEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-cancelled.event-handler';
import { AppointmentExpiredEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-expired.event-handler';
import { AppointmentRescheduledEventHandler } from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-rescheduled.event-handler';
import { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { WaitlistRepository } from '@/contexts/scheduling/domain/waitlist/repositories/waitlist.repository';
import { Clock, CommandBus, IdGenerator } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/waitlist/commands/join-waitlist/join-waitlist.command';
export * from '@/contexts/scheduling/application/waitlist/commands/join-waitlist/join-waitlist.handler';
export * from '@/contexts/scheduling/application/waitlist/commands/offer-freed-slot/offer-freed-slot.command';
export * from '@/contexts/scheduling/application/waitlist/commands/offer-freed-slot/offer-freed-slot.handler';
export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-cancelled.event-handler';
export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-expired.event-handler';
export * from '@/contexts/scheduling/application/waitlist/event-handlers/appointment-rescheduled.event-handler';

injected(JoinWaitlistHandler, [WaitlistRepository, CalendarRepository, Clock]);
injected(OfferFreedSlotHandler, [WaitlistRepository, CalendarRepository, AppointmentRepository, IdGenerator, Clock]);
injected(AppointmentCancelledEventHandler, [CommandBus]);
injected(AppointmentExpiredEventHandler, [CommandBus]);
injected(AppointmentRescheduledEventHandler, [CommandBus]);
