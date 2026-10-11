import { Repository } from '@ddd-ts-kit/kernel';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';

export abstract class AppointmentRepository extends Repository<Appointment> {
  /** The active appointments of a calendar that hold an instant between `from` and `until`, buffer included. */
  abstract heldOn(calendarId: string, from: Date, until: Date): Promise<readonly Appointment[]>;

  /** The active appointments of a patient with a practitioner that start after `instant`, whatever the calendar. */
  abstract heldBy(patientId: string, practitionerId: string, instant: Date): Promise<readonly Appointment[]>;

  /** The requested appointments whose confirmation deadline is `instant` or earlier. */
  abstract unconfirmedAt(instant: Date): Promise<readonly Appointment[]>;
}
