import { IsEmail, IsIn } from 'class-validator';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class InviteMemberBody {
  @IsEmail()
  declare email: string;

  @IsIn(Object.values(MemberRole))
  declare role: MemberRole;
}
