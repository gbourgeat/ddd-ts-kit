import { IsOptional, IsString } from 'class-validator';
import { SearchAppointmentsLine } from '@/contexts/scheduling/presentation/http/search-appointments-line.dto.js';

/** One appointment as its line in a list shows it, with the name of its patient when identity gave it. */
export class GetAppointmentAnswer extends SearchAppointmentsLine {
  @IsOptional()
  @IsString()
  patientName?: string;
}
