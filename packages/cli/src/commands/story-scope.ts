import { readConfig } from '../config/index.js';
import { openStoryScope } from '../stories/open-story-scope.js';
import type { StoryScope } from '../stories/story-scope.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';

/** Opens the worktree of one story, or finds it again, and names the other stories open in the repository. */
export const storyScopeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    worktree: { type: 'string' },
    branch: { type: 'string' },
    base: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-install': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);

  const scope = openStoryScope(root, config, {
    story: args.positionals[0] ?? '',
    ...args.texts(['worktree', 'branch', 'base']),
    dryRun: args.flag('dry-run'),
    install: !args.flag('no-install'),
  });

  io.out(args.json ? JSON.stringify(scope, null, 2) : formatScope(scope));

  return 0;
};

function formatScope(scope: StoryScope): string {
  const would = scope.dryRun ? 'would be ' : '';

  const others = scope.others.map(
    (other) =>
      `other story open: ${other.story} in ${other.worktree}${other.contexts.length === 0 ? '' : `, changing ${other.contexts.join(', ')}`}`,
  );

  return [
    `worktree ${scope.created ? `${would}created` : 'kept, the story resumes'}: ${scope.worktree} (branch ${scope.branch}, base ${scope.base})`,
    ...others,
    ...scope.notes.map((note) => `note: ${note}`),
    `Next: work from the worktree, every command \`cd ${scope.worktree} && ...\`; \`npx ddd-ts-kit story ${scope.story}\` says where the story stands.`,
  ].join('\n');
}
