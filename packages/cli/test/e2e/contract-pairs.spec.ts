import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read as readFile, tempDir, type StackFlags } from '../helpers';
import { grantOf } from '../support/grant-of';
import { initFlags } from '../support/init-flags';
import { readYaml } from '../support/read-yaml';
import { shareMoney } from './contract-pair-sources';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const IN_PROCESS = { tests: 'vitest', orm: 'none', events: 'in-memory' } as const;

/** The pairs of an HTTP framework and a validation library a project starts from: docs/tools/contract-pairs.md. */
const PAIRS: readonly (readonly [string, StackFlags])[] = [
  ['Express and zod 4, its own JSON Schema', { ...DEFAULT_STACK, ...IN_PROCESS }],
  ['Fastify and TypeBox', { http: 'fastify', validation: 'typebox', di: 'manual', ...IN_PROCESS }],
  ['Hono on Node and zod', { http: 'hono', validation: 'zod', di: 'tsyringe', ...IN_PROCESS }],
  ['NestJS and class-validator', { http: 'nest', validation: 'class-validator', di: 'nest', ...IN_PROCESS }],
];

const TERMS = [
  ['Invoice', 'A request for payment sent to a customer'],
  ['Issue', 'To make an invoice final and send it'],
  ['Void', 'To cancel an invoice before it is paid'],
  ['Money', 'An amount in a currency'],
  ['Search', 'To find invoices by criteria, one page at a time'],
].flatMap(([term, meaning]) => ['--term', `${term ?? ''}=${meaning ?? ''}`]);

/** Each route nests the shared shape under a field of its own. */
const ROUTES = { 'issue-invoice': 'amount', 'void-invoice': 'refund' };
const MONEY_REF = { $ref: '#/components/schemas/Money' };

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): one project per pair, a context with two command routes that
 * nest one shape declared once and a search, installed as a published kit would be, held to its
 * analyzers, its specs, its end-to-end specs (401, 403, 201 and the trace of the request), its
 * contract and the client generated from it.
 */
describe.runIf(SLOW).each(PAIRS)('a project on a contract pair (%s)', (_label, stack) => {
  let root: string;

  const vitest = (...args: string[]): string => runIn(root, { command: bin('vitest'), args: ['run', ...args] });
  const node = (...args: string[]): string => runIn(root, { command: process.execPath, args });

  beforeAll(() => {
    root = tempDir('pair');
    scaffold(root, stack);
    installAsPublished(root);
  }, 120_000);

  it('has no finding once a shape is shared by two routes and a search is added', () => {
    expectNoFinding(root);
  }, 480_000);

  it('passes its specs and its end-to-end specs: 401, 403, 201 and the trace of the request', () => {
    expect(vitest()).toMatch(/Test Files\s+\d+ passed/);

    const endToEnd = vitest('--config', 'vitest.e2e.config.ts');

    expect(endToEnd).toMatch(/Tests\s+4 passed/);
    expect(endToEnd).not.toMatch(FAILED_COUNT);
  }, 240_000);

  it('documents the shared shape once, answers with the Accepted schema, and keeps its contract current', () => {
    node(NATIVE_COMPILER, '-p', 'tsconfig.build.json');

    expect(cli(root, 'build-aliases').code).toBe(0);

    node('dist/scripts/openapi.js');
    node('dist/scripts/openapi.js', '--check');

    const [read] = readYaml([readFile(root, 'openapi/openapi.yaml')]);
    const contract = read?.yaml12 as Contract;
    const { schemas } = contract.components;

    expect(Object.keys(schemas)).toEqual(expect.arrayContaining(['Accepted', 'Money', 'Problem']));
    expect(schemas['Money']).toMatchObject({ properties: { cents: {}, currency: {} } });

    for (const path of ['/invoices', '/invoices/{invoiceId}/void']) {
      const operation = contract.paths[path]?.post;

      expect(JSON.stringify(operation?.requestBody)).toContain(JSON.stringify(MONEY_REF));
      expect(JSON.stringify(operation?.responses)).toContain('#/components/schemas/Accepted');
    }
  }, 240_000);

  it('generates from that contract a client that compiles and names each shared type once', () => {
    expect(cli(root, 'sdk').code).toBe(0);
    expect(cli(root, 'sdk', '--check').code).toBe(0);

    const types = readFile(root, 'clients/api/src/schemas.ts');

    for (const name of ['Money', 'Accepted']) {
      expect(types.match(new RegExp(`^export type ${name} =`, 'gm')), name).toHaveLength(1);
    }

    expect(readFile(root, 'clients/api/src/operations.ts')).toContain('export function searchInvoices(');
    expect(node(NATIVE_COMPILER, '-b', 'clients')).toBe('');
  }, 240_000);
});

interface Contract {
  readonly paths: Record<string, { post?: { requestBody?: unknown; responses?: unknown } }>;
  readonly components: { readonly schemas: Record<string, unknown> };
}

function scaffold(root: string, stack: StackFlags): void {
  const run = (...args: string[]): void => {
    const result = cli(root, ...args);

    expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(0);
  };

  const grant = grantOf(stack)('accountant');

  run('init', ...initFlags(stack), '--package-manager', 'npm', '--sdk', '--context', 'billing:core');
  run('generate', 'aggregate', 'billing', 'Invoice', ...TERMS);

  run(
    'generate',
    'command',
    'billing',
    'IssueInvoice',
    '--creates',
    '--aggregate',
    'Invoice',
    '--permission',
    'invoice.issue',
    ...grant,
  );

  run('generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
  run('generate', 'e2e', 'billing', 'IssueInvoice');

  run(
    'generate',
    'command',
    'billing',
    'VoidInvoice',
    '--creates',
    '--aggregate',
    'Invoice',
    '--permission',
    'invoice.void',
    ...grant,
  );

  run('generate', 'route', 'billing', 'VoidInvoice', '--method', 'POST', '--path', '/invoices/:invoiceId/void');
  run('generate', 'query', 'billing', 'SearchInvoices', '--search', '--permission', 'invoice.search', ...grant);
  run('generate', 'route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/invoices');
  run('generate', 'schema', 'billing', 'Money');
  shareMoney(root, stack.validation, ROUTES);
  run('docs');

  expect(readFile(root, 'ddd-ts-kit.config.json')).toContain('"schemas": "shared"');
}
