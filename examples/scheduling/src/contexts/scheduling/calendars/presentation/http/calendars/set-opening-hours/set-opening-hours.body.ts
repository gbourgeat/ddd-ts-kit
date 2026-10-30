import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { OpeningRangeDto } from '@/contexts/scheduling/presentation/http/shared/opening-range.dto';

export class SetOpeningHoursBody {
  /** Every range of the week; a weekday without any is closed. */
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OpeningRangeDto)
  declare ranges: OpeningRangeDto[];
}
