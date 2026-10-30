import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, Matches, ValidateNested } from 'class-validator';
import { DayRangeDto } from '@/contexts/scheduling/presentation/http/shared/day-range.dto';

export class AddExceptionBody {
  /** The day whose hours are replaced, `YYYY-MM-DD` in the time zone of the practice. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;

  /** The ranges the day is opened on; none closes it. */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DayRangeDto)
  declare ranges: DayRangeDto[];
}
