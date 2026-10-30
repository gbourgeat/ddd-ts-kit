import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAppointmentBody {
  /** Why the appointment is cancelled: required from the practice, free for the patient. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare reason?: string;
}
