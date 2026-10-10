import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentExpired } from '#src/contexts/scheduling/domain/events/appointment-expired.event.js';
import { appointmentExpiredV1 } from '#src/contexts/scheduling/published-language/appointment-expired.v1.integration-event.js';

@DomainEventHandler(AppointmentExpired, { name: 'scheduling.appointment.expired' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class AppointmentExpiredPublisher implements DomainEventHandler<AppointmentExpired> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentExpired): Promise<void> {
    const booking = event.booking;

    const published = appointmentExpiredV1.create(
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
