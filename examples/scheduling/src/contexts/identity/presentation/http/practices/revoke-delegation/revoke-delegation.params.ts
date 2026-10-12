import { IsString } from 'class-validator';

export class RevokeDelegationParams {
  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  delegationId = '';
}
