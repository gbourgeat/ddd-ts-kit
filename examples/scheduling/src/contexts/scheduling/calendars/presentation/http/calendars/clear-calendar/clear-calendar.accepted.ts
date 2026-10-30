import { IsString } from 'class-validator';

export class ClearCalendarAccepted {
  /** The identifier of the clearance, to follow it at `GET /calendars/:calendarId/clearances/:clearanceId`. */
  @IsString()
  declare id: string;
}
