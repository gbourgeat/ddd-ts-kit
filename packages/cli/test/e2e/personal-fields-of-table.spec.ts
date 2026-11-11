import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from '../check-support';
import { cli } from '../helpers';
import { billingWithATableOfItsOwn } from '../support/billing-with-a-table-of-its-own';
import { expectOk } from '../support/expect-ok';
import { eslintOn } from './analyzers';
import { generatePrismaClient } from './generate-prisma-client';
import { installAsPublished } from './install-as-published';
import { bin, findingsOf, runIn } from './run-in';
import { SLOW } from './stacks';
import { typeErrors } from './type-errors';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const SPEC = `${BILLING}/test/integration/billing-personal-data.spec.ts`;

const WRITTEN = [
  `${PERSISTENCE}/payment-reminders.personal-fields.ts`,
  `${PERSISTENCE}/drizzle-billing-personal-data-erasure.repository.ts`,
  `${PERSISTENCE}/drizzle-billing-personal-data-export.repository.ts`,
  `${BILLING}/application/ports/billing-personal-data-erasure.port.ts`,
  `${BILLING}/application/ports/billing-personal-data-export.port.ts`,
  `${BILLING}/test/fakes/billing-personal-data-erasure.fake.ts`,
  `${BILLING}/test/fakes/billing-personal-data-export.fake.ts`,
  SPEC,
  'src/platform/privacy/data-subject-copies.ts',
  'src/platform/privacy/data-subject-exports.ts',
];

/** A project with a table of its own in billing, whose personal columns are declared with a retention. */
function declared(orm: string): string {
  const root = billingWithATableOfItsOwn(orm);

  expectOk(
    cli(
      root,
      'generate',
      'personal-fields',
      'billing',
      'payment_reminders',
      '--personal',
      'customer_email,customer_name',
      '--subject',
      'customer_id',
    ),
  );

  return root;
}

/** Slow, opt-in (DDD_TS_KIT_E2E=1): the declaration of a table no aggregate owns, read by the compiler on each ORM, then by both analyzers and the test runner of a project installed as published. */
describe.runIf(SLOW)('the personal columns of a table no aggregate owns, as generated', () => {
  it.each(['drizzle', 'knex', 'typeorm', 'prisma'])(
    'type-checks on %s: the declaration over the table of the project, the adapters, the fakes and the spec',
    (orm) => {
      const root = declared(orm);

      if (orm === 'prisma') {
        generatePrismaClient(root);
      }

      expect(typeErrors(root)).toBe('');
    },
    120_000,
  );

  describe('installed as published, on Drizzle', () => {
    let root: string;

    beforeAll(() => {
      root = declared('drizzle');
      installAsPublished(root);
    }, 240_000);

    it('passes the checker and ESLint as generated', () => {
      expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
      expect(findingsOf(root, eslintOn(...WRITTEN))).toBe('');
    }, 120_000);

    it('passes the spec it generated: the fakes proven, each case of the table left to write', () => {
      const specs = runIn(root, { command: bin('vitest'), args: ['run', SPEC] });

      expect(specs).toMatch(/Tests\s+2 passed \| 4 todo \(6\)/);
    }, 120_000);
  });
});
