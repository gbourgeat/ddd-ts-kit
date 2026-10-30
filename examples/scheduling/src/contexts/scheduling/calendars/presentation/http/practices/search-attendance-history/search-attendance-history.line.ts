import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';
import { AttendanceFact } from '@/contexts/scheduling/calendars/domain/vocabularies/attendance-fact.vocabulary';

/** One fact of the attendance history of a patient: what was noted, when, and on which appointment. */
export class SearchAttendanceHistoryLine {
  /** Its rank in the history, from 1. */
  @IsInt()
  declare version: number;

  @IsIn(Object.values(AttendanceFact))
  declare fact: AttendanceFact;

  @IsISO8601()
  declare notedAt: string;

  @IsOptional()
  @IsString()
  declare appointmentId?: string;

  @IsOptional()
  @IsISO8601()
  declare startsAt?: string;

  /** The words of the patient who cancelled; `[erased]` once the patient was erased. */
  @IsOptional()
  @IsString()
  declare reason?: string;
}
