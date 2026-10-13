import { IsArray, IsISO8601, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

export class GrantDelegationBody {
  @IsString()
  @IsNotEmpty()
  delegateId = '';

  @IsArray()
  @IsIn(Object.values(MemberRight), { each: true })
  rights: MemberRight[] = [];

  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  endsAt = '';
}
