import { IsNotEmpty, IsString } from 'class-validator';

export class ChangeMemberRoleParams {
  @IsString()
  @IsNotEmpty()
  declare organisationId: string;

  @IsString()
  @IsNotEmpty()
  declare accountId: string;
}
