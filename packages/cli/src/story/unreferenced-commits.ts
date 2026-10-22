import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { GitRunner } from './attributed-marker';
import { CHANGE_GATED } from './change-gated';
import { commitRows } from './commit-rows';
import { storyOf } from './story-of';
import type { UnreferencedCommit } from './unreferenced-commit';

/** One record per commit: the hash, its subject and its `Change:` trailers, then the files it changes, one per line. */
const SHOWN = '--format=%x1e%h%x1f%s%x1f%(trailers:key=Change,valueonly,separator=%x2C)%x1f';

const FIX =
  'add the trailer `Change: <id>` to the commit, with the id the change process of the team gives (`git commit --amend` for the last commit, an interactive rebase of the branch for an earlier one), before the pull request';

/** The story the commits are read for, and the ids of every row of the slices file. */
export interface StoryCommits {
  readonly story: string;
  readonly ids: readonly string[];
  readonly git: GitRunner;
}

/**
 * The commits of the story on the current branch that change a migration or a container file
 * (the paths the change-reference hook watches) and carry no `Change: <id>` trailer. A commit
 * belongs to the story as a marker does: by its `Slice:` trailer, else by the rows its message
 * names, else by its subject naming the story. One git call lists the commits that touch such a
 * file, one attributes them, one reads the subjects, the trailers and the files of those kept.
 */
export function unreferencedCommits(root: string, { story, ids, git }: StoryCommits): UnreferencedCommit[] {
  const touching = linesOf(git(root, ['log', '--format=%H', 'HEAD', '--', ...CHANGE_GATED.pathspecs]));

  if (touching.length === 0) {
    return [];
  }

  const rows = commitRows(root, touching, { ids, git });
  const subjects = subjectsOf(root, touching, git);

  const own = touching.filter((sha) => {
    const named = rows.get(sha)?.rows ?? [];

    return (
      named.some((id) => storyOf(id) === story) || (named.length === 0 && namesStory(subjects.get(sha) ?? '', story))
    );
  });

  if (own.length === 0) {
    return [];
  }

  return recordsOf(git(root, ['show', '--name-only', SHOWN, ...own]) ?? '').flatMap((record) => {
    const [sha = '', subject = '', change = '', files = ''] = record.split('\x1f');
    const gated = linesOf(files).filter((file) => CHANGE_GATED.matches(file));

    if (change.trim() !== '' || gated.length === 0) {
      return [];
    }

    return [{ sha, subject, files: gated, rows: rows.get(longOf(sha, own))?.rows ?? [], fix: FIX }];
  });
}

/** The subject of each commit, by full hash: what attributes a commit naming the story and no row. */
function subjectsOf(root: string, shas: readonly string[], git: GitRunner): Map<string, string> {
  const output = git(root, ['show', '--no-patch', '--format=%H%x1f%s', ...shas]) ?? '';

  return new Map(
    linesOf(output).flatMap((line) => {
      const [sha, subject] = line.split('\x1f');

      return sha === undefined || subject === undefined ? [] : [[sha, subject] as const];
    }),
  );
}

/** True when the subject names the story itself, word-bounded (`US5`, `#US5`), as a row id is named. */
function namesStory(subject: string, story: string): boolean {
  return new RegExp(`(?<![\\w.#])#?${escapeRegExp(story)}(?!\\w|\\.\\d)`).test(subject);
}

/** The full hash an abbreviated one stands for, among those shown. */
function longOf(short: string, shas: readonly string[]): string {
  return shas.find((sha) => sha.startsWith(short)) ?? short;
}

function recordsOf(output: string): string[] {
  return output.split('\x1e').filter((record) => record.trim() !== '');
}

function linesOf(output: string | undefined): string[] {
  return (output ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
