import { IsString } from 'class-validator';

/** An account became a member of an organisation, in a role. Version 1: a field may be added, never renamed nor removed. */
export class MemberJoinedV1Payload {
  @IsString()
  memberId = '';

  @IsString()
  organisationId = '';

  @IsString()
  accountId = '';

  @IsString()
  role = '';
}
