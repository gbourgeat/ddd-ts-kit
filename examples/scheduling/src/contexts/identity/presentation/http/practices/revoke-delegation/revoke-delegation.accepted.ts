import { IsString } from 'class-validator';

export class RevokeDelegationAccepted {
  @IsString()
  id = '';
}
