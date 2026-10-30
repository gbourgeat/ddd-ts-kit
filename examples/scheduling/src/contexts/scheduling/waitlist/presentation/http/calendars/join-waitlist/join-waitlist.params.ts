import { IsString } from 'class-validator';

export class JoinWaitlistParams {
  @IsString()
  declare calendarId: string;
}
