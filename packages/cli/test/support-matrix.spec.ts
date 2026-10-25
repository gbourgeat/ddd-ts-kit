import { describe, expect, it } from 'vitest';
import { GENERATED_FAMILIES, differencesOf } from './support/generated-parity';
import {
  identityPresetRefusal,
  initRefusal,
  listedFlags,
  refusalsOverPairs,
  undeclared,
  unheld,
  vagueReasons,
  valuesOf,
} from './support/refusals-of-the-matrix';
import { GENERATED_DIFFERENCES, IDENTITY_PRESET_REFUSALS, INIT_REFUSALS, TENANT_GAPS } from './support/support-matrix';
import { tenantTakers, untenantedCalls } from './support/tenant-wiring';
import { DEFAULT_STACK, scaffoldEverything, tempDir } from './helpers';
import { acceptedPairs, pairsMet, pairwiseStacks } from './support/pairwise';
import { EVERY_STACK } from './e2e/stacks';

// Every combination the kit refuses is a written decision, or a gap named as such: a refusal no
// line of test/support/support-matrix.ts declares fails here, and so does a line that no longer holds.

describe('the support matrix of init', () => {
  it('reads the values of every flag of init that takes one from a list', () => {
    expect(listedFlags().filter((flag) => valuesOf(flag).length === 0)).toEqual([]);
  });

  it('declares every refusal of init on a flag or a pair of flags, decided or not yet', () => {
    expect(undeclared(refusalsOverPairs(initRefusal), INIT_REFUSALS)).toEqual([]);
  });

  it('holds each declared refusal of init on its example', () => {
    expect(unheld(INIT_REFUSALS, initRefusal)).toEqual([]);
  });
});

describe('the support matrix of the identity preset', () => {
  it('declares every refusal of the preset on a stack init accepts, decided or not yet', () => {
    expect(undeclared(refusalsOverPairs(identityPresetRefusal), IDENTITY_PRESET_REFUSALS)).toEqual([]);
  });

  it('holds each declared refusal of the preset on its example', () => {
    expect(unheld(IDENTITY_PRESET_REFUSALS, identityPresetRefusal)).toEqual([]);
  });
});

describe('the members of a family of flags, with every capability on', () => {
  it.each(GENERATED_FAMILIES.map((family) => [family.family, family] as const))(
    'generate the same platform todos and packages of the kit across the %s family, or say why not',
    (_, family) => {
      expect(differencesOf(family, GENERATED_DIFFERENCES)).toEqual([]);
    },
  );
});

describe('the lines of the support matrix', () => {
  it('each give a reason that says what the kit does instead', () => {
    const refusals = [...INIT_REFUSALS, ...IDENTITY_PRESET_REFUSALS].map(({ why }) => why);
    const differences = GENERATED_DIFFERENCES.flatMap(({ without }) => Object.values(without));

    expect(vagueReasons([...refusals, ...differences])).toEqual([]);
  });
});

/** Every capability that keeps rows of a tenant, beside the shared tables themselves. */
const MULTI_TENANT = ['--queue', 'database', '--audit', 'on', '--event-sourcing', 'on', '--privacy', 'on'];

describe('a multi-tenant project, every kind generated', () => {
  it.each(['knex', 'drizzle', 'prisma', 'typeorm'])(
    'gives the tenant to every store of the kit that takes one, on %s',
    (orm) => {
      const root = tempDir(`tenant-wiring-${orm}`);

      scaffoldEverything(root, { ...DEFAULT_STACK, orm, tenancy: 'shared-table' }, MULTI_TENANT);

      expect(untenantedCalls(root, tenantTakers(), TENANT_GAPS)).toEqual([]);
    },
    120_000,
  );
describe('the stacks of the end-to-end run', () => {
  it('meet every pair of capability values init accepts, the pairwise ones added to those listed', () => {
    const met = pairsMet([...EVERY_STACK, ...pairwiseStacks(EVERY_STACK)]);

    expect(acceptedPairs().filter((pair) => !met.has(pair))).toEqual([]);
  });
});
