import { IsNotEmpty, IsString } from 'class-validator';

export class GrantDelegationParams {
  @IsString()
  @IsNotEmpty()
  declare organisationId: string;
}
