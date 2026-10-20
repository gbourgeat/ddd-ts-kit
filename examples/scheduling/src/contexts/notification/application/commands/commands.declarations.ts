import { injected } from '@ddd-ts-kit/kernel/declarations';
import { PlanReminderHandler } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.handler';
import { SendDueRemindersHandler } from '@/contexts/notification/application/commands/send-due-reminders/send-due-reminders.handler';
import { SendNotificationHandler } from '@/contexts/notification/application/commands/send-notification/send-notification.handler';
import { WithdrawReminderHandler } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';
export * from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.handler';
export * from '@/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command';
export * from '@/contexts/notification/application/commands/send-due-reminders/send-due-reminders.handler';
export * from '@/contexts/notification/application/commands/send-notification/send-notification.command';
export * from '@/contexts/notification/application/commands/send-notification/send-notification.handler';
export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';
export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';

injected(PlanReminderHandler, [ReminderRepository, IdGenerator, Clock]);
injected(SendDueRemindersHandler, [ReminderRepository]);
injected(SendNotificationHandler, [NotificationRepository, Contacts, Mailer, IdGenerator, Clock]);
injected(WithdrawReminderHandler, [ReminderRepository]);
