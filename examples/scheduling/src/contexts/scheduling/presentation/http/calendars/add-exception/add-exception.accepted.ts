import { IsString } from 'class-validator';

export class AddExceptionAccepted {
  @IsString()
  id = '';
}
