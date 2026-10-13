import { IsString } from 'class-validator';

export class ChangeMemberRoleAccepted {
  @IsString()
  id = '';
}
