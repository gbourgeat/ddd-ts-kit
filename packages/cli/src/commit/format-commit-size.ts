import type { CommitSize } from './commit-size.js';

const SHOWN_SLICES = 8;

/** The commit size for a reader: the counts, the limits, and the slices to commit one by one when it is over. */
export function formatCommitSize(size: CommitSize): string {
  if (!size.gitRepository) return 'Not a git repository: the commit size is not measured.';

  const what = size.staged ? 'staged' : 'uncommitted';
  const measured = `${size.files} changed file${size.files === 1 ? '' : 's'} and ${size.lines} changed line${size.lines === 1 ? '' : 's'} are ${what}`;
  const advised = `advised at most ${size.limits.maxFiles} files and ${size.limits.maxLines} lines a commit, generated files not counted`;

  if (size.files === 0) return `Nothing ${what} to measure (${advised}).`;
  if (!size.over) return `${measured} (${advised}): within the limits. Slices: ${slicesText(size)}.`;

  return `${measured} (${advised}): over the limits. Commit each finished slice on its own, with the files its generator wrote: ${slicesText(size)}.`;
}

function slicesText(size: CommitSize): string {
  const slices = size.slices.map(({ slice, files }) => `${slice} (${files} file${files === 1 ? '' : 's'})`);

  return slices.length > SHOWN_SLICES ? `${slices.slice(0, SHOWN_SLICES).join(', ')} and ${slices.length - SHOWN_SLICES} more` : slices.join(', ');
}
