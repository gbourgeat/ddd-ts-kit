import { ConceptError } from '@ddd-ts-kit/kernel';

/** What the invitations refuse. The token of an invitation is never a fact of a refusal. */
export class InvitationError extends ConceptError {
  static notFound() {
    return InvitationError.refusal('INVITATION_NOT_FOUND', 'No invitation answers this token or this identifier.');
  }

  static expired(invitationId: string, expiresAt: Date) {
    return InvitationError.refusal('INVITATION_EXPIRED', `The invitation ${invitationId} expired.`, {
      invitationId,
      expiresAt,
    }).exposing('expiresAt');
  }

  static notPending(invitationId: string, status: string) {
    return InvitationError.refusal('INVITATION_NOT_PENDING', `The invitation ${invitationId} is already ${status}.`, {
      invitationId,
      status,
    }).exposing('status');
  }

  static addressedToAnother(invitationId: string) {
    return InvitationError.refusal(
      'INVITATION_ADDRESSED_TO_ANOTHER',
      `The invitation ${invitationId} is addressed to another email address than the account's.`,
      { invitationId },
    );
  }

  static withdrawn(invitationId: string) {
    return InvitationError.refusal(
      'INVITATION_WITHDRAWN',
      `The invitation ${invitationId} is withdrawn: its issuer may no longer invite in its role.`,
      { invitationId },
    );
  }
}
