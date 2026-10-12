import { IsString } from 'class-validator';

export class GrantDelegationAccepted {
  @IsString()
  id = '';
}
