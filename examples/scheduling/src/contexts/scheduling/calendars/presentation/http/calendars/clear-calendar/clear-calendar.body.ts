import { IsISO8601, IsString, MinLength } from 'class-validator';

export class ClearCalendarBody {
  @IsISO8601({ strict: true })
  declare startsAt: string;

  @IsISO8601({ strict: true })
  declare endsAt: string;

  /** What the patients of the cancelled appointments read. */
  @IsString()
  @MinLength(1)
  declare reason: string;
}
