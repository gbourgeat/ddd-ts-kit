import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentMarkedNoShow } from '@/contexts/scheduling/calendars/domain/events/appointment-marked-no-show.event';
import { appointmentMarkedNoShowV1 } from '@/contexts/scheduling/published-language/appointment-marked-no-show.v1.integration-event';

@DomainEventHandler(AppointmentMarkedNoShow)
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
