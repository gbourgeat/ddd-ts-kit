import { IsString } from 'class-validator';

export class SetOpeningHoursAccepted {
  @IsString()
  id = '';
}
