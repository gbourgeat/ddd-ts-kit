import { IsNotEmpty, IsString } from 'class-validator';

export class ListOccupancyParams {
  @IsString()
  @IsNotEmpty()
  practiceId = '';
}
