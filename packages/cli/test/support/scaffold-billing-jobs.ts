const term = (row: string): string[] => ['--term', row];

/** One job on an interval and one on a cron expression read in a time zone, each sending a protected command as its own system actor. */
export function scaffoldBillingJobs(step: (...args: string[]) => void): void {
  step(
    'generate',
    'job',
    'billing',
    'CancelStaleInvoices',
    '--every',
    '15m',
    '--command',
    'CancelInvoice',
    ...term('Stale=Left unpaid for too long'),
  );

  step(
    'generate',
    'job',
    'billing',
    'IssueInvoicesMonthly',
    '--cron',
    '0 6 1 * *',
    '--time-zone',
    'Europe/Paris',
    '--command',
    'IssueInvoice',
    ...term('Monthly=On the first day of each month'),
  );
}
