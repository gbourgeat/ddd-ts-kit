import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeDelegationParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';

  @IsString()
  @IsNotEmpty()
  delegationId = '';
}
