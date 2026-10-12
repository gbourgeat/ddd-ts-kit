import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { appointmentBookedV1 } from '@/contexts/scheduling/published-language/appointment-booked.v1.integration-event';

@DomainEventHandler(AppointmentBooked, { name: 'scheduling.appointment.booked' })
export class AppointmentBookedPublisher implements DomainEventHandler<AppointmentBooked> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const booking = event.held.booking;

    const published = appointmentBookedV1.create(
      {
        appointmentId: event.aggregateId,
        calendarId: booking.calendarId,
        practiceId: booking.practiceId,
        practitionerId: booking.practitionerId,
        patientId: booking.patientId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        day: booking.day,
        status: event.held.confirmBefore === undefined ? 'booked' : 'requested',
        ...(event.held.confirmBefore === undefined ? {} : { confirmBefore: event.held.confirmBefore.toISOString() }),
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
