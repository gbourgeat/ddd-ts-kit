import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The line of lefthook.yml that makes each checkout run its own lefthook, and fail without its dependencies. */
const LEFTHOOK_KEY = 'lefthook: node_modules/.bin/lefthook';

/**
 * The git hooks of the project: lefthook.yml has the line that runs the lefthook of the checkout
 * the hook fires in, and this clone has the pre-commit hook lefthook installs. Outside a git
 * repository only the file is judged.
 */
export function hookFindings(root: string): DoctorFinding[] {
  return [...configFindings(root), ...installedFindings(root)];
}

function configFindings(root: string): DoctorFinding[] {
  const config = read(path.join(root, 'lefthook.yml'));

  if (config === undefined) {
    return [{ area: 'hook', name: 'lefthook.yml', problem: 'missing', expected: 'the file init writes' }];
  }

  return /^lefthook:\s*\S/m.test(config)
    ? []
    : [{ area: 'hook', name: 'lefthook.yml lefthook', problem: 'missing', expected: LEFTHOOK_KEY }];
}

/** Git reads its hooks from `git rev-parse --git-path hooks`: shared by every worktree, or core.hooksPath. */
function installedFindings(root: string): DoctorFinding[] {
  const hooks = runGit(root, ['rev-parse', '--git-path', 'hooks'])?.trim();

  if (hooks === undefined || hooks === '') {
    return [];
  }

  const hook = read(path.resolve(root, hooks, 'pre-commit'));
  const expected = 'the hook lefthook installs';

  if (hook === undefined) {
    return [{ area: 'hook', name: 'pre-commit', problem: 'not installed', expected }];
  }

  return hook.includes('lefthook')
    ? []
    : [
        {
          area: 'hook',
          name: 'pre-commit',
          problem: 'written otherwise',
          expected,
          found: 'a hook lefthook did not write',
        },
      ];
}

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}
