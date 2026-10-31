import { beforeAll, describe, expect, it } from 'vitest';
import { exists, isDeclared, read, scaffoldEverything, tempDir } from '../helpers';
import { buildAndCheckDocuments } from './build-and-check-documents';
import { expectNoFinding } from './expect-no-finding';
import { failsWithoutASpec, pipelineRunsHoldTheThresholds, runWithCoverage } from './coverage-gate';
import { installAsPublished } from './install-as-published';
import { DEEP } from './night-stacks';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { PROVEN, SLOW } from './stacks';

const UNIT = 'src/contexts/billing/test/unit';
const JOB_SPECS = [`${UNIT}/cancel-stale-invoices.job.spec.ts`, `${UNIT}/issue-invoices-monthly.job.spec.ts`];
const DECORATED = 'src/contexts/billing/infrastructure/external/remote-tax-rates.adapter.ts';
const DECORATED_SPEC = 'src/contexts/billing/test/integration/remote-tax-rates.adapter.spec.ts';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): one project per stack, every kind generated, installed as a
 * published kit would be (`npm run build` at the root first) and held to all its own pipeline
 * runs: the checker, the three analyzers, its specs, its end-to-end specs, its build and its
 * generated documents. Its specs run once, with the coverage thresholds of the reference
 * (`test:coverage`, the run `verify` makes); the two runs the pipeline splits them into and the run with
 * a spec removed, which fails the gate naming the context and the layer, are held at night and before a
 * release on every stack (`DEEP`), on the first stack otherwise. That last test removes a file: it comes last.
 */
describe.runIf(SLOW).each(PROVEN.map(([label, stack], index) => [label, stack, DEEP || index === 0] as const))(
  'a freshly generated project (%s)',
  (_label, stack, held) => {
    let root: string;

    const vitest = (...args: string[]): string => runIn(root, { command: bin('vitest'), args: ['run', ...args] });

    beforeAll(() => {
      root = tempDir('proven');
      scaffoldEverything(root, stack);
      installAsPublished(root);
    }, 120_000);

    it('has no finding: the checker, ESLint with the preset and the rules of this wave, dependency-cruiser with the generated configuration, knip', () => {
      expectNoFinding(root);
    }, 480_000);

    it('passes its own specs: each job run by its name and held to the command it sent, a decorated adapter, the extraction of every context', () => {
      const specs = runWithCoverage(root);

      const ran = exists(root, 'src/platform/composition/platform-test.module.ts')
        ? "await application.jobs.runNow('billing.cancel-stale-invoices');"
        : 'await job.run(occurrence);';

      expect(specs).toMatch(/Test Files\s+\d+ passed/);
      expect(specs).not.toMatch(FAILED_COUNT);

      expect(read(root, JOB_SPECS[0] ?? '')).toContain(
        `${ran}\n\n    expect(sent).toHaveLength(1);\n    expect(sent[0]).toBeInstanceOf(CancelInvoiceCommand);`,
      );

      expect(vitest(...JOB_SPECS)).toMatch(/Tests\s+2 passed \| 4 todo/);

      expect(read(root, DECORATED)).toMatch(
        isDeclared(stack) ? /@Adapter\(TaxRates[\s\S]*@Retry\(\{ attempts: 3/ : /@Retry\(\{ attempts: 3/,
      );

      expect(vitest(DECORATED_SPEC)).toMatch(/Tests\s+2 passed/);
      expect(vitest('test/architecture/extractable.spec.ts')).toMatch(/Tests\s+\d+ passed/);
    }, 240_000);

    it('passes its end-to-end specs: 401, 403 and 2xx with tokens signed in the test, the trace of the request as one tree, and a use case started by an integration event', () => {
      const endToEnd = vitest('--config', 'vitest.e2e.config.ts');

      expect(endToEnd).toMatch(/Tests\s+6 passed/);
      expect(endToEnd).not.toMatch(FAILED_COUNT);

      expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toMatch(
        /expectStatus\(response, 401\)[\s\S]*expectStatus\(response, 403\)[\s\S]*expectSpanTree\(storyOf\(trace\), \[\n\s+\{\n\s+name: 'POST \/invoices',\n\s+kind: 'SERVER',\n\s+children: \[\{ name: 'command IssueInvoiceCommand', children: \[\{ name: 'repository InvoiceRepository\.save' \}\] \}\],\n\s+\},/,
      );
    }, 240_000);

    it('builds, the worker and the extracted service included, and its generated documents are current', () => {
      buildAndCheckDocuments(root);
    }, 240_000);

    it.runIf(held)(
      'holds the thresholds in the unit and the integration runs of the pipeline',
      () => {
        pipelineRunsHoldTheThresholds(root);
      },
      240_000,
    );

    it.runIf(held)(
      'fails once a spec is removed, with a message that names the context and the layer left under their threshold',
      () => {
        failsWithoutASpec(root);
      },
      240_000,
    );
  },
);
