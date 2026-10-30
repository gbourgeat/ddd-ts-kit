import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { OpeningRangeDto } from '@/contexts/scheduling/presentation/http/shared/opening-range.dto';

export class GetOpeningHoursAnswer {
  @IsString()
  declare calendarId: string;

  @IsString()
  declare timeZone: string;

  /** The version of the calendar, also its weak ETag: what a change of its hours names in `If-Match`. */
  @IsInt()
  @Min(0)
  declare version: number;

  /** Every range of the week, Monday first; a weekday without any is closed. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningRangeDto)
  declare ranges: OpeningRangeDto[];
}
