import { IsString } from 'class-validator';

export class SearchAttendanceHistoryParams {
  @IsString()
  practiceId = '';

  @IsString()
  patientId = '';
}
