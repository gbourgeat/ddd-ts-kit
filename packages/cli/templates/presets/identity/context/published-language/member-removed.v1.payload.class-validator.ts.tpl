import { IsOptional, IsString } from 'class-validator';

/** A member left an organisation: what they reached there through it, they reach no more. Version 1: a field may be added, never renamed nor removed. */
export class MemberRemovedV1Payload {
  @IsString()
  declare memberId: string;

  @IsString()
  declare organisationId: string;

  @IsString()
  declare accountId: string;

  /** The delegation that lent the right to decide it, when the role of who decided did not grant it. */
  @IsOptional()
  @IsString()
  declare delegationId?: string;
}
