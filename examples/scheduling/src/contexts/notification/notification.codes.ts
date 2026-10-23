export const NotificationCodes = {
  ContactUnknown: 'CONTACT_UNKNOWN',
  InvalidNotificationKind: 'INVALID_NOTIFICATION_KIND',
  ReminderNotDue: 'REMINDER_NOT_DUE',
} as const;

export type NotificationCode = (typeof NotificationCodes)[keyof typeof NotificationCodes];
