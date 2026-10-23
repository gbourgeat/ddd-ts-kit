import { CliError } from '../../cli-error';
import { commitOf } from './commit-of';
import { mergeBaseOf } from './merge-base-of';
import type { MergeRecord } from './merge-records';
import type { MergeToVerify } from './merge-to-verify';

/** What the caller names instead of what the commit says. */
export interface MergeOptions {
  /** The head of the branch a one-parent commit squashed. */
  readonly theirs?: string;
  readonly base?: string;
}

/**
 * The merge a commit made: its first parent is ours, its second (or `--theirs` for a squash
 * commit, which has one) is theirs.
 */
export function mergeOfRecord(top: string, record: MergeRecord, options: MergeOptions): MergeToVerify {
  const [ours, second] = record.parents;
  const theirs = options.theirs === undefined ? second : theirsOf(top, options.theirs);
  const short = record.commit.slice(0, 7);

  if (ours === undefined || theirs === undefined) {
    throw new CliError(
      `${short} is not a merge commit: it has ${record.parents.length === 0 ? 'no parent' : 'one parent'}.`,
      `For a squash commit, name the head of the branch it squashed: \`ddd-ts-kit verify-merge ${short} --theirs <branch head>\`.`,
    );
  }

  return {
    commit: record.commit,
    subject: record.subject,
    ...mergeBaseOf(top, {
      ours,
      theirs,
      ...(options.base === undefined ? {} : { option: options.base }),
      ...(record.mergeBase === undefined ? {} : { trailer: record.mergeBase }),
    }),
    ours,
    theirs,
    accepted: record.accepted,
  };
}

function theirsOf(top: string, ref: string): string {
  const commit = commitOf(top, ref);

  if (commit === undefined) {
    throw new CliError(
      `${ref} is not a commit of this repository.`,
      'Fetch it first, or pass the head of the branch: `--theirs <ref>`.',
    );
  }

  return commit;
}
