import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../../commit/run-git.js';
import { commitOf } from './commit-of.js';
import { mergeBaseOf } from './merge-base-of.js';
import type { MergeToVerify } from './merge-to-verify.js';

/**
 * The merge in progress, when MERGE_HEAD is there: ours is HEAD, theirs MERGE_HEAD, the result
 * the index plus the working tree. The trailers are read from the message prepared for its
 * commit (MERGE_MSG), so that the merge is judged on the base it will record.
 */
export function inProgressMerge(top: string, base: string | undefined): MergeToVerify | undefined {
  const theirs = commitOf(top, 'MERGE_HEAD');
  const ours = commitOf(top, 'HEAD');

  if (theirs === undefined || ours === undefined) {
    return undefined;
  }

  const message = mergeMessage(top);
  const trailer = /^Merge-Base:\s*(\S+)/m.exec(message)?.[1];
  const accepted = [...message.matchAll(/^Lost-Accepted:(.*)$/gm)].flatMap((match) => (match[1] ?? '').split(/[\s,]+/));

  return {
    subject: message.split('\n')[0]?.trim() || 'merge in progress',
    ...mergeBaseOf(top, {
      ours,
      theirs,
      ...(base === undefined ? {} : { option: base }),
      ...(trailer === undefined ? {} : { trailer }),
    }),
    ours,
    theirs,
    accepted: accepted.filter((entry) => entry !== ''),
  };
}

/** MERGE_MSG without the comment lines git adds to it; empty when there is none. */
function mergeMessage(top: string): string {
  const file = runGit(top, ['rev-parse', '--git-path', 'MERGE_MSG'])?.trim();

  try {
    return file === undefined
      ? ''
      : fs
          .readFileSync(path.resolve(top, file), 'utf8')
          .split('\n')
          .filter((line) => !line.startsWith('#'))
          .join('\n');
  } catch {
    return '';
  }
}
