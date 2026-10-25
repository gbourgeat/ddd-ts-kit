import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir, write, type StackFlags } from '../helpers';
import { grantOf } from '../support/grant-of';
import { initFlags } from '../support/init-flags';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const PROOF = 'src/rpc-procedures.spec.ts';

/** The proof written into the project, by the protocol it serves its procedures with. */
const FIXTURES = {
  orpc: path.join(import.meta.dirname, 'fixtures/rpc-procedures.spec.ts.txt'),
  trpc: path.join(import.meta.dirname, 'fixtures/trpc-procedures.spec.ts.txt'),
};

const TERMS = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

/** The four servers the procedures are mounted on, each in the wiring it is most often found with. */
const SERVERS: readonly (readonly [string, StackFlags])[] = [
  [
    'Express, declared',
    { http: 'express', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'custom', events: 'outbox' },
  ],
  [
    'Fastify, wired by hand',
    { http: 'fastify', validation: 'typebox', di: 'manual', tests: 'vitest', orm: 'custom', events: 'outbox' },
  ],
  [
    'Hono on Node, declared',
    { http: 'hono', validation: 'zod', di: 'tsyringe', tests: 'vitest', orm: 'custom', events: 'outbox' },
  ],
  [
    'NestJS',
    { http: 'nest', validation: 'class-validator', di: 'nest', tests: 'vitest', orm: 'custom', events: 'outbox' },
  ],
];

/** Each server with each protocol: the mount differs for every pair. */
const RPC_STACKS = (['orpc', 'trpc'] as const).flatMap((rpc) =>
  SERVERS.map(([label, stack]) => [`${label}, ${rpc === 'orpc' ? 'oRPC' : 'tRPC'}`, stack, rpc] as const),
);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): `init --rpc orpc` and `init --rpc trpc` on each HTTP framework,
 * a protected command behind its route, installed as a published kit. The project has no finding and
 * type-checks, and a spec written into it starts its real server and holds the procedures to what
 * the route answers.
 */
describe.runIf(SLOW).each(RPC_STACKS)('a project that serves its routes as procedures (%s)', (_label, stack, rpc) => {
  let root: string;

  beforeAll(() => {
    root = tempDir('rpc');
    scaffold(root, stack, rpc);
    installAsPublished(root);
  }, 120_000);

  it('has no finding as generated: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expectNoFinding(root);
  }, 480_000);

  it('type-checks', () => {
    expect(runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '--noEmit', '-p', 'tsconfig.json'] })).toBe(
      '',
    );
  }, 240_000);

  it('answers a procedure as its route: the same refusal for an anonymous caller, the same answer for a granted one', () => {
    write(root, PROOF, fs.readFileSync(FIXTURES[rpc], 'utf8'));

    const proof = runIn(root, { command: bin('vitest'), args: ['run', PROOF] });

    expect(proof).toMatch(/Tests\s+3 passed/);
    expect(proof).not.toMatch(FAILED_COUNT);
  }, 240_000);
});

function scaffold(root: string, stack: StackFlags, rpc: keyof typeof FIXTURES): void {
  const steps = [
    ['init', ...initFlags(stack), '--rpc', rpc],
    [
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--purpose',
      'Bills customers for what they bought.',
    ],
    ['generate', 'aggregate', 'billing', 'Invoice', ...TERMS],
    [
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      ...grantOf(stack)('accountant'),
      ...TERMS,
    ],
    ['generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices', ...TERMS],
  ];

  for (const step of steps) {
    const result = cli(root, ...step, '--json');

    if (result.code !== 0) {
      throw new Error(`${step.join(' ')} failed (${String(result.code)}): ${result.stderr || result.stdout}`);
    }
  }
}
