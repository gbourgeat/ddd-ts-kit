import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveMemberParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';

  @IsString()
  @IsNotEmpty()
  accountId = '';
}
