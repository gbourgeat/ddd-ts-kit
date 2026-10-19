export const IdentityCodes = {
  DelegationAlreadyActive: 'DELEGATION_ALREADY_ACTIVE',
  DelegationEndsInThePast: 'DELEGATION_ENDS_IN_THE_PAST',
  DelegationNotActive: 'DELEGATION_NOT_ACTIVE',
  UnknownDelegation: 'DELEGATION_NOT_FOUND',
  InvalidDisplayName: 'INVALID_DISPLAY_NAME',
  InvalidEmail: 'INVALID_EMAIL',
  PersonNotRegistered: 'PERSON_NOT_REGISTERED',
  AlreadyMember: 'ALREADY_MEMBER',
  NotAMember: 'NOT_A_MEMBER',
  NotAPractitioner: 'NOT_A_PRACTITIONER',
  NotAnAssistant: 'NOT_AN_ASSISTANT',
  PracticeLeftUnmanaged: 'LAST_MANAGER',
  UnknownPractice: 'PRACTICE_NOT_FOUND',
  UnknownRole: 'UNKNOWN_ROLE',
  UnknownTimeZone: 'UNKNOWN_TIME_ZONE',
} as const;

export type IdentityCode = (typeof IdentityCodes)[keyof typeof IdentityCodes];
