import { IsIn, IsString } from 'class-validator';

export class DelegationRevokedV1Payload {
  @IsString()
  declare delegationId: string;

  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare assistantId: string;

  @IsIn(['revoked', 'expired', 'member-removed'])
  declare cause: 'revoked' | 'expired' | 'member-removed';
}
