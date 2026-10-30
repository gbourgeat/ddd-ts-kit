import { IsString } from 'class-validator';

export class AcceptInvitationAccepted {
  @IsString()
  declare id: string;
}
