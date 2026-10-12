import { systemActor, type CommandBus } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';
import { IssueInvoice } from '../commands/issue-invoice/issue-invoice.command.js';

@Scheduled('billing.issue-monthly-invoices', { cron: '0 6 1 * *', timeZone: 'Europe/Paris', timeoutMs: 600_000 })
export class IssueMonthlyInvoicesJob implements ScheduledJob {
  static readonly executions: JobExecution[] = [];

  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    IssueMonthlyInvoicesJob.executions.push(execution);

    await this.commands.execute(
      new IssueInvoice(systemActor('billing.issue-monthly-invoices'), 'customer-on-subscription'),
    );
  }
}
