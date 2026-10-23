import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentBooked } from '@/contexts/scheduling/calendars/domain/events/appointment-booked.event';
import type { SchedulingRelationships } from '@/contexts/scheduling/calendars/application/ports/scheduling-relationships.port';

/** When an appointment is booked or requested, the platform learns whose it is and which calendar holds it: rights on it follow. */
@DomainEventHandler(AppointmentBooked)
export class AppointmentBookedEventHandler implements DomainEventHandler<AppointmentBooked> {
  constructor(private readonly relationships: SchedulingRelationships) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const { calendarId, patientId } = event.held.booking;

    await this.relationships.recordAppointment({ appointmentId: event.aggregateId, calendarId, patientId });
  }
}
