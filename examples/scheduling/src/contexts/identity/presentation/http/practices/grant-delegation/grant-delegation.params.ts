import { IsString } from 'class-validator';

export class GrantDelegationParams {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;
}
