import { IsNotEmpty, IsString } from 'class-validator';

export class ChangeMemberRoleParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';

  @IsString()
  @IsNotEmpty()
  accountId = '';
}
