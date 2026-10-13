import { IsNotEmpty, IsString } from 'class-validator';

/** What a person names an invitation by, to accept or to decline it: declared once, the contract documents it once. */
export class InvitationToken {
  /** The token the invitation was sent with. */
  @IsString()
  @IsNotEmpty()
  token = '';
}
