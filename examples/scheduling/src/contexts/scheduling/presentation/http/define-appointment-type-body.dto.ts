import { IsBoolean, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DefineAppointmentTypeBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name = '';

  /** How long an appointment lasts, in minutes. */
  @IsInt()
  duration = 0;

  /** The step, in minutes from midnight, on which appointments start. */
  @IsInt()
  grid = 0;

  /** The minutes kept free after an appointment. */
  @IsInt()
  buffer = 0;

  @IsBoolean()
  needsConfirmation = false;
}
