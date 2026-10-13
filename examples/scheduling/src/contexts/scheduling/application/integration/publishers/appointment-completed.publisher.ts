import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentCompleted } from '@/contexts/scheduling/domain/events/appointment-completed.event';
import { appointmentCompletedV1 } from '@/contexts/scheduling/published-language/appointment-completed.v1.integration-event';

@DomainEventHandler(AppointmentCompleted, { name: AppointmentCompleted.eventName })
export class AppointmentCompletedPublisher implements DomainEventHandler<AppointmentCompleted> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentCompleted): Promise<void> {
    const booking = event.booking;

    const published = appointmentCompletedV1.create(
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
