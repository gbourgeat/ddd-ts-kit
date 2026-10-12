import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';

/** When an appointment is booked or requested, the platform learns whose it is and which calendar holds it: rights on it follow. */
@DomainEventHandler(AppointmentBooked, { name: 'scheduling.appointment.booked' })
export class AppointmentBookedEventHandler implements DomainEventHandler<AppointmentBooked> {
  constructor(private readonly relationships: SchedulingRelationships) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const { calendarId, patientId } = event.held.booking;

    await this.relationships.recordAppointment({ appointmentId: event.aggregateId, calendarId, patientId });
  }
}
