import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, write } from '../helpers';
import { expectOk } from '../support/expect-ok';
import { initProject } from '../support/init-project';
import { installAsPublished } from './install-as-published';
import { SERVER } from './run-on-a-server';
import { FAILED_COUNT, runSpecs } from './run-specs';
import { SLOW } from './stacks';

const ON_A_SERVER = SLOW && SERVER !== '';

const PROOF = 'test/architecture/read-model-tables-of-a-service.spec.ts';
const FIXTURE = path.join(import.meta.dirname, 'fixtures/read-model-tables-of-a-service.spec.ts.txt');

/** How each family of composition root names the contexts a service hosts, as `apps/billing/main.ts` does. */
const SERVICES: readonly (readonly [family: string, flags: readonly string[], service: string])[] = [
  ['a container of the kit', [], "{ modules: everyContext.modules.filter((module) => module.name === 'billing') }"],
  ['a platform wired by hand', ['--di', 'manual'], 'everyContext.filter((module) => !hostedContexts.includes(module))'],
];

/** Two contexts with a read model each, billing run as a service: the project the extraction of a context leaves. */
function projectWithAService(flags: readonly string[]): string {
  const root = initProject('--orm', 'knex', ...flags, '--context', 'billing:core', '--context', 'shipping:supporting');

  expectOk(cli(root, 'generate', 'read-model', 'billing', 'InvoiceSummaries', '--field', 'customerId:string'));
  expectOk(cli(root, 'generate', 'read-model', 'shipping', 'Parcels', '--field', 'weight:number'));
  expectOk(cli(root, 'generate', 'service', 'billing'));
  installAsPublished(root);

  return root;
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_MIGRATIONS_SERVER): a context run as a service of
 * its own, on a database that holds its tables alone, as the extraction of a context leaves it.
 * The real roots are composed and started on a real PostgreSQL: each checks the read model tables
 * of the contexts it hosts and no other, refuses to start on one of its own that is not ready,
 * and tells a table its role may not read under the name of its store.
 */
describe.runIf(ON_A_SERVER)('the read model tables a root checks when it starts, on a real PostgreSQL', () => {
  it.each(SERVICES)(
    'on %s: each root checks its own tables, on its own database',
    (_family, flags, service) => {
      const root = projectWithAService(flags);

      write(root, PROOF, fs.readFileSync(FIXTURE, 'utf8').replace('__SERVICE__', service));

      const run = runSpecs(root, 'vitest', PROOF);

      expect(run).toMatch(/Tests\s+3 passed/);
      expect(run).not.toMatch(FAILED_COUNT);
    },
    480_000,
  );
});
