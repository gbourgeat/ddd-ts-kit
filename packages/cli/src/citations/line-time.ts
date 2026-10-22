import { runGit } from '../commit/run-git';

/**
 * When a line of a document was last changed, as a commit time in seconds, from `git blame` on
 * the working tree: a line not committed yet is now. Undefined when git cannot say (a document
 * it does not track).
 */
export function lineTime(root: string, document: string, line: number): number | undefined {
  const blame = runGit(root, ['blame', '--porcelain', '-L', `${line},${line}`, '--', document]);
  const time = /^committer-time (\d+)$/m.exec(blame ?? '')?.[1];

  return time === undefined ? undefined : Number(time);
}
