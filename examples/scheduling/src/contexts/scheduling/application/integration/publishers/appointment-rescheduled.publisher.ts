import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/events/appointment-rescheduled.event.js';
import { appointmentRescheduledV1 } from '@/contexts/scheduling/published-language/appointment-rescheduled.v1.integration-event.js';

@DomainEventHandler(AppointmentRescheduled, { name: 'scheduling.appointment.rescheduled' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class AppointmentRescheduledPublisher implements DomainEventHandler<AppointmentRescheduled> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentRescheduled): Promise<void> {
    const booking = event.moved.booking;

    const published = appointmentRescheduledV1.create(
      {
        appointmentId: event.aggregateId,
        calendarId: booking.calendarId,
        practiceId: booking.practiceId,
        practitionerId: booking.practitionerId,
        patientId: booking.patientId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        day: booking.day,
        previousStartsAt: event.moved.previous.slot.startsAt.toISOString(),
        previousDay: event.moved.previous.day,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
