import { definePermissions } from '@ddd-ts-kit/auth';

export const notificationPermissions = definePermissions('notification', {
  // ddd-ts-kit:permissions
  'reminder.send': { description: 'Send due reminders' },
  'notification.send': { description: 'Send notification' },
  'reminder.plan': { description: 'Plan reminder' },
  'reminder.withdraw': { description: 'Withdraw reminder' },
  'notification.read': { description: 'Search notifications' },
  // /ddd-ts-kit:permissions
});
