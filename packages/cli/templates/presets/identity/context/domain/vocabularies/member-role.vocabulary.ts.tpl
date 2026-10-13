/** The role of a member in an organisation: what the member may do there follows from it (`RoleRightsService`). */
export const MemberRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;

export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
