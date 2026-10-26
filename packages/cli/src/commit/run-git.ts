import { spawnSync } from 'node:child_process';
import { CliError } from '../cli-error';

/** A history can print far more than the 1 MB spawnSync allows by default; the merge takes the same room. */
const MAX_BUFFER = 256 * 1024 * 1024;

/**
 * What git prints for a command run in `directory`; undefined when git answers with a failure
 * status or is not installed. A git that could not answer at all (its output over the buffer, a
 * timeout) is an error: it is not an empty answer. Only the user's own repository is read or changed.
 */
export function runGit(directory: string, args: readonly string[]): string | undefined {
  const run = spawnSync('git', [...args], {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const failure = run.error;
  const code = failure !== undefined && 'code' in failure ? String(failure.code) : undefined;

  if (failure !== undefined && code !== 'ENOENT') {
    throw new CliError(
      `git ${args[0] ?? ''} could not be read: ${code ?? failure.message}.`,
      'The answer of git was cut or git did not finish; run the same git command by hand to see why.',
    );
  }

  return run.status === 0 ? run.stdout : undefined;
}
