import { IsString } from 'class-validator';

export class ChangeMemberRoleAccepted {
  @IsString()
  declare id: string;
}
