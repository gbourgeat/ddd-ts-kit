export const ReminderStatus = {
  Planned: 'planned',
  Sent: 'sent',
  Withdrawn: 'withdrawn',
} as const;

export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];
