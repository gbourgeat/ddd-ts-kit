import type { AuditRow } from '@ddd-ts-kit/knex';
import type { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export interface InvitationColumns {
  readonly id: string;
  readonly organisation_id: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly token_hash: string;
  readonly invited_by: string;
  readonly delegation_id: string | null;
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly status: InvitationStatus;
  readonly answered_at: Date | null;
}

export interface InvitationRow extends InvitationColumns, AuditRow {
  readonly version: number;
}
