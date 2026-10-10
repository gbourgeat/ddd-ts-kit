import { IsOptional, IsString } from 'class-validator';
import { ListAppointmentsLine } from './list-appointments-line.dto.js';

/** One appointment as its line in a list shows it, with the name of its patient when identity gave it. */
export class GetAppointmentAnswer extends ListAppointmentsLine {
  @IsOptional()
  @IsString()
  patientName?: string;
}
