import { expect } from 'vitest';
import type { Manager } from './install-for-real';
import { runIn } from './run-in';

/**
 * The `verify` script of a project, run by its package manager as a team runs it: every gate
 * passes, some spec ran, and no analyzer has a remark left, a hint of knip about its own
 * configuration included.
 */
export function verified(root: string, manager: Manager): void {
  // Both streams: an analyzer says its remarks on either.
  const printed = runIn(root, {
    command: 'sh',
    args: ['-c', `${manager} run verify 2>&1`],
    env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
  });

  expect(printed).toMatch(/Test Files\s+\d+ passed/);
  expect(printed).not.toMatch(/\d+ failed|Unused|Configuration hints/);
}
