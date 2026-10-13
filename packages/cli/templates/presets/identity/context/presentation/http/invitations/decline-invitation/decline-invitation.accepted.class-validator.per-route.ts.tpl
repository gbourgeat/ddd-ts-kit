import { IsString } from 'class-validator';

export class DeclineInvitationAccepted {
  @IsString()
  id = '';
}
