import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir } from '../helpers.js';
import { expectNoFinding } from './expect-no-finding.js';
import { installAsPublished } from './install-as-published.js';
import { bin, findingsOf, runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { typeErrors } from './type-errors.js';

/**
 * The families the identity preset is written for: the defaults of init (roles); Knex with
 * class-validator, relationships, tenants and Keycloak; attribute policies on Fastify with tenants,
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
  }, 120_000);

  it('has no finding, and is laid out as its formatter wants it', () => {
    expectNoFinding(root);
    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
  }, 480_000);

  it('type-checks against the sources of the packages, and passes its specs', () => {
    expect(typeErrors(bootstrapped(flags))).toBe('');

    const specs = runIn(root, { command: bin('vitest'), args: ['run'] });

    expect(specs).toMatch(/Test Files\s+\d+ passed/);
    expect(specs).not.toContain('failed');
  }, 480_000);
});

function bootstrapped(flags: readonly string[]): string {
  const root = tempDir('preset');

  expect(cli(root, 'init', '--package-manager', 'npm', ...flags, '--preset', 'identity').code).toBe(0);

  return root;
}
