import type { Config } from '../config/index.js';
import type { CommitSize, SliceSize } from './commit-size.js';
import { isDerived } from './is-derived.js';
import { readChanges } from './read-changes.js';
import { sliceOf } from './slice-of.js';

/** Measures what is about to be committed in the project at `root`, with the counting rules of the editor hook of the plugin. */
export function measureCommit(root: string, config: Config, staged: boolean): CommitSize {
  const changes = readChanges(root, staged);
  const counted = (changes ?? []).filter((change) => !isDerived(config, change.path));
  const lines = counted.reduce((sum, change) => sum + change.lines, 0);

  return {
    gitRepository: changes !== undefined,
    staged,
    files: counted.length,
    lines,
    limits: { maxFiles: config.commit.maxFiles, maxLines: config.commit.maxLines },
    over: counted.length > config.commit.maxFiles || lines > config.commit.maxLines,
    slices: slicesOf(
      config,
      counted.map((change) => change.path),
    ),
  };
}

function slicesOf(config: Config, files: readonly string[]): SliceSize[] {
  const sizes = new Map<string, number>();

  for (const file of files) {
    sizes.set(sliceOf(config, file), (sizes.get(sliceOf(config, file)) ?? 0) + 1);
  }

  return [...sizes]
    .map(([slice, count]) => ({ slice, files: count }))
    .sort((left, right) => right.files - left.files || left.slice.localeCompare(right.slice));
}
