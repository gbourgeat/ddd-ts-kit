import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliError } from '../cli-error';

/**
 * `init` writes a project, never a home directory nor the root of a file system: there its
 * `.claude/settings.json` would be the settings of every session of the user, its allow rules
 * applied to every repository.
 */
export function refuseUnprojectedRoot(root: string): void {
  const at = realOrResolved(root);

  const where = placeOf(at);

  if (where !== undefined) {
    throw new CliError(
      `init does not run in ${where} (${at}): what it writes there, .claude/settings.json first, would apply to everything below it.`,
      'Run init in the directory of the project: `npx ddd-ts-kit init --cwd <project>`.',
    );
  }
}

function placeOf(at: string): string | undefined {
  if (at === realOrResolved(os.homedir())) {
    return 'your home directory';
  }

  return at === path.parse(at).root ? 'the root of the file system' : undefined;
}

function realOrResolved(directory: string): string {
  try {
    return fs.realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}
