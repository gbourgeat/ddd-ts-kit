export const DelegationEndCause = {
  Revoked: 'revoked',
  Expired: 'expired',
  MemberRemoved: 'member-removed',
} as const;

export type DelegationEndCause = (typeof DelegationEndCause)[keyof typeof DelegationEndCause];
