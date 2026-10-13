import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';
import { AttendanceFact } from '@/contexts/scheduling/domain/vocabularies/attendance-fact.vocabulary';

/** One fact of the attendance history of a patient: what was noted, when, and on which appointment. */
export class SearchAttendanceHistoryLine {
  /** Its rank in the history, from 1. */
  @IsInt()
  version = 0;

  @IsIn(Object.values(AttendanceFact))
  fact: AttendanceFact = AttendanceFact.Opened;

  @IsISO8601()
  notedAt = '';

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  /** The words of the patient who cancelled; `[erased]` once the patient was erased. */
  @IsOptional()
  @IsString()
  reason?: string;
}
