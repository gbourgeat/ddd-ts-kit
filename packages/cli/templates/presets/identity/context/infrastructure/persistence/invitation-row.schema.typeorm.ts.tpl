import type { AuditStamp } from '@ddd-ts-kit/kernel';
import type { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

export interface InvitationColumns {
  id: string;
  organisationId: string;
  email: string;
  role: MemberRole;
  tokenHash: string;
  invitedBy: string;
  issuedAt: Date;
  expiresAt: Date;
  status: InvitationStatus;
  answeredAt: Date | null;
}

export interface InvitationRow extends InvitationColumns, AuditStamp {
  version: number;
}
