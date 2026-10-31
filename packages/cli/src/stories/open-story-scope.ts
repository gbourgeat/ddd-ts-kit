import { trunkExample } from '../commit/trunk-example';
import path from 'node:path';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import type { Config } from '../config';
import { addWorktree } from '../worker/add-worktree';
import { type Base, baseOf } from '../worker/base-of';
import { ensureContainsBase } from '../worker/ensure-contains-base';
import { writeInsideProject } from '../workspace/write-inside-project';
import { installDependencies } from '../worker/install-dependencies';
import { isWorktree } from '../worker/is-worktree';
import { installNotes } from '../worker/install-notes';
import { repositoryPrefix } from '../worker/repository-prefix';
import { upstreamOf } from '../worker/upstream-of';
import { worktreeOf } from '../worker/worktree-of';
import { storyFileOf } from '../acceptance/story-file-of';
import { Workspace } from '../workspace';
import { openStories } from './open-stories';
import { originOf } from './origin-of';
import { readStoryPlace } from './read-story-place';
import type { StoryKind } from './story-kind';
import type { StoryPlace } from './story-place';
import type { StoryScope } from './story-scope';
import { STORY_SCOPE_FILE } from './story-scope-file';

const STORY = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** What the caller asks for one story. */
export interface StoryRequest {
  readonly story: string;
  /** The worktree directory, relative to the project root; by default `.worktrees/<story>` in the project of the main checkout. */
  readonly worktree?: string;
  /** By default `story/<story>`, in lower case. */
  readonly branch?: string;
  /** The ref the branch is cut from and merges back into; by default the branch the current one follows, else the current one. */
  readonly base?: string;
  /** `story` by default; `fix` for a story built behind locked regression specs. Kept from the file when the story resumes without it. */
  readonly kind?: StoryKind;
  /** Where the story comes from: an accepted intent or an incident record of the project. Kept from the file when the story resumes without it. */
  readonly from?: string;
  readonly dryRun: boolean;
  readonly install: boolean;
}

/** What the story is and where it comes from, as `story.json` records them. */
interface StoryIdentity {
  readonly kind: StoryKind;
  readonly from?: string;
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
  const { worktree, note } = worktreeOf(root, request.worktree, story.toLowerCase());
  const branch = request.branch ?? `story/${story.toLowerCase()}`;
  const inside = path.join(worktree, prefix);
  const all = openStories(root, prefix);

  refuseOpenElsewhere(all, story, inside);

  const created = !isWorktree(root, worktree);

  if (!created) {
    ensureContainsBase(worktree, runGit(worktree, ['branch', '--show-current'])?.trim() || 'HEAD', base);
  }

  const { seeds, ...identity } = identityOf(root, request, { inside, created });

  const install = request.dryRun
    ? undefined
    : prepare(root, { worktree, inside, created, install: request.install, story, base, branch, config, ...identity });

  return {
    story,
    ...identity,
    seeds,
    dryRun: request.dryRun,
    worktree: inside,
    branch,
    base: base.name,
    created,
    ...(install === undefined ? {} : { install }),
    others: all.filter((open) => open.story.toLowerCase() !== story.toLowerCase()),
    notes: [...(note === undefined ? [] : [note]), ...installNotes(inside, config, install)],
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

/**
 * The kind and the origin asked, else those the story resumes with, else a plain story; an origin
 * asked is read now, and refused when not an accepted intent nor an incident. `seeds` while the
 * story has an origin and no file yet (read on the trunk before the worktree exists).
 */
function identityOf(
  root: string,
  request: StoryRequest,
  place: { readonly inside: string; readonly created: boolean },
): StoryIdentity & { readonly seeds: boolean } {
  const existing = place.created ? undefined : readStoryPlace(place.inside);
  const from = request.from === undefined ? existing?.from : originOf(root, request.from);
  const ws = new Workspace(place.created ? root : place.inside, false);

  return {
    kind: request.kind ?? existing?.kind ?? 'story',
    ...(from === undefined ? {} : { from }),
    seeds: from !== undefined && storyFileOf(ws, request.story) === undefined,
  };
}

/** The base, which is never the branch of another story: a story is cut from the trunk. */
function baseOutsideStory(root: string, config: Config, base: string | undefined): Base {
  const open = readStoryPlace(root);

  if (base === undefined && open !== undefined) {
    throw new CliError(
      `${root} is the worktree of the story ${open.story}: its branch would be the base of the new one.`,
      `Run story-scope from the checkout of the trunk, or name the base: \`--base ${trunkExample(root)}\`.`,
    );
  }

  return baseOf(root, config, base ?? upstreamOf(root));
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

/** What `prepare` needs: where, for which story, what it is and where it comes from, and whether to install. */
interface PreparedStory extends StoryIdentity {
  readonly worktree: string;
  readonly inside: string;
  readonly created: boolean;
  readonly install: boolean;
  readonly story: string;
  readonly base: Base;
  readonly branch: string;
  readonly config: Config;
}

/** The worktree it creates, the story file, then the clean install of a worktree it created, unless refused. */
function prepare(root: string, place: PreparedStory): ReturnType<typeof installDependencies> | undefined {
  const { worktree, inside, created, story, base, branch, config, kind, from } = place;

  if (created) {
    addWorktree(root, { worktree, branch, base: base.commit });
  }

  const written: StoryPlace = {
    story,
    base: base.name,
    baseCommit: base.commit,
    branch,
    kind,
    ...(from === undefined ? {} : { from }),
  };

  writeInsideProject(inside, STORY_SCOPE_FILE, `${JSON.stringify(written, null, 2)}\n`);

  return created && place.install ? installDependencies(inside, config.stack.packageManager) : undefined;
}
