import { describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, removeTempDir, type StackFlags, scaffoldEverything, tempDir } from '../helpers';
import { initFlags } from '../support/init-flags';
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

/**
 * `init` alone, with no context and no audit set, leaves the registry of permissions with the comments of its
 * region only: the formatter keeps that form too.
 */
describe.runIf(SLOW)('a project with no ORM and no context', () => {
  it('is already formatted on relationships without an authenticator', () => {
    const root = tempDir('e2e-formatted-alone');
    const stack: StackFlags = { ...DEFAULT_STACK, orm: 'none', authn: 'none', authz: 'rebac', di: 'manual' };

    try {
      expect(cli(root, 'init', ...initFlags(stack)).code).toBe(0);
      expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=400', '.'] })).toBe('');
    } finally {
      removeTempDir(root);
    }
  });
});
