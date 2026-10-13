import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeInvitationParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';

  @IsString()
  @IsNotEmpty()
  invitationId = '';
}
