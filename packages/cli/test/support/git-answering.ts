import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { tempDir } from '../helpers';

/** The one call a stand-in of git answers itself. */
export interface GitAnswer {
  /** What the arguments of the call hold: `merge --abort`. */
  readonly when: string;
  /** The shell that answers it, `$GIT` being the real git: `exit 1`, `"$GIT" "$@" | head -n 2`. */
  readonly answer: string;
}

/**
 * Runs `body` with a git first on the PATH that hands every call to the real one, except the call
 * `when` names: a git that refuses, or stops short, where the real one would not, with no timer
 * and no race. The CLI runs in process and finds git on the PATH of this process.
 */
export function withGitAnswering<T>({ when, answer }: GitAnswer, body: () => T): T {
  const bin = tempDir('git-answering');
  const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const previous = process.env['PATH'];

  const script = [
    '#!/bin/sh',
    `GIT='${real}'`,
    'case " $* " in',
    `  *'${when}'*)`,
    `    ${answer}`,
    '    exit',
    '    ;;',
    'esac',
    'exec "$GIT" "$@"',
  ];

  fs.writeFileSync(path.join(bin, 'git'), `${script.join('\n')}\n`, { mode: 0o755 });
  process.env['PATH'] = `${bin}${path.delimiter}${previous ?? ''}`;

  try {
    return body();
  } finally {
    process.env['PATH'] = previous;
  }
}
