import { IsInt, IsString, Matches, Min } from 'class-validator';

export class SearchOccupancyLine {
  @IsString()
  declare id: string;

  @IsString()
  declare calendarId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;

  @IsInt()
  @Min(0)
  declare heldMinutes: number;

  @IsInt()
  @Min(0)
  declare appointmentsHeld: number;

  @IsInt()
  @Min(0)
  declare completed: number;

  @IsInt()
  @Min(0)
  declare noShows: number;

  @IsInt()
  @Min(0)
  declare cancelledByPatient: number;

  @IsInt()
  @Min(0)
  declare cancelledByPractice: number;
}
