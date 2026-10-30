import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeInvitationParams {
  @IsString()
  @IsNotEmpty()
  declare organisationId: string;

  @IsString()
  @IsNotEmpty()
  declare invitationId: string;
}
