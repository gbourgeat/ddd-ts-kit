import { IsString } from 'class-validator';

export class RevokeDelegationParams {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare delegationId: string;
}
