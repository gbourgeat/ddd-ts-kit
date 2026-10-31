import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import { subfolderOf } from '../init/subfolder-of';
import type { DoctorFinding } from './doctor-finding';

/** The line of lefthook.yml that makes each checkout run its own lefthook, and fail without its dependencies. */
const LEFTHOOK_KEY = 'lefthook: node_modules/.bin/lefthook';

/** The pre-commit job that scans the staged changes for a secret when gitleaks is installed, and says so otherwise. */
const SECRETS_JOB =
  'the pre-commit job `secrets`: gitleaks on the staged changes when it is installed, one line otherwise';

/**
 * The git hooks of the project: lefthook.yml has the line that runs the lefthook of the checkout
 * the hook fires in and the pre-commit job that scans the staged changes for a secret, and this
 * clone has the pre-commit hook lefthook installs. Outside a git repository the hooks cannot be
 * read: that is a finding, since `hooks:install` fails there too.
 */
export function hookFindings(root: string): DoctorFinding[] {
  return [...configFindings(root), ...installedFindings(root), ...subfolderFindings(root)];
}

function configFindings(root: string): DoctorFinding[] {
  const config = read(path.join(root, 'lefthook.yml'));

  if (config === undefined) {
    return [{ area: 'hook', name: 'lefthook.yml', problem: 'missing', expected: 'the file init writes' }];
  }

  return [
    ...(/^lefthook:\s*\S/m.test(config)
      ? []
      : [{ area: 'hook', name: 'lefthook.yml lefthook', problem: 'missing', expected: LEFTHOOK_KEY } as const]),
    ...(/^\s*- name: secrets\s*$/m.test(config)
      ? []
      : [{ area: 'hook', name: 'lefthook.yml secrets', problem: 'missing', expected: SECRETS_JOB } as const]),
  ];
}

/** The project is a folder of a larger repository: GitHub, GitLab and lefthook read their files at the top. */
function subfolderFindings(root: string): DoctorFinding[] {
  const folder = subfolderOf(root);

  return folder === undefined
    ? []
    : [
        {
          area: 'hook',
          name: 'project folder',
          problem: 'written otherwise',
          expected: 'lefthook.yml, .github/ and .gitlab-ci.yml at the top of the git repository',
          found: folder,
        },
      ];
}

/** Git reads its hooks from `git rev-parse --git-path hooks`: shared by every worktree, or core.hooksPath. */
function installedFindings(root: string): DoctorFinding[] {
  const hooks = runGit(root, ['rev-parse', '--git-path', 'hooks'])?.trim();

  if (hooks === undefined || hooks === '') {
    return [
      {
        area: 'hook',
        name: 'git repository',
        problem: 'missing',
        expected: 'no git repository here: the hooks could not be read; `git init` comes first',
      },
    ];
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
