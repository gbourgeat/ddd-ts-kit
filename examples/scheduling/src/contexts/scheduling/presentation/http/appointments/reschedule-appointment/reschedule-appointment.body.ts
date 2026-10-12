import { IsISO8601 } from 'class-validator';

export class RescheduleAppointmentBody {
  /** The instant the appointment starts from now on, ISO 8601 with its zone. */
  @IsISO8601({ strict: true })
  startsAt = '';
}
