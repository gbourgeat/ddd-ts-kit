import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import type { InvitationColumns, InvitationRow } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';

export const InvitationMapper = {
  toDomain(row: InvitationRow): Invitation {
    const loaded = Invitation.rehydrate(row.id, {
      organisationId: row.organisation_id,
      email: EmailAddress.create(row.email),
      role: row.role,
      tokenHash: row.token_hash,
      invitedBy: row.invited_by,
      delegationId: row.delegation_id ?? undefined,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      status: row.status,
      answeredAt: row.answered_at ?? undefined,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Invitation): InvitationColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      organisation_id: state.organisationId,
      email: state.email.value,
      role: state.role,
      token_hash: state.tokenHash,
      invited_by: state.invitedBy,
      delegation_id: state.delegationId ?? null,
      issued_at: state.issuedAt,
      expires_at: state.expiresAt,
      status: state.status,
      answered_at: state.answeredAt ?? null,
    };
  },
};
