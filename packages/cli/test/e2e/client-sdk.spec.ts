import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, exists, read, tempDir, write } from '../helpers';
import { initFlags } from '../support/init-flags';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const CONSUMER = 'test/e2e/support/invoices-client.ts';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project generated with --sdk, installed as a published kit.
 * Its client follows the contract: a route added, the contract regenerated, the client is stale
 * until `sdk` writes it again, then a consumer that imports it by its package name type-checks
 * with the project, and the client builds on its own as the pipeline builds it.
 */
describe.runIf(SLOW)('a project generated with --sdk', () => {
  let root: string;

  const node = (...args: string[]): string => runIn(root, { command: process.execPath, args });

  beforeAll(() => {
    root = tempDir('client-sdk');
    expect(cli(root, 'init', ...initFlags(DEFAULT_STACK), '--package-manager', 'npm', '--sdk').code).toBe(0);
    installAsPublished(root);
  }, 120_000);

  it('has the client of its pristine contract, current, and no finding of any analyzer', () => {
    expect(cli(root, 'sdk', '--check').code).toBe(0);
    expect(exists(root, 'clients/api/src/operations.ts')).toBe(true);
    expectNoFinding(root);
    expect(runIn(root, { command: 'sh', args: ['-c', `${bin('knip')} 2>&1`] })).toBe('');
  }, 300_000);

  it('makes the client stale once a route changes the contract, and current again after sdk', () => {
    addRoute(root);
    node(NATIVE_COMPILER, '-p', 'tsconfig.build.json');
    expect(cli(root, 'build-aliases').code).toBe(0);
    node('dist/scripts/openapi.js');

    const stale = cli(root, 'sdk', '--check');

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('stale  clients/api/src/operations.ts');
    expect(cli(root, 'sdk').code).toBe(0);
    expect(cli(root, 'sdk', '--check').code).toBe(0);
    expect(read(root, 'clients/api/src/operations.ts')).toContain('export function issueInvoice(');
  }, 300_000);

  it('type-checks a consumer of the client with the project, and builds the client on its own', () => {
    const name = String(JSON.parse(read(root, 'clients/api/package.json')).name);

    write(root, CONSUMER, consumerOf(name));

    expect(node(NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit')).toBe('');
    expect(node(NATIVE_COMPILER, '-b', 'clients')).toBe('');
    expect(read(root, 'clients/api/dist/index.d.ts')).toContain('createClient');
    expect(JSON.parse(read(root, 'package.json')).scripts['ci:build']).toBe('npm run build && npm run sdk:build');
  }, 300_000);
});

/** A context, its aggregate, a command and the route that exposes it: what a team adds to a new project. */
function addRoute(root: string): void {
  const steps = [
    ['context', 'billing', '--classification', 'core', '--purpose', 'Bills customers for what they bought.'],
    ['aggregate', 'billing', 'Invoice'],
    [
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      '--grant',
      'accountant',
    ],
    ['route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices'],
  ];

  const terms = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

  for (const step of steps) {
    expect(cli(root, 'generate', ...step, ...terms).code, step.join(' ')).toBe(0);
  }
}

/** Calls the new operation as a consumer of the package does: a refusal narrowed to the codes its contract declares. */
function consumerOf(name: string): string {
  return `import { createClient, type ErrorCode, unwrap } from '${name}';

type IssueInvoice = ReturnType<typeof createClient>['issueInvoice'];

/** Issues an invoice through the client of the contract: the code of a refusal, or the status of the success. */
export async function issue(input: Parameters<IssueInvoice>[0]): Promise<string> {
  const api = createClient({ baseUrl: 'http://127.0.0.1:3000', credentials: { bearer: () => 'token' } });
  const result = await api.issueInvoice(input);

  if (result.ok) {
    return String(result.status);
  }

  const code: ErrorCode = result.problem.code;

  return code;
}

/** The same call, a refusal thrown. */
export async function issueOrThrow(input: Parameters<IssueInvoice>[0]): Promise<unknown> {
  return unwrap(createClient({ baseUrl: 'http://127.0.0.1:3000' }).issueInvoice(input));
}
`;
}
