import { IsString } from 'class-validator';

export class DefineAppointmentTypeParams {
  @IsString()
  declare calendarId: string;
}
