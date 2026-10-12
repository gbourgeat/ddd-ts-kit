import { IsString } from 'class-validator';

export class RegisterPersonAccepted {
  @IsString()
  id = '';
}
