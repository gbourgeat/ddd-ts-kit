import { describe, expect, it } from 'vitest';
import { scaffoldEverything, tempDir } from '../helpers';
import { generatePrismaClient } from './generate-prisma-client';
import { label, SLOW, STACKS } from './stacks';
import { typeErrors } from './type-errors';

// Left out: jest, whose types are not installed in this workspace. A Prisma project has its client
// generated first, as its build does; a TypeORM project finds typeorm in the package of the kit.
const CHECKABLE = STACKS.filter((stack) => stack.tests === 'vitest');

/** Slow, opt-in (DDD_TS_KIT_E2E=1): every stack, every kind, read by the compiler against the sources of the workspace packages. */
describe.runIf(SLOW)('a freshly generated project type-checks against the workspace packages', () => {
  it.each(CHECKABLE.map((stack) => [label(stack), stack] as const))(
    '%s',
    (_label, stack) => {
      const root = tempDir('typecheck');

      scaffoldEverything(root, stack);

      if (stack.orm === 'prisma') {
        generatePrismaClient(root);
      }

      expect(typeErrors(root)).toBe('');
    },
    120_000,
  );
});
