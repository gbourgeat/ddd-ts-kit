import { IsString } from 'class-validator';

/** A member left an organisation: what they reached there through it, they reach no more. Version 1: a field may be added, never renamed nor removed. */
export class MemberRemovedV1Payload {
  @IsString()
  memberId = '';

  @IsString()
  organisationId = '';

  @IsString()
  accountId = '';
}
