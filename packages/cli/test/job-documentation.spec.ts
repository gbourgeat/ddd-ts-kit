import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { jobProject } from './support/job-project';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/scheduling/cancel-stale-invoices.job.ts`;

const EVERY_QUARTER = [
  'generate',
  'job',
  'billing',
  'CancelStaleInvoices',
  '--every',
  '15m',
  '--command',
  'CancelInvoice',
  '--term',
  'Stale=Left unpaid for too long',
];

describe('jobs in list and in the documentation', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject();
    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);

    expect(
      cli(
        root,
        'generate',
        'job',
        'billing',
        'RemindInvoicesDaily',
        '--cron',
        '0 7 * * 1-5',
        '--command',
        'RemindInvoices',
        '--term',
        'Daily=Once a working day',
      ).code,
    ).toBe(0);
  });

  it('lists the jobs of each context with their schedule and the command they send', () => {
    const map = cli(root, 'list', '--json').json() as { contexts: { name: string; jobs: unknown[] }[] };

    expect(map.contexts[0]?.jobs).toEqual([
      { name: 'billing.cancel-stale-invoices', schedule: 'every 15m', command: 'CancelInvoice' },
      { name: 'billing.remind-invoices-daily', schedule: 'cron 0 7 * * 1-5 (UTC)', command: 'RemindInvoices' },
    ]);

    expect(cli(root, 'list').stdout).toContain(
      '  scheduled jobs: billing.cancel-stale-invoices (every 15m, sends CancelInvoice), billing.remind-invoices-daily (cron 0 7 * * 1-5 (UTC), sends RemindInvoices)',
    );
  });

  it('writes the table of jobs in the document of the context, and keeps docs --check exact', () => {
    const doc = `${BILLING}/CONTEXT.md`;

    expect(read(root, doc)).toContain(
      '## Scheduled jobs\n\n<!-- ddd-ts-kit:jobs -->\n| Job | Schedule | Command |\n|---|---|---|\n| `billing.cancel-stale-invoices` | `every 15m` | `CancelInvoice` |\n| `billing.remind-invoices-daily` | `cron 0 7 * * 1-5 (UTC)` | `RemindInvoices` |\n<!-- /ddd-ts-kit:jobs -->',
    );

    expect(cli(root, 'docs', '--check').code).toBe(0);

    write(root, JOB, read(root, JOB).replace("{ every: '15m' }", "{ every: '1h' }"));

    expect(cli(root, 'docs', '--check').stdout).toContain(`stale  ${doc}`);
    expect(cli(root, 'docs').code).toBe(0);
    expect(read(root, doc)).toContain('| `billing.cancel-stale-invoices` | `every 1h` | `CancelInvoice` |');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('says that a context has no job, and leaves alone a document written before the section existed', () => {
    const bare = tempDir('job');

    cli(bare, 'init', '--context', 'billing:core');

    expect(read(bare, `${BILLING}/CONTEXT.md`)).toContain(
      '<!-- ddd-ts-kit:jobs -->\nNo scheduled job.\n<!-- /ddd-ts-kit:jobs -->',
    );

    write(
      bare,
      `${BILLING}/CONTEXT.md`,
      read(bare, `${BILLING}/CONTEXT.md`).replace(/## Scheduled jobs[\s\S]*?(?=## Relationships)/, ''),
    );

    const result = cli(bare, 'docs', '--json').json() as { notes: string[]; updated: string[] };

    expect(result.notes).toEqual([]);
    expect(result.updated).toEqual([]);
  });
});
