import { IsEmail, IsIn } from 'class-validator';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class InviteMemberBody {
  @IsEmail()
  email = '';

  @IsIn(Object.values(MemberRole))
  role: MemberRole = MemberRole.Member;
}
