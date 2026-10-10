import { cli, tempDir } from '../helpers.js';

/** A new project in a temporary directory, initialised with the given flags: the directory, once `init` succeeded. */
export function initProject(...flags: readonly string[]): string {
  const root = tempDir('init');
  const result = cli(root, 'init', ...flags);

  if (result.code !== 0) throw new Error(`init ${flags.join(' ')} failed (${result.code}): ${result.stderr || result.stdout}`);

  return root;
}
