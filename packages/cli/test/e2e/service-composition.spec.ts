import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, scaffoldEverything, tempDir, write } from '../helpers';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { FAILED_COUNT, runSpecs } from './run-specs';
import { SLOW } from './stacks';

const PROOF = 'test/architecture/service-composition.spec.ts';
const FIXTURE = path.join(import.meta.dirname, 'fixtures/service-composition.spec.ts.txt');

const TENANT_PROOF = 'src/contexts/billing/test/integration/tenant-scoped-job.spec.ts';
const TENANT_FIXTURE = path.join(import.meta.dirname, 'fixtures/tenant-scoped-job.spec.ts.txt');

const JOB_SPEC = 'src/contexts/billing/test/unit/cancel-stale-invoices.job.spec.ts';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a multi-tenant project with the audit trail and privacy, every kind
 * generated, shipping run as a service. The real roots are composed: the whole application hosts the
 * per-tenant job of billing and the jobs of the platform, and nothing of shipping; the service of
 * shipping hosts its consumers once and no job of the platform. A per-tenant job reads the real tenant-scoped
 * repository of billing on the test database, and each run finds the rows of its own tenant only.
 */
describe.runIf(SLOW)('the roots of a multi-tenant project with a service', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('service-composition');
    scaffoldEverything(root, undefined, ['--tenancy', 'shared-table', '--audit', 'on', '--privacy', 'on']);
    installAsPublished(root);
  }, 240_000);

  it('writes a job per tenant, and has no finding as generated', () => {
    expect(read(root, 'src/contexts/billing/application/scheduling/cancel-stale-invoices.job.ts')).toContain(
      "tenancy: 'per-tenant'",
    );

    expectNoFinding(root);
  }, 480_000);

  it('passes the spec of the job on two tenants, the proof of what the whole application hosts, the proof of the roots, and the proof that a run reads its own tenant only', () => {
    write(root, PROOF, fs.readFileSync(FIXTURE, 'utf8'));
    write(root, TENANT_PROOF, fs.readFileSync(TENANT_FIXTURE, 'utf8'));

    const run = runSpecs(root, 'vitest', JOB_SPEC, 'test/architecture', TENANT_PROOF);

    expect(run).toMatch(/Test Files\s+\d+ passed/);
    expect(run).not.toMatch(FAILED_COUNT);
  }, 240_000);
});
