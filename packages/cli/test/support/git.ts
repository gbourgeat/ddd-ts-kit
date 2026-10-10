import { execFileSync } from 'node:child_process';

const IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];

/** Runs git in a throwaway repository of a test and answers what it printed. */
export function git(root: string, ...args: string[]): string {
  return execFileSync('git', [...IDENTITY, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
