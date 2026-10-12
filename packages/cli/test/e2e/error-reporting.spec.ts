import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir } from '../helpers.js';
import { expectNoFinding } from './expect-no-finding.js';
import { installAsPublished } from './install-as-published.js';
import { bin, runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { NATIVE_COMPILER } from './type-errors.js';
import { REPORTED_FAILURES_PROOF, writeReportedFailuresProof } from './write-reported-failures-proof.js';

const REPORTED: readonly (readonly [string, readonly string[]])[] = [
  ['on tsyringe, declared, behind RabbitMQ and the outbox', ['--orm', 'custom', '--broker', 'rabbitmq']],
  ['wired by hand, without a database', ['--di', 'manual', '--orm', 'none']],
];

const TERMS = ['--term', 'Order=What a customer asked to receive', '--term', 'Track=To follow an order'];

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): `init --errors sentry` in both wiring families, installed as
 * a published kit would be. No Sentry or GlitchTip server: the proof stays in the process, on a
 * reporter in memory, then on the real SDK sending to an endpoint of the loopback interface.
 */
describe.runIf(SLOW).each(REPORTED)('a generated project that reports its failures (%s)', (_label, flags) => {
  let root: string;

  beforeAll(() => {
    root = tempDir('reported');
    scaffold(root, flags);
    installAsPublished(root);
  }, 120_000);

  it('has no finding as generated: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expectNoFinding(root);
  }, 480_000);

  it('builds its three entry points, each starting the reporter second', () => {
    runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'] });

    for (const entry of ['main', 'apps/worker/main', 'apps/ordering/main']) {
      const [first, second] = read(root, `dist/src/${entry}.js`)
        .split('\n')
        .filter((line) => line.startsWith('import '));

      expect(first).toContain("/platform/tracing';");
      expect(second).toContain("/platform/errors';");
    }
  }, 240_000);

  it('reports a failing use case once, nothing without a DSN, and one scrubbed event to the tracker of the DSN', () => {
    writeReportedFailuresProof(root);

    const proof = runIn(root, { command: bin('vitest'), args: ['run', REPORTED_FAILURES_PROOF] });

    expect(proof).toMatch(/Tests\s+3 passed/);
    expect(proof).not.toContain('failed');
  }, 240_000);
});

/** A project that reports to Sentry or GlitchTip, with one public query behind a route, an adapter, a worker and its context extracted as a service. */
function scaffold(root: string, flags: readonly string[]): void {
  const steps = [
    ['init', '--errors', 'sentry', ...flags, '--context', 'ordering:core'],
    ['generate', 'query', 'ordering', 'TrackOrder', '--public', ...TERMS],
    ['generate', 'route', 'ordering', 'TrackOrder', '--method', 'GET', '--path', '/orders/:orderId'],
    // An adapter that states its own policy: without one, nothing of a declared project reads `ownPolicy` and knip says so.
    ['generate', 'port', 'ordering', 'CarrierTracking', '--term', 'Carrier=Who moves an order'],
    ['generate', 'adapter', 'ordering', 'CarrierTracking', '--decorators'],
    ['generate', 'worker'],
    ['generate', 'service', 'ordering'],
  ];

  for (const step of steps) {
    const result = cli(root, ...step, '--json');

    if (result.code !== 0) {
      throw new Error(`${step.join(' ')} failed (${String(result.code)}): ${result.stderr || result.stdout}`);
    }
  }
}
