import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, EXPLICIT_STACK, tempDir, type StackFlags } from '../helpers.js';
import { initFlags } from '../support/init-flags.js';
import { expectNoFinding } from './expect-no-finding.js';
import { installAsPublished } from './install-as-published.js';
import { bin, findingsOf, runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { NATIVE_COMPILER } from './type-errors.js';

const UNIT = 'src/contexts/billing/test/unit';

const TERMS = [
  'Attach=To join a document to what it proves',
  'Scan=The image of a paper invoice',
  'Invoice=What a customer owes',
  'Import=To bring rows from a file',
  'Price=What a customer pays for one item',
  'List=The prices of a supplier, sent as one file',
].flatMap((row) => ['--term', row]);

const PROTECTED = ['--permission', 'invoice.attach-scan'];

/** The three wirings a generated upload lands in, and both storages a project keeps its files in. */
const FILE_STACKS: readonly (readonly [string, StackFlags])[] = [
  ['declared, files in a bucket of the S3 protocol', { ...DEFAULT_STACK, storage: 's3' }],
  ['explicit module files, files in a local directory', { ...EXPLICIT_STACK, storage: 'local' }],
  [
    'wired by hand on Fastify and knex, files in a bucket of the S3 protocol',
    { http: 'fastify', validation: 'zod', di: 'manual', tests: 'vitest', orm: 'knex', events: 'outbox', storage: 's3' },
  ],
];

function step(root: string, ...args: string[]): void {
  const result = cli(root, ...args, '--json');

  if (result.code !== 0) {
    throw new Error(`${args.join(' ')} failed (${String(result.code)}): ${result.stderr || result.stdout}`);
  }
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): `init` with a file storage, then two uploads generated, one
 * protected and one public, held to what the project runs: the checker and the three analyzers,
 * the compiler, and the specs generated with them, which stage the file through the bus.
 */
describe.runIf(SLOW).each(FILE_STACKS)('a project that receives files (%s)', (_label, stack) => {
  let root: string;

  beforeAll(() => {
    root = tempDir('files');
    step(root, 'init', ...initFlags(stack));
    step(root, 'generate', 'context', 'billing', '--classification', 'core', '--purpose', 'Bills customers.', ...TERMS);

    step(
      root,
      'generate',
      'file-upload',
      'billing',
      'AttachInvoiceScan',
      '--path',
      '/invoices/:invoiceId/scan',
      ...PROTECTED,
    );

    step(root, 'generate', 'file-upload', 'billing', 'ImportPriceList', '--path', '/price-lists/import', '--public');
    installAsPublished(root);
  }, 120_000);

  it('is formatted as generated, and has no finding: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
    expectNoFinding(root);
  }, 480_000);

  it('type-checks, its specs included', () => {
    expect(runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '--noEmit', '-p', 'tsconfig.json'] })).toBe(
      '',
    );
  }, 240_000);

  it('passes the specs generated with the uploads: the file staged by the bus, promoted with the commit', () => {
    const specs = runIn(root, {
      command: bin('vitest'),
      args: [
        'run',
        `${UNIT}/attach-invoice-scan.handler.spec.ts`,
        `${UNIT}/attach-invoice-scan.controller.spec.ts`,
        `${UNIT}/import-price-list.handler.spec.ts`,
        `${UNIT}/import-price-list.controller.spec.ts`,
      ],
    });

    expect(specs).toMatch(/Test Files\s+4 passed/);
    expect(specs).not.toContain('failed');
  }, 240_000);
});
