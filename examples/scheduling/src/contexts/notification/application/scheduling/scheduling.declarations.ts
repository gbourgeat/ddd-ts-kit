import { injected } from '@ddd-ts-kit/kernel/declarations';
import { SendDueRemindersJob } from '@/contexts/notification/application/scheduling/send-due-reminders.job';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/application/scheduling/send-due-reminders.job';

injected(SendDueRemindersJob, [CommandBus]);
