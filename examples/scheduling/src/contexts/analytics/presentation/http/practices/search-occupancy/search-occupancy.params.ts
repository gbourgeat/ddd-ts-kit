import { IsNotEmpty, IsString } from 'class-validator';

export class SearchOccupancyParams {
  @IsString()
  @IsNotEmpty()
  practiceId = '';
}
