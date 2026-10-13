export const NotificationKindName = {
  Request: 'request',
  Confirmation: 'confirmation',
  Rescheduling: 'rescheduling',
  Cancellation: 'cancellation',
  Reminder: 'reminder',
} as const;

export type NotificationKindName = (typeof NotificationKindName)[keyof typeof NotificationKindName];
