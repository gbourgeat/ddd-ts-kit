import { IsString } from 'class-validator';

export class SearchAttendanceHistoryParams {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare patientId: string;
}
