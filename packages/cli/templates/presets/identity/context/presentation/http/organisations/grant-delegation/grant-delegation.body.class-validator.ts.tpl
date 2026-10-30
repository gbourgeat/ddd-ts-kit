import { IsArray, IsISO8601, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

export class GrantDelegationBody {
  @IsString()
  @IsNotEmpty()
  declare delegateId: string;

  @IsArray()
  @IsIn(Object.values(MemberRight), { each: true })
  declare rights: MemberRight[];

  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare endsAt: string;
}
