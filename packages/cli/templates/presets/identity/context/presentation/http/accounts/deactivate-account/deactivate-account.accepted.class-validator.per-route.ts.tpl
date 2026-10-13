import { IsString } from 'class-validator';

export class DeactivateAccountAccepted {
  @IsString()
  id = '';
}
