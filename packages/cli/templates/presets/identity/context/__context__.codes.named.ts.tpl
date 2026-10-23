/** The codes of the refusals of {{context.words}}: one per refusal class of `domain/errors/`, named after it. The code is the contract a client reads. */
export const {{context.pascal}}Codes = {
  UnknownAccount: 'ACCOUNT_NOT_FOUND',
  DeactivatedAccount: 'ACCOUNT_DEACTIVATED',
  AccountAlreadyDeactivated: 'ACCOUNT_ALREADY_DEACTIVATED',
  EmailNotVerified: 'EMAIL_NOT_VERIFIED',
  InvalidEmailAddress: 'INVALID_EMAIL_ADDRESS',
  InvalidDisplayName: 'INVALID_DISPLAY_NAME',
  UnknownOrganisation: 'ORGANISATION_NOT_FOUND',
  OrganisationSlugTaken: 'ORGANISATION_SLUG_TAKEN',
  InvalidOrganisationName: 'INVALID_ORGANISATION_NAME',
  InvalidOrganisationSlug: 'INVALID_ORGANISATION_SLUG',
  UnknownMember: 'MEMBER_NOT_FOUND',
  AlreadyMember: 'ALREADY_MEMBER',
  LastOwner: 'LAST_OWNER',
  NotAnOwner: 'OWNERS_ONLY',
  OwnRole: 'OWN_ROLE',
  AboveOwnRole: 'ABOVE_OWN_ROLE',
  UnknownInvitation: 'INVITATION_NOT_FOUND',
  InvitationExpired: 'INVITATION_EXPIRED',
  InvitationNotPending: 'INVITATION_NOT_PENDING',
  InvitationNotAddressedToAccount: 'INVITATION_ADDRESSED_TO_ANOTHER',
  UnknownDelegation: 'DELEGATION_NOT_FOUND',
  DelegationNotActive: 'DELEGATION_NOT_ACTIVE',
  DelegationToOneself: 'DELEGATION_TO_ONESELF',
  DelegationWithNoRight: 'DELEGATION_WITHOUT_RIGHTS',
  RightNotInRole: 'DELEGATION_BEYOND_RIGHTS',
  DelegationPeriodInverted: 'DELEGATION_PERIOD_INVERTED',
  DelegationTooLong: 'DELEGATION_TOO_LONG',
} as const;

/** One code of a refusal of {{context.words}}, for a signature that takes any of them. */
export type {{context.pascal}}Code = (typeof {{context.pascal}}Codes)[keyof typeof {{context.pascal}}Codes];
