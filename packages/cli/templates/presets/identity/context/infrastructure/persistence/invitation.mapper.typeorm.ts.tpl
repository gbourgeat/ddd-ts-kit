import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import type { InvitationColumns, InvitationRow } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';

export const InvitationMapper = {
  toDomain(row: InvitationRow): Invitation {
    const loaded = Invitation.rehydrate(row.id, {
      organisationId: row.organisationId,
      email: EmailAddress.create(row.email),
      role: row.role,
      tokenHash: row.tokenHash,
      invitedBy: row.invitedBy,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      status: row.status,
      answeredAt: row.answeredAt ?? undefined,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Invitation): InvitationColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      organisationId: state.organisationId,
      email: state.email.value,
      role: state.role,
      tokenHash: state.tokenHash,
      invitedBy: state.invitedBy,
      issuedAt: state.issuedAt,
      expiresAt: state.expiresAt,
      status: state.status,
      answeredAt: state.answeredAt ?? null,
    };
  },
};
