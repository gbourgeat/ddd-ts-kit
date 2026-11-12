import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write, type CliResult } from './helpers';
import { failure as refusal, report } from './reports';
import { initProject } from './support/init-project';
import { jobProject } from './support/job-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

const SPEC = 'test/e2e/cancel-invoice.e2e.spec.ts';
const SPEC_OF_THE_JOB = 'test/e2e/cancel-invoice-void-overdue.e2e.spec.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';
const PLATFORM = 'src/platform';

const BACKGROUND = [
  'generate',
  'background-job',
  'billing',
  'VoidOverdue',
  '--command',
  'CancelInvoice',
  '--term',
  'Void=To cancel what was issued',
  '--term',
  'Overdue=Past its due date',
];

const SCHEDULED = ['generate', 'job', 'billing', 'RemindDaily', '--every', '1d', '--command', 'RemindInvoices'];

function failure(result: CliResult): { message: string; fix: string } {
  expect(result.code).toBe(2);

  return refusal(result);
}

function done(root: string, ...args: string[]): ReturnType<typeof report> {
  const result = cli(root, ...args, '--json');

  expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(0);

  return report(result);
}

describe('generate e2e for a use case a background job starts', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject();
    done(root, ...BACKGROUND);
  });

  it('runs what is due on the queue through the support, and asserts that the job ran', () => {
    const { created, notes } = done(root, 'generate', 'e2e', 'billing', 'CancelInvoice');
    const spec = read(root, SPEC);

    expect(created).toEqual([SPEC]);
    expect(notes).toEqual([]);

    expect(spec).toContain(
      "import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';",
    );

    expect(spec).toContain(
      '// No route starts "cancel invoice": billing.void-overdue sends its command once a use case enqueued it, so the spec runs what is due on the queue as the worker would.',
    );

    expect(spec).toContain(`it('runs "cancel invoice" once billing.void-overdue is enqueued', async () => {`);
    expect(spec).toContain('the request whose use case enqueues VoidOverdueBackgroundJob');

    expect(spec).toContain(
      "const ran = await application.runDueJobs();\n\n    await application.settled();\n\n    // No job runs before a request enqueued it: this fails until the arrangement above is written.\n    expect(ran).toContain('billing.void-overdue');",
    );

    expect(spec).not.toContain('application.runJob(');
  });

  it('names the job with --job, by its class or the name it runs under, in a spec beside the one of the use case', () => {
    for (const asked of ['VoidOverdue', 'VoidOverdueBackgroundJob', 'billing.void-overdue']) {
      fs.rmSync(path.join(root, SPEC_OF_THE_JOB), { force: true });

      expect(done(root, 'generate', 'e2e', 'billing', 'CancelInvoice', '--job', asked).created, asked).toEqual([
        SPEC_OF_THE_JOB,
      ]);
    }

    expect(read(root, SPEC_OF_THE_JOB)).toContain(
      '// "cancel invoice" as a job starts it: billing.void-overdue sends its command once a use case enqueued it',
    );
  });

  it('writes the spec of the job of a use case a route reaches, and leaves the spec of the route alone', () => {
    const project = jobProject();

    done(project, ...BACKGROUND);

    done(
      project,
      'generate',
      'route',
      'billing',
      'CancelInvoice',
      '--method',
      'POST',
      '--path',
      '/invoices/:invoiceId/cancellation',
    );

    expect(done(project, 'generate', 'e2e', 'billing', 'CancelInvoice').created).toEqual([SPEC]);
    expect(read(project, SPEC)).toContain('expectStatus(response,');

    expect(done(project, 'generate', 'e2e', 'billing', 'CancelInvoice', '--job', 'VoidOverdue').created).toEqual([
      SPEC_OF_THE_JOB,
    ]);

    expect(read(project, SPEC_OF_THE_JOB)).toContain('await application.runDueJobs();');
  });

  it('refuses a job that does not send the command, naming those that do, and a use case no job sends', () => {
    const unknown = failure(cli(root, 'generate', 'e2e', 'billing', 'CancelInvoice', '--job', 'Purge', '--json'));

    expect(unknown.message).toBe('No job of "billing" named Purge sends CancelInvoiceCommand.');

    expect(unknown.fix).toBe(
      'Pass --job with one of the jobs that send it: VoidOverdueBackgroundJob (billing.void-overdue).',
    );

    const elsewhere = failure(
      cli(root, 'generate', 'e2e', 'billing', 'CancelInvoice', '--job', 'billing.purge', '--json'),
    );

    expect(elsewhere.message).toBe('No job of "billing" named billing.purge sends CancelInvoiceCommand.');

    const unsent = failure(cli(root, 'generate', 'e2e', 'billing', 'RemindInvoices', '--job', 'VoidOverdue', '--json'));

    expect(unsent.fix).toContain(
      'ddd-ts-kit generate job billing <JobName> --every <duration> --command RemindInvoices',
    );

    expect(unsent.fix).toContain('ddd-ts-kit generate background-job billing <Name> --command RemindInvoices');
  });

  it('refuses --event with --job: a spec starts its use case one way', () => {
    const both = failure(
      cli(root, 'generate', 'e2e', 'billing', 'CancelInvoice', '--job', 'VoidOverdue', '--event', 'a.b.c', '--json'),
    );

    expect(both.message).toBe('generate e2e takes --event or --job, not both.');
  });

  it('names the background job in the refusal of a use case nothing starts', () => {
    const { message, fix } = failure(cli(root, 'generate', 'e2e', 'billing', 'RemindInvoices', '--json'));

    expect(message).toContain('application/scheduling/*.job.ts, application/background/*.background-job.ts');

    expect(fix).toContain(
      '`generate background-job billing <Name> --command RemindInvoices` for one a use case enqueues',
    );
  });

  it('notes a support written before runDueJobs existed, and says how to add it', () => {
    const project = jobProject();

    done(project, ...BACKGROUND);
    write(project, SUPPORT, read(project, SUPPORT).replace(/^ *runDueJobs\(.*$/gm, ''));

    const { notes } = done(project, 'generate', 'e2e', 'billing', 'CancelInvoice');

    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(`${SUPPORT} has no runDueJobs(): add \`runDueJobs(): Promise<string[]>;\``);
    expect(notes[0]).toContain('`await worker.stop()`, then `await worker.runDue()`');
  });
});

describe('generate e2e for a use case a scheduled job and a background job both start', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject('--tests', 'jest');
    done(root, ...SCHEDULED, '--term', 'Daily=Once a day');

    done(
      root,
      'generate',
      'background-job',
      'billing',
      'RemindLate',
      '--command',
      'RemindInvoices',
      '--term',
      'Late=Past its due date',
    );
  });

  it('writes one test per job, each run its own way, with the globals of the runner', () => {
    const { notes } = done(root, 'generate', 'e2e', 'billing', 'RemindInvoices');
    const spec = read(root, 'test/e2e/remind-invoices.e2e.spec.ts');

    expect(notes).toEqual([]);
    expect(spec).toContain("import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';");

    expect(spec).toContain(
      '// No route starts "remind invoices": billing.remind-daily sends its command when its schedule is due, so the spec runs the job as the scheduler would; billing.remind-late sends its command once a use case enqueued it, so the spec runs what is due on the queue as the worker would.',
    );

    expect(spec).toContain("await application.runJob('billing.remind-daily');");
    expect(spec).toContain("expect(ran).toContain('billing.remind-late');");
    expect(spec.indexOf('application.runJob(')).toBeLessThan(spec.indexOf('application.runDueJobs('));
  });

  it('keeps the one job --job names, the scheduled one without an assertion of its own', () => {
    done(root, 'generate', 'e2e', 'billing', 'RemindInvoices', '--job', 'RemindDailyJob');

    const spec = read(root, 'test/e2e/remind-invoices-remind-daily.e2e.spec.ts');

    expect(spec).toContain("import { afterAll, beforeAll, beforeEach, describe, it } from '@jest/globals';");
    expect(spec).toContain("await application.runJob('billing.remind-daily');");
    expect(spec).not.toContain('runDueJobs');
  });

  it('notes each function an older support lacks', () => {
    write(root, SUPPORT, read(root, SUPPORT).replace(/^ *(?:runJob|runDueJobs)\(.*$/gm, ''));

    const { notes } = done(root, 'generate', 'e2e', 'billing', 'RemindInvoices', '--force');

    expect(notes.map((note) => note.slice(0, note.indexOf(':')))).toEqual([
      `${SUPPORT} has no runJob(name)`,
      `${SUPPORT} has no runDueJobs()`,
    ]);
  });
});

describe('runDueJobs of the end-to-end support', () => {
  const RUNS = `  await worker.stop();

  const runs = await worker.runDue();
  const failed = runs.find((run) => run.outcome !== 'succeeded');

  if (failed !== undefined) {
    throw new Error(\`The background job \${failed.job} ended \${failed.outcome} (\${failed.errorCode ?? 'no error'}).\`);
  }

  return runs.map((run) => run.job);
}
`;

  it.each([
    ['tsyringe', 'knex', 'database'],
    ['tsyringe', 'none', 'memory'],
    ['inversify', 'drizzle', 'database'],
    ['awilix', 'prisma', 'redis'],
  ])(
    'on the container of %s with --orm %s and the queue in %s, runs the queue worker of the container',
    (di, orm, queue) => {
      const root = initProject(
        '--di',
        di,
        '--orm',
        orm,
        '--queue',
        queue,
        ...(queue === 'redis' ? ['--cache', 'redis'] : []),
      );

      const support = read(root, SUPPORT);

      expect(support).toContain("import { QueueWorker } from '@ddd-ts-kit/scheduling';");
      expect(support).toContain('    runDueJobs: () => runDueJobs(application.container.resolve(QueueWorker)),');
      expect(support).toContain(`async function runDueJobs(worker: QueueWorker): Promise<string[]> {\n${RUNS}`);
      expect(support).not.toContain('BackgroundJobs');
      expect(support).toMatch(/^ {2}runDueJobs\(\): Promise<string\[\]>;$/m);
    },
  );

  it.each([
    ['manual', 'express', 'knex', 'database'],
    ['manual', 'fastify', 'none', 'memory'],
    ['manual', 'express', 'typeorm', 'memory'],
    ['nest', 'nest', 'drizzle', 'database'],
    ['manual', 'hono', 'knex', 'redis'],
  ])(
    'wired by hand (--di %s, --http %s) with --orm %s and the queue in %s, runs the background jobs of the platform',
    (di, http, orm, queue) => {
      const root = initProject(
        '--di',
        di,
        '--http',
        http,
        '--orm',
        orm,
        '--queue',
        queue,
        ...(queue === 'redis' ? ['--cache', 'redis'] : []),
      );

      const support = read(root, SUPPORT);

      expect(support).toContain("import type { BackgroundJobs } from '@/platform/jobs/background-jobs';");
      expect(support).toContain('    runDueJobs: () => runDueJobs(application.platform.backgroundJobs),');
      expect(support).toContain(`async function runDueJobs(worker: BackgroundJobs): Promise<string[]> {\n${RUNS}`);
      expect(support).not.toContain('QueueWorker');
      expect(read(root, `${PLATFORM}/jobs/background-jobs.ts`)).toContain('  runDue(): Promise<BackgroundJobRun[]>;');
      expect(read(root, `${PLATFORM}/jobs/create-background-work.ts`)).toContain('    runDue: () => worker.runDue(),');
    },
  );

  it('lists the package that holds the token of the worker for the tests of a container, once, at run time where the queue needs it', () => {
    const inMemory = readJson(initProject('--orm', 'none'), 'package.json');
    const inTheDatabase = readJson(initProject('--orm', 'knex'), 'package.json');

    expect(jsonAt(inMemory, 'devDependencies')).toHaveProperty('@ddd-ts-kit/scheduling');
    expect(jsonAt(inMemory, 'dependencies')).not.toHaveProperty('@ddd-ts-kit/scheduling');
    expect(jsonAt(inTheDatabase, 'dependencies')).toHaveProperty('@ddd-ts-kit/scheduling');
    expect(jsonAt(inTheDatabase, 'devDependencies')).not.toHaveProperty('@ddd-ts-kit/scheduling');
  });

  it('hands the call to the application of the moment, started anew at each reset, where the state is in memory', () => {
    const support = read(initProject('--orm', 'none'), SUPPORT);

    expect(support).toContain('    runDueJobs: () => current.runDueJobs(),');
    expect(read(initProject('--orm', 'knex'), SUPPORT)).toContain('    runDueJobs: () => started.runDueJobs(),');
  });
});
