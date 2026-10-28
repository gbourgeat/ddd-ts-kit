import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir } from '../helpers';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { generatePrismaClient } from './generate-prisma-client';
import { bin, findingsOf, runIn } from './run-in';
import { allPassed, FAILED_COUNT, runSpecs } from './run-specs';
import { SLOW } from './stacks';
import { typeErrors } from './type-errors';

/**
 * The families the identity preset is written for: the defaults of init (roles); Knex with
 * class-validator, relationships, tenants and Keycloak; Prisma with tenants; attribute policies on Fastify with tenants,
 * a JWT verifier and the schemas of each route its own. OpenFGA, and the preset generated into a
 * project that exists, are proven by `preset-identity-generated.spec.ts`.
 */
const FLAVOURS: readonly (readonly [string, readonly string[]])[] = [
  ['drizzle, zod, rbac', []],
  [
    'knex, class-validator, rebac, shared tables, keycloak',
    [
      '--orm',
      'knex',
      '--validation',
      'class-validator',
      '--authz',
      'rebac',
      '--tenancy',
      'shared-table',
      '--authn',
      'keycloak',
    ],
  ],
  ['prisma, zod, rbac, shared tables', ['--orm', 'prisma', '--tenancy', 'shared-table']],
  ['typeorm, zod, rbac, shared tables', ['--orm', 'typeorm', '--tenancy', 'shared-table']],
  ['explicit, wired by hand, fastify', ['--di', 'manual', '--http', 'fastify']],
  [
    'explicit, nest, class-validator, Nest controllers',
    ['--http', 'nest', '--di', 'nest', '--validation', 'class-validator', '--routes', 'nest'],
  ],
  // The stack of the spend management example: NestJS, class-validator, Prisma with tenants, Jest.
  [
    'nest, class-validator, prisma, shared tables, jest',
    [
      '--http',
      'nest',
      '--di',
      'nest',
      '--validation',
      'class-validator',
      '--orm',
      'prisma',
      '--tenancy',
      'shared-table',
      '--tests',
      'jest',
    ],
  ],
  [
    'abac, fastify, shared tables, jwt, schemas per route',
    ['--authz', 'abac', '--http', 'fastify', '--tenancy', 'shared-table', '--schemas', 'per-route'],
  ],
];

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project initialised with `--preset identity`, installed as a
 * published kit would be (`npm run build` at the root first), is green as it is: no finding of
 * any analyzer, formatted, type-checked, and its specs pass, those of its adapters on PostgreSQL
 * in process included.
 */
describe.runIf(SLOW).each(FLAVOURS)('a project bootstrapped with the identity preset (%s)', (_label, flags) => {
  let root: string;

  beforeAll(() => {
    root = bootstrapped(flags);
    installAsPublished(root);

    if (flags.includes('prisma')) {
      // The client and the schema of the tests, which the scripts of the project derive from prisma/schema.prisma.
      runIn(root, { command: 'npm', args: ['run', 'db:client'] });
    }
  }, 120_000);

  it('has no finding, and is laid out as its formatter wants it', () => {
    expectNoFinding(root);
    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
  }, 480_000);

  it.runIf(flags.includes('prisma'))(
    'keeps one current membership per account with the partial index Prisma derives from its preview feature',
    () => {
      // `partialIndexes` is a preview feature of Prisma: an upgrade that changes it fails here first.
      expect(read(root, 'generated/schema.sql')).toMatch(
        /CREATE UNIQUE INDEX "members_current_idx" ON "identity"\."members"\("organisation_id", "account_id"\) WHERE \("removed_at" IS NULL\);/,
      );
    },
  );

  it('type-checks against the sources of the packages, and passes its specs', () => {
    const checked = bootstrapped(flags);

    if (flags.includes('prisma')) {
      generatePrismaClient(checked);
    }

    expect(typeErrors(checked)).toBe('');

    const tests = flags.includes('jest') ? 'jest' : 'vitest';
    const specs = runSpecs(root, tests);

    expect(specs).toMatch(allPassed(tests));
    expect(specs).not.toMatch(FAILED_COUNT);
  }, 480_000);
});

function bootstrapped(flags: readonly string[]): string {
  const root = tempDir('preset');

  expect(cli(root, 'init', '--package-manager', 'npm', ...flags, '--preset', 'identity').code).toBe(0);

  return root;
}
