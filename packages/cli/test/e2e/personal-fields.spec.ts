import { beforeAll, describe, expect, it } from 'vitest';
import { cli } from '../helpers';
import { EditedProject } from './edited-project';
import { bin, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const BILLING = 'src/contexts/billing';
const DECLARATION = `${BILLING}/infrastructure/persistence/customer.personal-fields.ts`;
const PORT = `${BILLING}/application/ports/billing-personal-data-erasure.port.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-billing-personal-data-erasure.repository.ts`;
const FAKE = `${BILLING}/test/fakes/billing-personal-data-erasure.fake.ts`;
const SPEC = `${BILLING}/test/integration/billing-personal-data-erasure.spec.ts`;
const COPIES = 'src/platform/privacy/data-subject-copies.ts';

/** Slow, opt-in (DDD_TS_KIT_E2E=1): a repository that declares personal columns, installed as published, against the compiler, both analyzers and its own spec on the test database. */
describe.runIf(SLOW)('a repository with personal columns as generated', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate((root) => {
      cli(root, 'generate', 'aggregate', 'billing', 'Customer', '--term', 'Customer=A person who is billed');
      cli(root, 'generate', 'repository', 'billing', 'Customer', '--personal', 'email,display_name');
    });
  }, 240_000);

  it('type-checks as generated: the declaration, the adapter over the erasure of the ORM package, the fake and the spec', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');
  }, 120_000);

  it('passes the checker and ESLint as generated, and is listed among the copies the platform erases', () => {
    expect(project.checkedRules()).toEqual([]);
    expect(project.linted(DECLARATION, PORT, ADAPTER, FAKE, SPEC, COPIES)).toBe('');
  }, 120_000);

  it('passes the spec it generated: two people saved, one erased as the declaration says, the other left, nothing reached twice', () => {
    const specs = runIn(project.root, { command: bin('vitest'), args: ['run', SPEC] });

    expect(specs).toMatch(/Tests\s+3 passed \(3\)/);
  }, 120_000);
});
