import { IsEmail, IsIn, IsISO8601, IsString } from 'class-validator';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class SearchMembersLine {
  @IsString()
  memberId = '';

  @IsString()
  accountId = '';

  @IsString()
  displayName = '';

  @IsEmail()
  email = '';

  @IsIn(Object.values(MemberRole))
  role = '';

  @IsISO8601()
  joinedAt = '';
}
