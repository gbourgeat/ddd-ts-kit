import { IsString } from 'class-validator';

export class AddTimeOffParams {
  @IsString()
  declare calendarId: string;
}
