import { injected } from '@ddd-ts-kit/kernel/declarations';
import { ClearCalendarBackgroundJob } from '@/contexts/scheduling/application/calendars/background/clear-calendar.background-job';
import { ConfirmationDeadlineTimeoutBackgroundJob } from '@/contexts/scheduling/application/calendars/background/confirmation-deadline-timeout.background-job';
import { CommandBus, ProcessRunner } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/calendars/background/clear-calendar.background-job';
export * from '@/contexts/scheduling/application/calendars/background/confirmation-deadline-timeout.background-job';

injected(ClearCalendarBackgroundJob, [CommandBus]);
injected(ConfirmationDeadlineTimeoutBackgroundJob, [ProcessRunner]);
