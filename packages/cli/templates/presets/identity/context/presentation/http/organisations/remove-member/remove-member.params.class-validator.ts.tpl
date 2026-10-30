import { IsNotEmpty, IsString } from 'class-validator';

export class RemoveMemberParams {
  @IsString()
  @IsNotEmpty()
  declare organisationId: string;

  @IsString()
  @IsNotEmpty()
  declare accountId: string;
}
