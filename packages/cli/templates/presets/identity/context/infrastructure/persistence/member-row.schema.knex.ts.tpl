import type { AuditRow } from '@ddd-ts-kit/knex';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export interface MemberColumns {
  readonly id: string;
  readonly organisation_id: string;
  readonly account_id: string;
  readonly role: MemberRole;
  readonly joined_at: Date;
  readonly removed_at: Date | null;
}

export interface MemberRow extends MemberColumns, AuditRow {
  readonly version: number;
}
