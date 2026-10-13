import { IsString } from 'class-validator';

export class AcceptInvitationAccepted {
  @IsString()
  id = '';
}
