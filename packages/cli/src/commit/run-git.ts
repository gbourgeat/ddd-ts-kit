import { spawnSync } from 'node:child_process';

/** What git prints for a command run in `directory`; undefined when it fails or is not installed. Only the user's own repository is read or changed. */
export function runGit(directory: string, args: readonly string[]): string | undefined {
  const run = spawnSync('git', [...args], { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  return run.status === 0 ? run.stdout : undefined;
}
