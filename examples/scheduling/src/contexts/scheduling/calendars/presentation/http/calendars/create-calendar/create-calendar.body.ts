import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCalendarBody {
  @IsString()
  @IsNotEmpty()
  practiceId = '';

  @IsString()
  @IsNotEmpty()
  practitionerId = '';
}
