import { IsString } from 'class-validator';

export class GrantDelegationAccepted {
  @IsString()
  declare id: string;
}
