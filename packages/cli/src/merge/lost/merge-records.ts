import { runGit } from '../../commit/run-git.js';

/** A commit as `git log` describes it, with the trailers a merge carries. */
export interface MergeRecord {
  readonly commit: string;
  readonly parents: readonly string[];
  readonly subject: string;
  /** The value of its `Merge-Base:` trailer, the base its merge was computed from. */
  readonly mergeBase?: string;
  /** The entries of its `Lost-Accepted:` trailers. */
  readonly accepted: readonly string[];
}

const TRAILERS = 'valueonly,separator=%x2C';
const FORMAT = `--format=%H%x1f%P%x1f%s%x1f%(trailers:key=Merge-Base,${TRAILERS})%x1f%(trailers:key=Lost-Accepted,${TRAILERS})%x1e`;

/** The commits `git log <args>` lists, newest first; none when git fails. */
export function mergeRecords(top: string, args: readonly string[]): MergeRecord[] {
  const output = runGit(top, ['log', FORMAT, ...args]) ?? '';

  return output
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map(recordOf);
}

function recordOf(record: string): MergeRecord {
  const [commit = '', parents = '', subject = '', mergeBase = '', accepted = ''] = record.split('\x1f');
  const base = mergeBase.split(',')[0]?.trim() ?? '';

  return {
    commit,
    parents: parents.split(' ').filter((parent) => parent !== ''),
    subject,
    ...(base === '' ? {} : { mergeBase: base }),
    accepted: accepted.split(/[\s,]+/).filter((entry) => entry !== ''),
  };
}
