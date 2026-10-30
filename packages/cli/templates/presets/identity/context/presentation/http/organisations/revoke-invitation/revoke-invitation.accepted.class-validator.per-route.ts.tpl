import { IsString } from 'class-validator';

export class RevokeInvitationAccepted {
  @IsString()
  declare id: string;
}
