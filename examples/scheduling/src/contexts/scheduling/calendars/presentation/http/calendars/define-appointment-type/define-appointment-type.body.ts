import { IsBoolean, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DefineAppointmentTypeBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  declare name: string;

  /** How long an appointment lasts, in minutes. */
  @IsInt()
  declare duration: number;

  /** The step, in minutes from midnight, on which appointments start. */
  @IsInt()
  declare grid: number;

  /** The minutes kept free after an appointment. */
  @IsInt()
  declare buffer: number;

  @IsBoolean()
  declare needsConfirmation: boolean;
}
