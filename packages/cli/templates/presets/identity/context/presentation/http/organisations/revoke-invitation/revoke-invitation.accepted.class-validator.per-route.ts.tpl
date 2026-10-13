import { IsString } from 'class-validator';

export class RevokeInvitationAccepted {
  @IsString()
  id = '';
}
