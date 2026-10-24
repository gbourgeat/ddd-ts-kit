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
const EXPORT_PORT = `${BILLING}/application/ports/billing-personal-data-export.port.ts`;
const EXPORT_ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-billing-personal-data-export.repository.ts`;
const EXPORT_FAKE = `${BILLING}/test/fakes/billing-personal-data-export.fake.ts`;
const SPEC = `${BILLING}/test/integration/billing-personal-data.spec.ts`;
const COPIES = 'src/platform/privacy/data-subject-copies.ts';
const EXPORTS = 'src/platform/privacy/data-subject-exports.ts';

/** Slow, opt-in (DDD_TS_KIT_E2E=1): a repository that declares personal columns, installed as published, against the compiler, both analyzers and its own spec on the test database. */
describe.runIf(SLOW)('a repository with personal columns as generated', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate((root) => {
      cli(root, 'generate', 'aggregate', 'billing', 'Customer', '--term', 'Customer=A person who is billed');
      cli(root, 'generate', 'repository', 'billing', 'Customer', '--personal', 'email,display_name');
    });
  }, 240_000);

  it('type-checks as generated: the declaration, the adapters over the erasure and the export of the ORM package, the fakes and the spec', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');
  }, 120_000);

  it('passes the checker and ESLint as generated, and is listed among the copies and the exports of the platform', () => {
    expect(project.checkedRules()).toEqual([]);

    expect(
      project.linted(DECLARATION, PORT, ADAPTER, FAKE, EXPORT_PORT, EXPORT_ADAPTER, EXPORT_FAKE, SPEC, COPIES, EXPORTS),
    ).toBe('');
  }, 120_000);

  it('passes the spec it generated: two people saved, one erased as the declaration says and exported as erased, the other left and exported', () => {
    const specs = runIn(project.root, { command: bin('vitest'), args: ['run', SPEC] });

    expect(specs).toMatch(/Tests\s+6 passed \(6\)/);
  }, 120_000);
});
