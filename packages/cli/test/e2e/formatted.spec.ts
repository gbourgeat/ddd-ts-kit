import { describe, expect, it } from 'vitest';
import { scaffoldEverything, tempDir } from '../helpers';
import { bin, findingsOf } from './run-in';
import { label, SLOW, STACKS } from './stacks';

/**
 * What the generator writes is already laid out the way the formatter of the project wants it:
 * `npm run format:check` passes right after generation, before anybody ran `npm run format`.
 */
describe.runIf(SLOW)('a freshly generated project', () => {
  it.each(STACKS.map((stack) => [label(stack), stack] as const))('is already formatted (%s)', (_label, stack) => {
    const root = tempDir('e2e-formatted');

    scaffoldEverything(root, stack);

    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
  });
});
