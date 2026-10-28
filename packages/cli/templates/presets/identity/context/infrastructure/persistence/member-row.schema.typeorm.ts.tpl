import type { AuditStamp } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export interface MemberColumns {
  id: string;
  organisationId: string;
  accountId: string;
  role: MemberRole;
  joinedAt: Date;
  removedAt: Date | null;
}

export interface MemberRow extends MemberColumns, AuditStamp {
  version: number;
}
