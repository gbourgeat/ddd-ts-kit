import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCalendarBody {
  @IsString()
  @IsNotEmpty()
  declare practiceId: string;

  @IsString()
  @IsNotEmpty()
  declare practitionerId: string;
}
