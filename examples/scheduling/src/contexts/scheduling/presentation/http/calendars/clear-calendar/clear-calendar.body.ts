import { IsISO8601, IsString, MinLength } from 'class-validator';

export class ClearCalendarBody {
  @IsISO8601({ strict: true })
  startsAt = '';

  @IsISO8601({ strict: true })
  endsAt = '';

  /** What the patients of the cancelled appointments read. */
  @IsString()
  @MinLength(1)
  reason = '';
}
