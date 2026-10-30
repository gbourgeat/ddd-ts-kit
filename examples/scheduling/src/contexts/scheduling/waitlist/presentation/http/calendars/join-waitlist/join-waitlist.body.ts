import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class JoinWaitlistBody {
  @IsString()
  @IsNotEmpty()
  declare patientId: string;

  @IsString()
  @IsNotEmpty()
  declare appointmentTypeId: string;

  /** The day waited for, `YYYY-MM-DD` in the time zone of the practice. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;
}
