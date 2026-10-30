import { IsString } from 'class-validator';

export class GetClearanceParams {
  @IsString()
  declare calendarId: string;

  @IsString()
  declare clearanceId: string;
}
