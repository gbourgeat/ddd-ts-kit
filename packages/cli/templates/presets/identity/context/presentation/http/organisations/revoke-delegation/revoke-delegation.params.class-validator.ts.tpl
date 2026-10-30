import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeDelegationParams {
  @IsString()
  @IsNotEmpty()
  declare organisationId: string;

  @IsString()
  @IsNotEmpty()
  declare delegationId: string;
}
