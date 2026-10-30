import { IsString } from 'class-validator';

export class AddExceptionParams {
  @IsString()
  declare calendarId: string;
}
