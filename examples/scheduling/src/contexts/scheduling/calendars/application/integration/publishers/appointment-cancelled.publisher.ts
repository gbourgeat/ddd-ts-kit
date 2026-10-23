import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentCancelled } from '@/contexts/scheduling/calendars/domain/events/appointment-cancelled.event';
import { appointmentCancelledV1 } from '@/contexts/scheduling/published-language/appointment-cancelled.v1.integration-event';

@DomainEventHandler(AppointmentCancelled)
export class AppointmentCancelledPublisher implements DomainEventHandler<AppointmentCancelled> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    const booking = event.ended.booking;

    const published = appointmentCancelledV1.create(
      {
        appointmentId: event.aggregateId,
        calendarId: booking.calendarId,
        practiceId: booking.practiceId,
        practitionerId: booking.practitionerId,
        patientId: booking.patientId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        day: booking.day,
        cancelledBy: event.ended.cancellation.by,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
