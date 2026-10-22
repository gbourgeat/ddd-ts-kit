import { beforeAll, describe, expect, it } from 'vitest';
import { writeBusinessDecisions } from '../first-class-proof';
import { changeConfig, CONFIG } from '../check-support';
import { cli, read, scaffoldEverything, tempDir, walk } from '../helpers';
import { jsonAt } from '../support/json-at';
import { keysAt } from '../support/keys-at';
import { buildAndCheckDocuments } from './build-and-check-documents';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { bin, findingsOf, runIn } from './run-in';
import { FIRST_CLASS, FIRST_CLASS_BROKERS, SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';
import { REPORTED_WORK_PROOF, writeReportedWorkProof } from './write-reported-work-proof';

const DECORATED = 'src/contexts/billing/infrastructure/external/remote-tax-rates.adapter.ts';
const DECORATED_SPEC = 'src/contexts/billing/test/integration/remote-tax-rates.adapter.spec.ts';

const JOB_SPECS = ['cancel-stale-invoices', 'issue-invoices-monthly'].map(
  (job) => `src/contexts/billing/test/unit/${job}.job.spec.ts`,
);

const DATABASE = process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the stack of the example application, every kind generated,
 * then the business decisions of ../first-class-proof.ts: tokens shaped like those of a Keycloak
 * realm and signed in the test, a list narrowed by relationships, the audit trail read through
 * its route, the correlation id of a request followed to the published event, that event
 * carried from billing to the handler of shipping, and the whole of it asserted as one trace
 * with `expectSpanTree`. With DDD_TS_KIT_TEST_DATABASE_URL,
 * _REDIS_URL, _NATS_URL, _KAFKA_BROKERS and _AMQP_URL it runs on those servers (the database is
 * migrated first) and the event really crosses the broker; without them, in the process.
 */
describe.runIf(SLOW).each(FIRST_CLASS_BROKERS)('the first-class stack, events on %s', (broker) => {
  let root: string;

  const vitest = (...args: string[]): string =>
    runIn(root, { command: bin('vitest'), args: ['run', ...args], env: { DATABASE_URL: DATABASE } });

  beforeAll(() => {
    root = tempDir('first-class');
    scaffoldEverything(root, { ...FIRST_CLASS, broker });
    installAsPublished(root);
  }, 120_000);

  it('has no finding as generated: the checker, ESLint with the preset and the rules of this wave, dependency-cruiser, knip', () => {
    expectNoFinding(root);
  }, 480_000);

  it('still has none once the team has written its business decisions, and passes its specs: jobs, decorated adapter, legacy decorator mode', () => {
    writeBusinessDecisions(root);
    expectNoFinding(root);

    const specs = runIn(root, { command: bin('vitest'), args: ['run'] });

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');

    // class-validator imposes the legacy decorator mode: the declarations and the aspects on a method serve it as they are.
    expect(JSON.parse(read(root, 'tsconfig.json'))).toMatchObject({
      compilerOptions: { experimentalDecorators: true },
    });

    expect(read(root, DECORATED)).toMatch(/@Adapter\(TaxRates[\s\S]*@Retry\(\{ attempts: 3/);

    expect(runIn(root, { command: bin('vitest'), args: ['run', DECORATED_SPEC, ...JOB_SPECS] })).toMatch(
      /Tests\s+4 passed \| 6 todo/,
    );
  }, 480_000);

  it('reports a failed job and a dead-lettered event to the reporter in memory of its test application', () => {
    writeReportedWorkProof(root);
    expectNoFinding(root);

    expect(runIn(root, { command: bin('vitest'), args: ['run', REPORTED_WORK_PROOF] })).toMatch(/Tests\s+2 passed/);
  }, 480_000);

  it('builds, and its generated documents are current, the audit route in the contract', () => {
    buildAndCheckDocuments(root);

    expect(read(root, 'openapi/openapi.yaml')).toContain('\n  /audit/entries:\n');
  }, 240_000);

  it('splits its contract between the documents of the config, refuses a route left out, and joins it again', () => {
    const contexts = keysAt(jsonAt(JSON.parse(read(root, CONFIG)), 'contexts')).filter((name) => name !== 'billing');

    const generate = (): string => findingsOf(root, { command: process.execPath, args: ['dist/scripts/openapi.js'] });

    const documented = (documents: readonly object[]): void => {
      changeConfig(root, { openapi: { documents } });
      expect(cli(root, 'docs').code).toBe(0);
      runIn(root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.build.json'] });
      expect(cli(root, 'build-aliases').code).toBe(0);
    };

    documented([{ name: 'billing', title: 'Billing', contexts: ['billing'] }]);

    expect(generate()).toContain('GET /audit/entries (searchAuditEntries)');

    documented([
      { name: 'billing', title: 'Billing', contexts: ['billing'] },
      { name: 'operations', title: 'Operations', contexts, tags: ['audit'] },
    ]);

    expect(generate()).toBe('');
    expect(walk(root, 'openapi')).toEqual(['openapi/billing.yaml', 'openapi/operations.yaml']);
    expect(read(root, 'openapi/billing.yaml')).toMatch(/^info:\n {2}title: Billing\n/m);
    expect(read(root, 'openapi/billing.yaml')).toContain('\n  /invoices:\n');
    expect(read(root, 'openapi/billing.yaml')).not.toContain('/audit/entries');
    expect(read(root, 'openapi/operations.yaml')).toContain('\n  /audit/entries:\n');
    expect(findingsOf(root, { command: process.execPath, args: ['dist/scripts/openapi.js', '--check'] })).toBe('');
    expect(cli(root, 'docs', '--check').code).toBe(0);

    documented([]);

    expect(generate()).toBe('');
    expect(walk(root, 'openapi')).toEqual(['openapi/openapi.yaml']);
  }, 240_000);

  it('passes its end-to-end proof', () => {
    if (DATABASE !== '') {
      runIn(root, { command: bin('knex'), args: ['migrate:latest'], env: { DATABASE_URL: DATABASE } });
    }

    const endToEnd = vitest('--config', 'vitest.e2e.config.ts');

    // The generated specs (401, 403, 201, the whole trace of the request in one tree; one public query; one use case an integration event starts) and the five of the proof.
    expect(endToEnd).toMatch(/Tests\s+11 passed/);

    expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toMatch(
      /expectSpanTree\(storyOf\(trace\)[\s\S]*'POST \/invoices'[\s\S]*'command IssueInvoiceCommand'[\s\S]*'repository InvoiceRepository\.save'[\s\S]*'domain-event billing\.invoice\.issued'/,
    );

    expect(endToEnd).not.toContain('failed');
  }, 480_000);
});
