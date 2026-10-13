import { IsArray, IsISO8601, IsString } from 'class-validator';

/** A member lent rights to another member of the organisation, from an instant to another. Version 1: a field may be added, never renamed nor removed. */
export class DelegationGrantedV1Payload {
  @IsString()
  delegationId = '';

  @IsString()
  organisationId = '';

  @IsString()
  delegatorId = '';

  @IsString()
  delegateId = '';

  @IsArray()
  @IsString({ each: true })
  rights: string[] = [];

  /** An ISO 8601 instant. */
  @IsISO8601()
  startsAt = '';

  /** An ISO 8601 instant. */
  @IsISO8601()
  endsAt = '';
}
