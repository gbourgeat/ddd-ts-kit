import { readConfig } from '../config';
import { openWorktree } from '../worktree/open-worktree';
import type { WorktreeScope } from '../worktree/worktree-scope';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * The worktree of one piece of work, `.worktrees/<name>` on `work/<name>`: where a session writes
 * the code of the contexts, the main checkout of the trunk staying clean. An existing one is kept.
 */
export const worktreeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    branch: { type: 'string' },
    base: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-install': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);

  const scope = openWorktree(root, config, {
    name: args.positionals[0] ?? '',
    ...args.texts(['branch', 'base']),
    dryRun: args.flag('dry-run'),
    install: !args.flag('no-install'),
  });

  io.out(args.json ? JSON.stringify(scope, null, 2) : formatWorktree(scope));

  return 0;
};

function formatWorktree(scope: WorktreeScope): string {
  const would = scope.dryRun ? 'would be ' : '';

  return [
    `worktree ${scope.created ? `${would}created` : 'kept, the work resumes'}: ${scope.worktree} (branch ${scope.branch}, base ${scope.base})`,
    ...scope.notes.map((note) => `note: ${note}`),
    `Next: work from the worktree, every command \`cd ${scope.worktree} && ...\` and every file by its absolute path there; commit on ${scope.branch}, then open its pull request.`,
  ].join('\n');
}
