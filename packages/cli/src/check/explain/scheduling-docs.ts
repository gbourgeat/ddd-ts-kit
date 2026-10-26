import type { RuleDoc } from '../model/rule-doc';

export const SCHEDULING_DOCS: Readonly<Record<string, RuleDoc>> = {
  'scheduling/job-triggers-use-case': {
    why: 'A job says when something happens, a use case says what. A job that loads an aggregate, calls a repository or an adapter is a use case nobody can send by another way: no permission, no unit of work, no audit entry, no test through the bus. Kept to one command sent through the CommandBus port, the job is a line of schedule, and the work is a handler like any other. It lives in application/scheduling/*.job.ts, implements ScheduledJob, and depends on buses and ports only.',
    bad: `// application/scheduling/send-reminders.job.ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';

@Scheduled('billing.send-reminders', { every: '15m' })
export class SendRemindersJob {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly mailer: Mailer,
  ) {}

  async run(): Promise<void> {
    for (const invoice of await this.invoices.findOverdue()) {
      await this.mailer.remind(invoice);
    }
  }
}`,
    good: `// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}`,
  },
  'scheduling/job-name': {
    why: 'The name of a job is its identity everywhere a run leaves a trace: the scheduler and its lock, the settings that enable or reschedule it, the logs, the metrics and the audit trail, where the job is the system actor of the command it sends. It is written once as a string literal, `<context>.<job-name>` in lower-case kebab-case, so that it survives the renaming of a class and tells which context owns the job. Two jobs under one name share a lock and overwrite each other, so a name is unique in the project.',
    bad: `@Scheduled(JOB_NAME, { every: '15m' })
@Scheduled('SendReminders', { every: '15m' })
// in contexts/billing
builder.job('shipping.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);
new SendRemindersCommand(systemActor('billing.reminders'), execution.scheduledAt);`,
    good: `@Scheduled('billing.send-reminders', { every: '15m' })
builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);
new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt);`,
  },
  'scheduling/tenancy-declared': {
    why: "Under tenancy, a job that declares no `tenancy` runs globally: one run per occurrence, in no tenant, as a system actor that names none. The tenant-scoped repository the handler reads refuses it at run time (`NoCurrentTenantError`), and the specs that use fakes never see it. The job says which it is: `tenancy: 'per-tenant'` runs it once per tenant of the `TenantDirectory`, each run in the execution scope of that tenant, so it reads one tenant at a time and one failing tenant does not stop the others; `tenancy: 'global'` is work across tenants, chosen on purpose. Judged on the options of every `@Scheduled(..)` and `builder.job(..)` outside the tests, in a project whose `stack.tenancy` is not `none`. What it cannot read is reported, never taken as safe: options that are not an object literal, a spread or a computed key in them, a `tenancy` that is not the literal `'per-tenant'` or `'global'`. An error from the first day.",
    bad: `@Scheduled('billing.send-reminders', { every: '15m' })
export class SendRemindersJob implements ScheduledJob {}`,
    good: `@Scheduled('billing.send-reminders', { every: '15m', tenancy: 'per-tenant' })
export class SendRemindersJob implements ScheduledJob {}`,
  },
};
