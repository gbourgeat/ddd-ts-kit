import { IsString } from 'class-validator';

/** An account became a member of an organisation, in a role. Version 1: a field may be added, never renamed nor removed. */
export class MemberJoinedV1Payload {
  @IsString()
  declare memberId: string;

  @IsString()
  declare organisationId: string;

  @IsString()
  declare accountId: string;

  @IsString()
  declare role: string;
}
