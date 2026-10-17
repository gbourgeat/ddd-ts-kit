import { readConfig } from '../config/index.js';
import { openWorkerScope } from '../worker/open-worker-scope.js';
import type { WorkerScope } from '../worker/worker-scope.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { knownContext } from './known-context.js';
import { rowsOption } from './rows-option.js';

/** Prepares the place of one worker of a parallel build (worktree, branch, dependencies, scope file) and prints its briefing. */
export const workerScopeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    worktree: { type: 'string' },
    branch: { type: 'string' },
    base: { type: 'string' },
    rows: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-install': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);
  const context = knownContext(config, args.positionals[0]);

  const scope = openWorkerScope(root, config, {
    context,
    ...args.texts(['worktree', 'branch', 'base']),
    ...rowsOption(args.text('rows')),
    dryRun: args.flag('dry-run'),
    install: !args.flag('no-install'),
  });

  io.out(args.json ? JSON.stringify(scope, null, 2) : formatScope(scope));

  return 0;
};

function formatScope(scope: WorkerScope): string {
  const would = scope.dryRun ? 'would be ' : '';
  const worktree = scope.created ? `${would}created` : 'kept';

  return [
    `worktree ${worktree}: ${scope.worktree} (branch ${scope.branch}, base ${scope.trunk})`,
    `scope ${would}written: ${scope.scopeFile}`,
    ...scope.notes.map((note) => `note: ${note}`),
    '',
    scope.briefing,
  ].join('\n');
}
