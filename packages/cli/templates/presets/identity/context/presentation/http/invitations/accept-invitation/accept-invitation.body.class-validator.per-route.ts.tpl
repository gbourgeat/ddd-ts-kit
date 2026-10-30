import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInvitationBody {
  /** The token the invitation was sent with. */
  @IsString()
  @IsNotEmpty()
  declare token: string;
}
