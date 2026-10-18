import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import type { Config } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import { addWorktree } from '../worker/add-worktree.js';
import { baseOf } from '../worker/base-of.js';
import { ensureContainsBase } from '../worker/ensure-contains-base.js';
import { installDependencies } from '../worker/install-dependencies.js';
import { isWorktree } from '../worker/is-worktree.js';
import { repositoryPrefix } from '../worker/repository-prefix.js';
import { openStories } from './open-stories.js';
import { readStoryPlace } from './read-story-place.js';
import type { StoryPlace } from './story-place.js';
import type { StoryScope } from './story-scope.js';
import { STORY_SCOPE_FILE } from './story-scope-file.js';

const STORY = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** What the caller asks for one story. */
export interface StoryRequest {
  readonly story: string;
  /** The worktree directory, relative to the project root; by default `../<project>-<story>`. */
  readonly worktree?: string;
  /** By default `story/<story>`, in lower case. */
  readonly branch?: string;
  /** The ref the branch is cut from and merges back into; by default the current branch. */
  readonly base?: string;
  readonly dryRun: boolean;
  readonly install: boolean;
}

/**
 * Gives one story its place, where one session takes it to its pull request while other sessions
 * take other stories: a git worktree on its own branch cut from the base, its dependencies
 * installed, and `.ddd-ts-kit/story.json`. The worktree of a story already open is kept, and the
 * story resumes there; the story open in another worktree is refused, so that two sessions never
 * take the same one. Names the other open stories and the contexts they change.
 */
export function openStoryScope(root: string, config: Config, request: StoryRequest): StoryScope {
  const story = storyNamed(request.story);
  const prefix = repositoryPrefix(root);
  const base = baseOutsideStory(root, config, request.base);
  const worktree = path.resolve(root, request.worktree ?? `../${path.basename(root)}-${story.toLowerCase()}`);
  const branch = request.branch ?? `story/${story.toLowerCase()}`;
  const inside = path.join(worktree, prefix);
  const all = openStories(root, prefix);

  refuseOpenElsewhere(all, story, inside);

  const created = !isWorktree(root, worktree);

  if (!created) {
    ensureContainsBase(worktree, runGit(worktree, ['branch', '--show-current'])?.trim() || 'HEAD', base);
  }

  const install = request.dryRun
    ? undefined
    : prepare(root, { worktree, inside, created, install: request.install, story, base, branch, config });

  return {
    story,
    dryRun: request.dryRun,
    worktree: inside,
    branch,
    base,
    created,
    ...(install === undefined ? {} : { install }),
    others: all.filter((open) => open.story.toLowerCase() !== story.toLowerCase()),
    notes: installNotes(inside, config, install),
  };
}

function storyNamed(story: string): string {
  if (!STORY.test(story)) {
    throw new CliError(
      `"${story}" is not the code of a story.`,
      'Pass the code its rows start with in docs/architecture/slices.md: `US5` for the rows `US5.01`, `US5.02`.',
    );
  }

  return story;
}

/** The base, which is never the branch of another story: a story is cut from the trunk. */
function baseOutsideStory(root: string, config: Config, base: string | undefined): string {
  const open = readStoryPlace(root);

  if (base === undefined && open !== undefined) {
    throw new CliError(
      `${root} is the worktree of the story ${open.story}: its branch would be the base of the new one.`,
      'Run story-scope from the checkout of the trunk, or name the base: `--base origin/main`.',
    );
  }

  return baseOf(root, config, base);
}

function refuseOpenElsewhere(
  open: readonly { story: string; worktree: string }[],
  story: string,
  inside: string,
): void {
  const elsewhere = open.find(
    (other) =>
      other.story.toLowerCase() === story.toLowerCase() && path.resolve(other.worktree) !== path.resolve(inside),
  );

  if (elsewhere !== undefined) {
    throw new CliError(
      `${story} is already open in ${elsewhere.worktree}: another session may be taking it.`,
      `Resume it there (\`cd ${elsewhere.worktree}\`), or close that worktree first; two sessions never take the same story.`,
    );
  }
}

/** What `prepare` needs: where, for which story, and whether to install. */
interface PreparedStory {
  readonly worktree: string;
  readonly inside: string;
  readonly created: boolean;
  readonly install: boolean;
  readonly story: string;
  readonly base: string;
  readonly branch: string;
  readonly config: Config;
}

/** The worktree it creates, the story file, then the clean install of a worktree it created, unless refused. */
function prepare(root: string, place: PreparedStory): ReturnType<typeof installDependencies> | undefined {
  const { worktree, inside, created, story, base, branch, config } = place;

  if (created) {
    addWorktree(root, { worktree, branch, base });
  }

  const baseCommit = runGit(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])?.trim();
  const written: StoryPlace = { story, base, ...(baseCommit === undefined ? {} : { baseCommit }), branch };
  const file = path.join(inside, STORY_SCOPE_FILE);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(written, null, 2)}\n`);

  return created && place.install ? installDependencies(inside, config.stack.packageManager) : undefined;
}

function installNotes(
  inside: string,
  config: Config,
  install: ReturnType<typeof installDependencies> | undefined,
): string[] {
  if (install?.ok === true) {
    return [`dependencies installed in the worktree with \`${install.command}\` (${install.seconds} s).`];
  }

  if (install === undefined && fs.existsSync(path.join(inside, 'node_modules'))) {
    return [];
  }

  const failed = install === undefined ? '' : `\`${install.command}\` failed (${install.seconds} s). `;

  return [
    `${failed}Install the dependencies before the story starts: \`cd ${inside} && ${inDialect('npm ci', config.stack.packageManager)}\`.`,
  ];
}
