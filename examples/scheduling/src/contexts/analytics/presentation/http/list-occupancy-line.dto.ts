import { IsInt, IsString, Matches, Min } from 'class-validator';

export class ListOccupancyLine {
  @IsString()
  id = '';

  @IsString()
  calendarId = '';

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day = '';

  @IsInt()
  @Min(0)
  heldMinutes = 0;

  @IsInt()
  @Min(0)
  appointmentsHeld = 0;

  @IsInt()
  @Min(0)
  completed = 0;

  @IsInt()
  @Min(0)
  noShows = 0;

  @IsInt()
  @Min(0)
  cancelledByPatient = 0;

  @IsInt()
  @Min(0)
  cancelledByPractice = 0;
}
