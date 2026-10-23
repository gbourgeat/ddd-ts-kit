import { IsOptional, IsString } from 'class-validator';
import { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';

/** One appointment as its line in a list shows it, with the name of its patient when identity gave it. */
export class GetAppointmentAnswer extends AgendaLine {
  @IsOptional()
  @IsString()
  patientName?: string;

  /** Shown to the staff of the calendar only: the controller declares it reserved. */
  @IsOptional()
  @IsString()
  internalNote?: string;
}
