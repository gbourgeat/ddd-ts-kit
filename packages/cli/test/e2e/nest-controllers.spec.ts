import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir, type StackFlags } from '../helpers';
import { grantOf } from '../support/grant-of';
import { initFlags } from '../support/init-flags';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const STACK: StackFlags = {
  http: 'nest',
  validation: 'class-validator',
  di: 'nest',
  tests: 'vitest',
  orm: 'custom',
  events: 'outbox',
  routes: 'nest',
  storage: 'local',
  forms: 'on',
  representations: 'negotiated',
};

const INVOICE = ['--term', 'Invoice=A request for payment'];
const ISSUE = [...INVOICE, '--term', 'Issue=To make an invoice final'];
const DETAILS = [...INVOICE, '--term', 'Details=What an invoice holds', '--term', 'Read=To look at'];
const SEARCH = [...INVOICE, '--term', 'Search=To look for'];

const SCAN = [
  ...INVOICE,
  '--term',
  'Attach=To join a document to what it proves',
  '--term',
  'Scan=The image of a paper',
];

const ACCOUNTANT = grantOf(STACK)('accountant');

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): every route generator of a Nest project whose routes are Nest
 * controllers, a command, a query, a search, an upload, a form and a representation, installed as
 * a published kit. The project has no finding, type-checks and passes the specs it was generated
 * with, each controller called through the pipeline of the kit.
 */
describe.runIf(SLOW)('a Nest project whose every route is a Nest controller', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('nest-controllers');
    scaffold(root);
    installAsPublished(root);
  }, 120_000);

  it('has no finding as generated: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expect(runIn(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).not.toMatch(
      /Found \d+ error/,
    );

    expectNoFinding(root);
  }, 480_000);

  it('type-checks', () => {
    expect(runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '--noEmit', '-p', 'tsconfig.json'] })).toBe(
      '',
    );
  }, 240_000);

  it('passes the specs it was generated with, the spec of each controller among them', () => {
    const specs = runIn(root, { command: bin('vitest'), args: ['run'] });

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toMatch(FAILED_COUNT);
  }, 240_000);
});

function scaffold(root: string): void {
  const steps = [
    ['init', ...initFlags(STACK)],
    [
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--purpose',
      'Bills customers for what they bought.',
    ],
    ['generate', 'aggregate', 'billing', 'Invoice', ...INVOICE],
    [
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--creates',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      ...ACCOUNTANT,
      ...ISSUE,
    ],
    [
      'generate',
      'route',
      'billing',
      'IssueInvoice',
      '--method',
      'POST',
      '--path',
      '/invoices/:invoiceId/issue',
      ...ISSUE,
    ],
    ['generate', 'query', 'billing', 'InvoiceDetails', '--permission', 'invoice.read', ...ACCOUNTANT, ...DETAILS],
    ['generate', 'route', 'billing', 'InvoiceDetails', '--method', 'GET', '--path', '/invoices/:invoiceId', ...DETAILS],
    [
      'generate',
      'query',
      'billing',
      'SearchInvoices',
      '--search',
      '--permission',
      'invoice.search',
      ...ACCOUNTANT,
      ...SEARCH,
    ],
    ['generate', 'route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices', ...SEARCH],
    [
      'generate',
      'file-upload',
      'billing',
      'AttachInvoiceScan',
      '--path',
      '/invoices/:invoiceId/scan',
      '--permission',
      'invoice.attach-scan',
      ...ACCOUNTANT,
      ...SCAN,
    ],
    ['generate', 'form', 'billing', 'IssueInvoice'],
    ['generate', 'representation', 'billing', 'IssueInvoice', 'xml'],
    ['generate', 'representation', 'billing', 'SearchInvoices', 'csv'],
  ];

  for (const step of steps) {
    const result = cli(root, ...step, '--json');

    if (result.code !== 0) {
      throw new Error(`${step.join(' ')} failed (${String(result.code)}): ${result.stderr || result.stdout}`);
    }
  }
}
