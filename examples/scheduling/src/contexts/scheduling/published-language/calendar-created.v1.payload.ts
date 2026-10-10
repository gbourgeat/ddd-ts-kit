import { IsString } from 'class-validator';

export class CalendarCreatedV1Payload {
  @IsString()
  calendarId = '';

  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  timeZone = '';
}
