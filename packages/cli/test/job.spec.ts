import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';
import { failure, report } from './reports.js';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/scheduling/cancel-stale-invoices.job.ts`;
const ROLES = 'src/platform/auth/roles.ts';
const SPEC = `${BILLING}/test/unit/cancel-stale-invoices.job.spec.ts`;
const EVERY_QUARTER = ['generate', 'job', 'billing', 'CancelStaleInvoices', '--every', '15m', '--command', 'CancelInvoice', '--term', 'Stale=Left unpaid for too long'];

describe('generate job, in the declared style', () => {
  let root: string;
  let generated: ReturnType<typeof report>;

  beforeAll(() => {
    root = project();
    generated = report(cli(root, ...EVERY_QUARTER, '--json'));
  });

  it('writes the job and its spec, and refreshes the barrel, the job settings and the document of the context', () => {
    expect(generated.created).toEqual([JOB, SPEC]);
    expect(generated.updated).toEqual(expect.arrayContaining(['src/platform/job-settings.ts', `${BILLING}/billing.declarations.ts`, `${BILLING}/CONTEXT.md`]));
    expect(read(root, `${BILLING}/billing.declarations.ts`)).toContain("export * from './application/scheduling/cancel-stale-invoices.job.js';");
    expect(read(root, 'src/platform/job-settings.ts')).toContain("    'billing.cancel-stale-invoices': { enabled: environment['JOB_BILLING_CANCEL_STALE_INVOICES_ENABLED'] !== 'false' },");
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('| Stale | Left unpaid for too long |  |');
  });

  it('declares a class that only sends its command, as the system actor of the job', () => {
    const job = read(root, JOB);

    expect(job).toContain("import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';");
    expect(job).toContain("import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';");
    expect(job).toContain("@Scheduled('billing.cancel-stale-invoices', { every: '15m' }, [CommandBus])\nexport class CancelStaleInvoicesJob implements ScheduledJob {\n  constructor(private readonly commands: CommandBus) {}");
    expect(job).toContain("    await this.commands.execute(new CancelInvoiceCommand(systemActor('billing.cancel-stale-invoices')));");
    expect(job.match(/^export /gm)).toHaveLength(1);
  });

  it('runs the job by name in its spec and asserts the command it sent, the system actor holding the permission', () => {
    const spec = read(root, SPEC);

    expect(spec).toContain("await application.jobs.runNow('billing.cancel-stale-invoices');");
    expect(spec).toContain("roles: { scheduler: [billingPermissions['invoice.cancel']] }, systemRole: 'scheduler'");
    expect(spec).toContain("modules: [platformTestModule, contextModule('billing', billingDeclarations), authorization]");
    expect(spec).toContain('expect(sent[0]).toBeInstanceOf(CancelInvoiceCommand);');
    expect(spec).toContain("expect(sent[0]).toMatchObject({ actor: { id: 'system:billing.cancel-stale-invoices', type: 'system' } });");
  });

  it('grants the role of system actors the permission of the command, and points at the grant in the next steps', () => {
    const grant = generated.todos.find((todo) => todo.text.startsWith('check this grant'));
    const printed = cli(root, ...EVERY_QUARTER, '--force').stdout;

    expect(read(root, ROLES)).toContain("  system: [\n    // ddd-ts-kit:system-grants\n    'billing:invoice.cancel',\n    // /ddd-ts-kit:system-grants\n  ],");
    expect(grant).toMatchObject({ file: ROLES, line: 15 });
    expect(grant?.text).toContain('gives `system:billing.cancel-stale-invoices` the permission `billing:invoice.cancel`');
    expect(generated.next).toContain(`${ROLES}:15`);
    expect(generated.updated).toContain(ROLES);
    expect(read(root, JOB)).not.toContain('grant the system actor');
    expect(printed).toContain(`${ROLES}:15  check this grant: the role \`system\`, which every system actor holds`);
  });

  it('passes the instant the run was due when the command takes it, and asks for nothing when the command is public', () => {
    const command = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.command.ts`;

    write(root, command, read(root, command).replace(/ {2}\/\/ TODO\(domain\)[^\n]*\n/, '  constructor(actor: Actor, readonly dueBefore: Date) {\n    super(actor);\n  }\n'));

    expect(cli(root, ...EVERY_QUARTER, '--force').code).toBe(0);
    expect(read(root, JOB)).toContain("new CancelInvoiceCommand(systemActor('billing.cancel-stale-invoices'), execution.scheduledAt)");

    const open = report(cli(root, 'generate', 'job', 'billing', 'RemindInvoicesDaily', '--cron', '0 7 * * 1-5', '--time-zone', 'Europe/Paris', '--command', 'RemindInvoices', '--term', 'Daily=Once a working day', '--json'));
    const reminder = read(root, `${BILLING}/application/scheduling/remind-invoices-daily.job.ts`);

    expect(reminder).toContain("@Scheduled('billing.remind-invoices-daily', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [CommandBus])");
    expect(reminder).toContain('await this.commands.execute(new RemindInvoicesCommand());');
    expect(reminder).not.toContain('systemActor');
    expect(open.todos.some((todo) => todo.text.startsWith('grant the system actor'))).toBe(false);
  });
});

describe('generate job, refusals', () => {
  let root: string;

  beforeAll(() => {
    root = project();
  });

  const job = (...flags: string[]) => cli(root, 'generate', 'job', 'billing', 'CancelStaleInvoices', '--term', 'Stale=Left unpaid for too long', ...flags, '--json');

  it('needs exactly one schedule, and a time zone only with a cron expression', () => {
    expect(failure(job('--command', 'CancelInvoice')).message).toBe('A job needs a schedule.');
    expect(failure(job('--every', '15m', '--cron', '0 7 * * *', '--command', 'CancelInvoice')).message).toBe('--every and --cron exclude each other.');
    expect(failure(job('--every', '15m', '--time-zone', 'Europe/Paris', '--command', 'CancelInvoice')).message).toBe('--time-zone needs --cron.');
  });

  it('refuses a schedule the scheduler could not read, before writing anything', () => {
    expect(failure(job('--every', '0m', '--command', 'CancelInvoice')).message).toContain('"0m" is not a duration');
    expect(failure(job('--cron', '61 * * * *', '--command', 'CancelInvoice')).message).toContain('"61" is not a minute of a cron expression');
    expect(failure(job('--cron', '0 0 31 2 *', '--command', 'CancelInvoice')).message).toContain('never fires');
    expect(failure(job('--cron', '0 7 * * *', '--time-zone', 'Mars/Olympus', '--command', 'CancelInvoice')).message).toContain('"Mars/Olympus" is not a time zone');
    expect(job('--every', '0m', '--command', 'CancelInvoice').code).toBe(2);
  });

  it('needs the command it sends, and gives the command that creates it when it does not exist', () => {
    const missing = job('--every', '15m', '--command', 'VoidInvoices', '--allow-name');

    expect(failure(job('--every', '15m')).message).toBe('A job needs --command.');
    expect(failure(missing).message).toContain('The command VoidInvoices does not exist in "billing"');
    expect(failure(missing).fix).toContain('ddd-ts-kit generate command billing VoidInvoices --permission <aggregate>.<action>');
  });

  it('names the job in the ubiquitous language, like a use case', () => {
    const refused = cli(root, 'generate', 'job', 'billing', 'PurgeInvoices', '--every', '1d', '--command', 'CancelInvoice', '--json');

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toContain('"purge"');
    expect(failure(cli(root, 'generate', 'job', 'billing', '--every', '1d', '--command', 'CancelInvoice', '--json')).message).toContain('job expects 2 argument(s)');
  });

  it('keeps --command a switch for a route', () => {
    expect(cli(root, 'generate', 'route', 'billing', 'CancelInvoice', '--method', 'DELETE', '--path', '/invoices/:invoiceId', '--command', '--dry-run').code).toBe(0);
  });
});

describe('generate job, where the wiring is written', () => {
  it('registers the job in the module file of an explicit context, and tests it the same way', () => {
    const root = project('--style', 'explicit');

    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain("builder.job('billing.cancel-stale-invoices', { every: '15m' }).handledBy(CancelStaleInvoicesJob, [CommandBus]);");
    expect(read(root, JOB)).toContain("import { systemActor, type CommandBus, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel';");
    expect(read(root, JOB)).not.toContain('@Scheduled');
    expect(read(root, SPEC)).toContain('modules: [platformTestModule, billingModule, authorization]');
    expect(read(root, ROLES)).toContain("    'billing:invoice.cancel',");
  });

  it('registers the job on the scheduler of the platform where contexts are wired by hand, and tests it on the test buses', () => {
    const root = project('--di', 'manual');

    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      "  const cancelStaleInvoicesJob = new CancelStaleInvoicesJob(platform.commands);\n\n  platform.jobs.register({ name: 'billing.cancel-stale-invoices', schedule: { every: '15m' }, run: (execution) => cancelStaleInvoicesJob.run(execution) });",
    );

    expect(read(root, SPEC)).toContain('const { commandBus } = createTestBuses();');
    expect(read(root, SPEC)).toContain('await job.run(occurrence);');
    expect(read(root, ROLES)).toContain("    'billing:invoice.cancel',");
  });
});

describe('jobs in list and in the documentation', () => {
  let root: string;

  beforeAll(() => {
    root = project();
    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);
    expect(cli(root, 'generate', 'job', 'billing', 'RemindInvoicesDaily', '--cron', '0 7 * * 1-5', '--command', 'RemindInvoices', '--term', 'Daily=Once a working day').code).toBe(0);
  });

  it('lists the jobs of each context with their schedule and the command they send', () => {
    const map = cli(root, 'list', '--json').json() as { contexts: { name: string; jobs: unknown[] }[] };

    expect(map.contexts[0]?.jobs).toEqual([
      { name: 'billing.cancel-stale-invoices', schedule: 'every 15m', command: 'CancelInvoice' },
      { name: 'billing.remind-invoices-daily', schedule: 'cron 0 7 * * 1-5 (UTC)', command: 'RemindInvoices' },
    ]);

    expect(cli(root, 'list').stdout).toContain('  scheduled jobs: billing.cancel-stale-invoices (every 15m, sends CancelInvoice), billing.remind-invoices-daily (cron 0 7 * * 1-5 (UTC), sends RemindInvoices)');
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

    expect(read(bare, `${BILLING}/CONTEXT.md`)).toContain('<!-- ddd-ts-kit:jobs -->\nNo scheduled job.\n<!-- /ddd-ts-kit:jobs -->');

    write(bare, `${BILLING}/CONTEXT.md`, read(bare, `${BILLING}/CONTEXT.md`).replace(/## Scheduled jobs[\s\S]*?(?=## Relationships)/, ''));

    const result = cli(bare, 'docs', '--json').json() as { notes: string[]; updated: string[] };

    expect(result.notes).toEqual([]);
    expect(result.updated).toEqual([]);
  });
});

function project(...flags: string[]): string {
  const root = tempDir('job');

  expect(cli(root, 'init', ...flags).code).toBe(0);
  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment', '--term', 'Cancel=To void an invoice', '--term', 'Remind=To ask again for a payment').code).toBe(0);
  expect(cli(root, 'generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel').code).toBe(0);
  expect(cli(root, 'generate', 'command', 'billing', 'RemindInvoices', '--public').code).toBe(0);

  return root;
}
