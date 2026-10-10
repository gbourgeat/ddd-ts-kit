import { IsIn, IsString } from 'class-validator';

export class DelegationRevokedV1Payload {
  @IsString()
  delegationId = '';

  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  assistantId = '';

  @IsIn(['revoked', 'expired', 'member-removed'])
  cause: 'revoked' | 'expired' | 'member-removed' = 'revoked';
}
