import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentMarkedNoShow } from '#src/contexts/scheduling/domain/events/appointment-marked-no-show.event.js';
import { appointmentMarkedNoShowV1 } from '#src/contexts/scheduling/published-language/appointment-marked-no-show.v1.integration-event.js';

@DomainEventHandler(AppointmentMarkedNoShow, { name: 'scheduling.appointment.marked-no-show' }, [
  IntegrationEventPublisher,
  IdGenerator,
])
export class AppointmentMarkedNoShowPublisher implements DomainEventHandler<AppointmentMarkedNoShow> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentMarkedNoShow): Promise<void> {
    const booking = event.booking;

    const published = appointmentMarkedNoShowV1.create(
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
