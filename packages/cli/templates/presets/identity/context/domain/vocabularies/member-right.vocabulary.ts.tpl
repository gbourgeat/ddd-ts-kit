/** What a member may do in an organisation, granted by a role or lent by a delegation. */
export const MemberRight = {
  ReadMembers: 'read-members',
  InviteMembers: 'invite-members',
  ManageMembers: 'manage-members',
  GrantDelegations: 'grant-delegations',
} as const;

export type MemberRight = (typeof MemberRight)[keyof typeof MemberRight];
