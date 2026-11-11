import { beforeAll, describe, expect, it } from 'vitest';
import { refreshDeclarations } from '../../src/dev/refresh-declarations';
import { cli, DEFAULT_STACK, EXPLICIT_STACK, read, tempDir, write, type StackFlags } from '../helpers';
import { initFlags } from '../support/init-flags';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, findingsOf, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const BILLING = 'src/contexts/billing';
const REQUEST = `${BILLING}/application/commands/request-cancellation/request-cancellation.handler.ts`;
const CANCEL = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const SPEC = 'test/e2e/cancel-invoice.e2e.spec.ts';
const JOB = `${BILLING}/application/background/void-invoice.background-job`;
const E2E = ['run', '--config', 'vitest.e2e.config.ts', SPEC];

const TERMS = [
  'Invoice=What a customer owes',
  'Cancel=To void an invoice',
  'Void=To cancel what was issued',
  'Cancellation=The request to void an invoice',
  'Request=To ask for',
].flatMap((row) => ['--term', row]);

/** How the handler that enqueues is given the queue, in each wiring family. */
type Wiring = 'declared' | 'module file' | 'by hand';

/** Both wiring families of the support, the queue in the jobs table and in the memory of the process, where a worker runs beside the spec. */
const JOB_STACKS: readonly (readonly [string, StackFlags, Wiring])[] = [
  ['declared on a container, the queue in the jobs table of Drizzle', DEFAULT_STACK, 'declared'],
  [
    'explicit module files on a container, the queue in the memory of the process',
    { ...EXPLICIT_STACK, orm: 'knex', queue: 'memory' },
    'module file',
  ],
  [
    'wired by hand on Fastify without a database, the queue in the memory of the process',
    { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'none', events: 'in-memory' },
    'by hand',
  ],
  [
    'wired by hand on Fastify, the queue in the jobs table of Knex',
    { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'knex', events: 'outbox' },
    'by hand',
  ],
];

function step(root: string, ...args: string[]): void {
  const result = cli(root, ...args, '--json');

  if (result.code !== 0) {
    throw new Error(`${args.join(' ')} failed (${String(result.code)}): ${result.stderr || result.stdout}`);
  }
}

function edit(root: string, file: string, pattern: RegExp | string, replacement: string): void {
  const before = read(root, file);
  const after = before.replace(pattern, replacement);

  if (after === before) {
    throw new Error(`${file} holds nothing to replace for ${String(pattern)}`);
  }

  write(root, file, after);
}

/** The handler of the request enqueues the job in its unit of work, as its TODO(domain) leaves to write, and is given the queue. */
function enqueueOnRequest(root: string, wiring: Wiring): void {
  edit(
    root,
    REQUEST,
    /^(import (?:type )?\{[^}]*\} from '@ddd-ts-kit\/kernel(?:\/declarations)?';\n)/,
    `$1import { JobQueue } from '@ddd-ts-kit/kernel';\nimport { VoidInvoiceBackgroundJob } from '@/${JOB.slice('src/'.length)}';\n`,
  );

  edit(
    root,
    REQUEST,
    /( {2}async execute\()command(: RequestCancellationCommand\): Promise<void> \{\n)[^\n]*\n/,
    '  constructor(private readonly jobs: JobQueue) {}\n\n$1_command$2    await this.jobs.enqueue(VoidInvoiceBackgroundJob, {});\n',
  );

  if (wiring === 'declared') {
    refreshDeclarations(root, () => undefined);
  } else if (wiring === 'module file') {
    edit(root, MODULE, '.handledBy(RequestCancellationHandler)', '.handledBy(RequestCancellationHandler, [JobQueue])');

    edit(
      root,
      MODULE,
      "import { CommandBus } from '@ddd-ts-kit/kernel';",
      "import { CommandBus, JobQueue } from '@ddd-ts-kit/kernel';",
    );
  } else {
    edit(root, MODULE, 'new RequestCancellationHandler()', 'new RequestCancellationHandler(platform.jobQueue)');
  }
}

/** The arrangement the generated spec leaves to write: nothing is due, then the request that enqueues the job answers. */
function arrangeThroughTheApi(root: string): void {
  edit(
    root,
    SPEC,
    /^ {4}\/\/ TODO\(domain\): send, through the public API only[^\n]*\n/m,
    "    expect(await application.runDueJobs()).toEqual([]);\n\n    const asked = await application.client.post('/invoices/invoice-1/cancellations', {});\n\n    expect(asked.status).toBe(204);\n",
  );
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project with a use case that enqueues a background job, and
 * the end-to-end spec `generate e2e` writes for the use case that job starts, run by the project
 * as generated (red: nothing enqueued), once its arrangement is written (green), and once the use
 * case of the job fails (red, by the outcome of the run).
 */
describe.runIf(SLOW).each(JOB_STACKS)('the end-to-end spec of a background job (%s)', (_label, stack, wiring) => {
  let root: string;

  const endToEnd = (): string => findingsOf(root, { command: bin('vitest'), args: E2E });

  beforeAll(() => {
    root = tempDir('job-e2e');
    step(root, 'init', ...initFlags(stack));
    step(root, 'generate', 'context', 'billing', '--classification', 'core', '--purpose', 'Bills customers.', ...TERMS);
    step(root, 'generate', 'command', 'billing', 'CancelInvoice', '--public');
    step(root, 'generate', 'command', 'billing', 'RequestCancellation', '--public');

    step(
      root,
      'generate',
      'route',
      'billing',
      'RequestCancellation',
      '--method',
      'POST',
      '--path',
      '/invoices/:invoiceId/cancellations',
    );

    step(root, 'generate', 'background-job', 'billing', 'VoidInvoice', '--command', 'CancelInvoice');
    step(root, 'generate', 'e2e', 'billing', 'CancelInvoice');
    installAsPublished(root);
  }, 120_000);

  it('is formatted as generated, and has no finding: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
    expectNoFinding(root);
  }, 480_000);

  it('type-checks, its support and the spec of the job included', () => {
    expect(runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '--noEmit', '-p', 'tsconfig.json'] })).toBe(
      '',
    );
  }, 240_000);

  it('fails as generated: no request has enqueued the job yet', () => {
    expect(endToEnd()).toContain("to include 'billing.void-invoice'");
  }, 240_000);

  it('passes once the request that enqueues is sent: the job runs on the worker of the application, and its use case with it', () => {
    enqueueOnRequest(root, wiring);
    arrangeThroughTheApi(root);

    const run = runIn(root, { command: bin('vitest'), args: E2E });

    expect(run).toMatch(/Test Files\s+1 passed/);
    expect(run).not.toMatch(FAILED_COUNT);
  }, 240_000);

  it('fails by the outcome of the run when the use case of the job refuses, never in silence', () => {
    edit(root, CANCEL, /(Promise<void> \{\n)[^\n]*\n/, "$1    throw new Error('The ledger is closed.');\n");

    const run = endToEnd();

    expect(run).toContain('The background job billing.void-invoice ended retried (UNEXPECTED_ERROR).');
    expect(run).not.toContain('The ledger is closed.');
  }, 240_000);
});
