import { describe, expect, it } from 'vitest';
import { scaffoldEverything, tempDir } from '../helpers.js';
import { label, SLOW, STACKS } from './stacks.js';
import { typeErrors } from './type-errors.js';

// Left out: jest (its types are not installed in this workspace), prisma (its client has to be
// generated first) and typeorm (not installed at the workspace root).
const CHECKABLE = STACKS.filter((stack) => stack.tests === 'vitest' && stack.orm !== 'prisma' && stack.orm !== 'typeorm');

/** Slow, opt-in (DDD_TS_KIT_E2E=1): every stack, every kind, read by the compiler against the sources of the workspace packages. */
describe.runIf(SLOW)('a freshly generated project type-checks against the workspace packages', () => {
  it.each(CHECKABLE.map((stack) => [label(stack), stack] as const))('%s', (_label, stack) => {
    const root = tempDir('typecheck');

    scaffoldEverything(root, stack);

    expect(typeErrors(root)).toBe('');
  }, 120_000);
});
