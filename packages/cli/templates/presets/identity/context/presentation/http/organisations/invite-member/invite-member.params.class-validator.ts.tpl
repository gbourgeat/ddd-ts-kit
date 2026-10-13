import { IsNotEmpty, IsString } from 'class-validator';

export class InviteMemberParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';
}
