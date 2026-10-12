import { IsString } from 'class-validator';

export class GrantDelegationParams {
  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';
}
