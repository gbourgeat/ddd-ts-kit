import { IsString } from 'class-validator';

export class GetClearanceParams {
  @IsString()
  calendarId = '';

  @IsString()
  clearanceId = '';
}
