import { IsString } from 'class-validator';

export class DeclineInvitationAccepted {
  @IsString()
  declare id: string;
}
