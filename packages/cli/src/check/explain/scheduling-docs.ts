import type { RuleDoc } from '../model/rule-doc.js';

export const SCHEDULING_DOCS: Readonly<Record<string, RuleDoc>> = {
  'scheduling/job-triggers-use-case': {
    why: 'A job says when something happens, a use case says what. A job that loads an aggregate, calls a repository or an adapter is a use case nobody can send by another way: no permission, no unit of work, no audit entry, no test through the bus. Kept to one command sent through the CommandBus port, the job is a line of schedule, and the work is a handler like any other. It lives in application/scheduling/*.job.ts, implements ScheduledJob, and depends on buses and ports only.',
    bad: `// application/scheduling/send-reminders.job.ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';

@Scheduled('billing.send-reminders', { every: '15m' }, [InvoiceRepository, Mailer])
export class SendRemindersJob {
  async run(): Promise<void> {
    for (const invoice of await this.invoices.findOverdue()) {
      await this.mailer.remind(invoice);
    }
  }
}`,
    good: `// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}`,
  },
  'scheduling/job-name': {
    why: 'The name of a job is its identity everywhere a run leaves a trace: the scheduler and its lock, the settings that enable or reschedule it, the logs, the metrics and the audit trail, where the job is the system actor of the command it sends. It is written once as a string literal, `<context>.<job-name>` in lower-case kebab-case, so that it survives the renaming of a class and tells which context owns the job. Two jobs under one name share a lock and overwrite each other, so a name is unique in the project.',
    bad: `@Scheduled(JOB_NAME, { every: '15m' }, [CommandBus])
@Scheduled('SendReminders', { every: '15m' }, [CommandBus])
// in contexts/billing
builder.job('shipping.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);
new SendRemindersCommand(systemActor('billing.reminders'), execution.scheduledAt);`,
    good: `@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])
builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);
new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt);`,
  },
};
