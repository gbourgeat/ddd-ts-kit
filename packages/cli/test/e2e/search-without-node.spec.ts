import { describe, expect, it } from 'vitest';
import { read, removeTempDir, write } from '../helpers';
import { initProject } from '../support/init-project';
import { installAsPublished } from './install-as-published';
import { allPassed, FAILED_COUNT, runSpecs } from './run-specs';
import { SLOW } from './stacks';

const MODULE = 'src/contexts/billing/billing.module.ts';

const IMPORT = "import { defineCriteria } from '@ddd-ts-kit/kernel';";

/** A store declared by the context as it is wired by hand: the platform knows its name before the start. */
const DECLARED = [
  "  platform.search.options('billing_invoices', defineCriteria<{ readonly id: string }>({",
  "    fields: { id: { type: 'string', filter: ['eq'] } },",
  "    defaultSort: [{ field: 'id', direction: 'asc' }],",
  "    tieBreaker: 'id',",
  '  }));',
].join('\n');

const STARTED = `import { describe, expect, it } from 'vitest';
import { startApplication } from '../support/start-application';

describe('the application with a search store and no node', () => {
  it('starts and stops', async () => {
    const application = await startApplication();

    await application.close();

    expect(application.client).toBeDefined();
  });
});
`;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project whose context declares a store of OpenSearch, run by
 * its own end-to-end runner, which gives the application no node. The start provisions nothing and
 * passes; a request of the store would be refused.
 */
describe.runIf(SLOW)('a project with a search store and no node', () => {
  it('starts its application in its end-to-end tests', () => {
    const root = initProject('--orm', 'none', '--di', 'manual', '--search', 'opensearch', '--context', 'billing:core');

    try {
      const module = read(root, MODULE)
        .replace('// ddd-ts-kit:imports\n', `// ddd-ts-kit:imports\n${IMPORT}\n`)
        .replace('  // ddd-ts-kit:handlers\n', `  // ddd-ts-kit:handlers\n${DECLARED}\n`);

      write(root, MODULE, module);
      write(root, 'test/e2e/billing/started.e2e.spec.ts', STARTED);
      installAsPublished(root);

      const output = runSpecs(root, 'vitest', '--config', 'vitest.e2e.config.ts');

      expect(output).toMatch(allPassed('vitest'));
      expect(output).not.toMatch(FAILED_COUNT);
    } finally {
      removeTempDir(root);
    }
  }, 300_000);
});
