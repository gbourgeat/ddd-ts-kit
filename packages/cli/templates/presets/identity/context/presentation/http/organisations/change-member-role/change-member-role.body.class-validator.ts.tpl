import { IsIn } from 'class-validator';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export class ChangeMemberRoleBody {
  @IsIn(Object.values(MemberRole))
  role: MemberRole = MemberRole.Member;
}
