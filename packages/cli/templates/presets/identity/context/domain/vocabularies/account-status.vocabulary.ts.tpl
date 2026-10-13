/** Whether an account may still act: a deactivated account keeps its history and signs in no more. */
export const AccountStatus = {
  Active: 'active',
  Deactivated: 'deactivated',
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];
