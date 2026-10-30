import { IsEmail, IsIn, IsISO8601, IsString } from 'class-validator';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class SearchMembersLine {
  @IsString()
  declare memberId: string;

  @IsString()
  declare accountId: string;

  @IsString()
  declare displayName: string;

  @IsEmail()
  declare email: string;

  @IsIn(Object.values(MemberRole))
  declare role: string;

  @IsISO8601()
  declare joinedAt: string;
}
