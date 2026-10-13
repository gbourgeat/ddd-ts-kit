import { IsString } from 'class-validator';

export class InviteMemberAccepted {
  @IsString()
  id = '';

  /** The token to send to the person, once: only its digest is stored. */
  @IsString()
  token = '';
}
