import { IsString } from 'class-validator';

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
}
