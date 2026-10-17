import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];

/** What one commit of a test changes: each file written, or removed when its content is null, and when it is committed. */
export interface Commit {
  readonly message: string;
  readonly files: Readonly<Record<string, string | null>>;
  /** An ISO date for the author and the committer; now by default. */
  readonly at?: string;
}

/** Writes and removes the files of a commit in a throwaway repository, then commits them all; answers the abbreviated hash. */
export function commitFiles(root: string, commit: Commit): string {
  for (const [file, content] of Object.entries(commit.files)) {
    const absolute = path.join(root, file);

    if (content === null) {
      fs.rmSync(absolute);
    } else {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content);
    }
  }

  const env =
    commit.at === undefined
      ? process.env
      : { ...process.env, GIT_AUTHOR_DATE: commit.at, GIT_COMMITTER_DATE: commit.at };

  const run = (...args: string[]): string =>
    execFileSync('git', [...IDENTITY, ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run('add', '--all');
  run('commit', '--quiet', '--message', commit.message);

  return run('rev-parse', '--short', 'HEAD').trim();
}
