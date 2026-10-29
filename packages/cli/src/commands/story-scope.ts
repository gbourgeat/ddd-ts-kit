import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { openStoryScope } from '../stories/open-story-scope';
import { STORY_KINDS, type StoryKind } from '../stories/story-kind';
import type { StoryScope } from '../stories/story-scope';
import { Arguments } from './arguments';
import type { Command } from './command';
import { stdoutJson } from '../json/stdout-json';

/** Opens the worktree of one story, or finds it again, and names the other stories open in the repository. */
export const storyScopeCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    from: { type: 'string' },
    kind: { type: 'string' },
    worktree: { type: 'string' },
    branch: { type: 'string' },
    base: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-install': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);
  const kind = kindOf(args.text('kind'));

  const scope = openStoryScope(root, config, {
    story: args.positionals[0] ?? '',
    ...args.texts(['from', 'worktree', 'branch', 'base']),
    ...(kind === undefined ? {} : { kind }),
    dryRun: args.flag('dry-run'),
    install: !args.flag('no-install'),
  });

  io.out(args.json ? stdoutJson(scope) : formatScope(scope));

  return 0;
};

function kindOf(text: string | undefined): StoryKind | undefined {
  if (text === undefined) {
    return undefined;
  }

  const kind = STORY_KINDS.find((known) => known === text);

  if (kind === undefined) {
    throw new CliError(`Unknown kind "${text}".`, `Pass --kind ${STORY_KINDS.join(' or --kind ')}.`);
  }

  return kind;
}

function formatScope(scope: StoryScope): string {
  const would = scope.dryRun ? 'would be ' : '';

  const others = scope.others.map(
    (other) =>
      `other story open: ${other.story} in ${other.worktree}${other.contexts.length === 0 ? '' : `, changing ${other.contexts.join(', ')}`}`,
  );

  const seeded = scope.seeds
    ? ` the story skill seeds the statement of docs/architecture/stories/${scope.story}.md from ${scope.from ?? ''};`
    : '';

  return [
    `worktree ${scope.created ? `${would}created` : 'kept, the story resumes'}: ${scope.worktree} (branch ${scope.branch}, base ${scope.base}${scope.kind === 'fix' ? ', a fix' : ''}${scope.from === undefined ? '' : `, from ${scope.from}`})`,
    ...others,
    ...scope.notes.map((note) => `note: ${note}`),
    `Next: work from the worktree, every command \`cd ${scope.worktree} && ...\`;${seeded} \`npx ddd-ts-kit story ${scope.story}\` says where the story stands.`,
  ].join('\n');
}
