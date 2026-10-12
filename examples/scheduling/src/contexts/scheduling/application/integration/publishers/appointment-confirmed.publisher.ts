import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/events/appointment-confirmed.event';
import { appointmentConfirmedV1 } from '@/contexts/scheduling/published-language/appointment-confirmed.v1.integration-event';

@DomainEventHandler(AppointmentConfirmed, { name: 'scheduling.appointment.confirmed' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class AppointmentConfirmedPublisher implements DomainEventHandler<AppointmentConfirmed> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentConfirmed): Promise<void> {
    const booking = event.booking;

    const published = appointmentConfirmedV1.create(
      {
        appointmentId: event.aggregateId,
        calendarId: booking.calendarId,
        practiceId: booking.practiceId,
        practitionerId: booking.practitionerId,
        patientId: booking.patientId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        day: booking.day,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
