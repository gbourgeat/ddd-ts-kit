/** Where an invitation stands: pending until the person it is addressed to answers, or the organisation takes it back. */
export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  Revoked: 'revoked',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];
