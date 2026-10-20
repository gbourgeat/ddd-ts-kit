import { injected } from '@ddd-ts-kit/kernel/declarations';
import { NotificationSentEventHandler } from '@/contexts/notification/application/event-handlers/notification-sent.event-handler';
import { ReminderSentEventHandler } from '@/contexts/notification/application/event-handlers/reminder-sent.event-handler';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/application/event-handlers/notification-sent.event-handler';
export * from '@/contexts/notification/application/event-handlers/reminder-sent.event-handler';

injected(NotificationSentEventHandler, [CommandBus]);
injected(ReminderSentEventHandler, [CommandBus]);
