import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { OpeningRangeDto } from '@/contexts/scheduling/presentation/http/opening-range.dto.js';

export class SetOpeningHoursBody {
  /** Every range of the week; a weekday without any is closed. */
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OpeningRangeDto)
  ranges: OpeningRangeDto[] = [];
}
