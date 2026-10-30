import { IsString } from 'class-validator';

export class InviteMemberAccepted {
  @IsString()
  declare id: string;

  /** The token to send to the person, once: only its digest is stored. */
  @IsString()
  declare token: string;
}
