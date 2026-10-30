import { IsArray, IsISO8601, IsString } from 'class-validator';

/** A member lent rights to another member of the organisation, from an instant to another. Version 1: a field may be added, never renamed nor removed. */
export class DelegationGrantedV1Payload {
  @IsString()
  declare delegationId: string;

  @IsString()
  declare organisationId: string;

  @IsString()
  declare delegatorId: string;

  @IsString()
  declare delegateId: string;

  @IsArray()
  @IsString({ each: true })
  declare rights: string[];

  /** An ISO 8601 instant. */
  @IsISO8601()
  declare startsAt: string;

  /** An ISO 8601 instant. */
  @IsISO8601()
  declare endsAt: string;
}
