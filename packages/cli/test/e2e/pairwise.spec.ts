import { describe, expect, it } from 'vitest';
import { scaffoldEverything, tempDir } from '../helpers';
import { pairwiseStacks } from '../support/pairwise';
import { generatePrismaClient } from './generate-prisma-client';
import { EVERY_STACK, label, SLOW } from './stacks';
import { typeErrors } from './type-errors';

/** At night and before a release: the stacks that meet the pairs of capability values no other stack meets. */
const PAIRWISE = process.env['DDD_TS_KIT_PAIRWISE'] === '1';

// Jest and Vitest alike: both runners and their types are installed in the workspace.
const CHECKABLE = pairwiseStacks(EVERY_STACK);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1 and DDD_TS_KIT_PAIRWISE=1): each value of a capability flag meets
 * each value of every other one in a stack that is generated whole and type-checked, so that a
 * combination nobody listed cannot break a project unseen.
 */
describe.runIf(SLOW && PAIRWISE)('every pair of capability values, generated and type-checked', () => {
  it.each(CHECKABLE.map((stack) => [label(stack), stack] as const))(
    '%s',
    (_label, stack) => {
      const root = tempDir('pairwise');

      scaffoldEverything(root, stack);

      if (stack.orm === 'prisma') {
        generatePrismaClient(root);
      }

      expect(typeErrors(root)).toBe('');
    },
    180_000,
  );
});
