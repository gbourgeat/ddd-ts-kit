import { IsString } from 'class-validator';

export class CalendarCreatedV1Payload {
  @IsString()
  declare calendarId: string;

  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare timeZone: string;
}
