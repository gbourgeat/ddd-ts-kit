import { IsOptional, IsString } from 'class-validator';

/** The role of a member of an organisation changed. Version 1: a field may be added, never renamed nor removed. */
export class MemberRoleChangedV1Payload {
  @IsString()
  memberId = '';

  @IsString()
  organisationId = '';

  @IsString()
  accountId = '';

  @IsString()
  from = '';

  @IsString()
  to = '';

  /** The delegation that lent the right to decide it, when the role of who decided did not grant it. */
  @IsOptional()
  @IsString()
  delegationId?: string;
}
