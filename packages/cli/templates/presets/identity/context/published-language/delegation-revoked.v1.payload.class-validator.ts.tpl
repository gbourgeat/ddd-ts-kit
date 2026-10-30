import { IsString } from 'class-validator';

/** A delegation ended before its period: what it lent, the delegate holds no more. Version 1: a field may be added, never renamed nor removed. */
export class DelegationRevokedV1Payload {
  @IsString()
  declare delegationId: string;

  @IsString()
  declare organisationId: string;

  @IsString()
  declare delegatorId: string;

  @IsString()
  declare delegateId: string;
}
