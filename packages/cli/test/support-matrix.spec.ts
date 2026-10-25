import { describe, expect, it } from 'vitest';
import { GENERATED_FAMILIES, differencesOf } from './support/generated-parity';
import {
  identityPresetRefusal,
  initRefusal,
  listedFlags,
  refusalsOverPairs,
  undeclared,
  unheld,
  valuesOf,
} from './support/refusals-of-the-matrix';
import { GENERATED_DIFFERENCES, IDENTITY_PRESET_REFUSALS, INIT_REFUSALS } from './support/support-matrix';

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
