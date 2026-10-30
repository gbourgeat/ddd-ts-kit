import type { Config } from '../config';
import { generatedFiles } from '../review';
import type { ChangedPath } from './changed-path';
import type { ReadingPart, ReviewedFile } from './digest';
import type { ProjectTree } from './project-tree';
import { readingPart } from './reading-part';
import { withoutGeneratedSections } from './without-generated-sections';

const READING_ORDER: readonly ReadingPart[] = [
  'context',
  'domain',
  'application',
  'presentation',
  'infrastructure',
  'tests',
  'elsewhere',
];

/** The changed files a person reviews, in reading order, and those a command of the kit writes. */
export interface FilesToRead {
  readonly review: ReviewedFile[];
  readonly regenerated: string[];
}

/**
 * The changed files split as REVIEW.md splits them: the generated ones it names (a CONTEXT.md
 * among them when the change lies in its generated sections alone) apart, the others by the part
 * they are read in, in reading order, then by path.
 */
export function filesToRead(
  config: Config,
  trees: readonly [ProjectTree, ProjectTree],
  paths: readonly ChangedPath[],
): FilesToRead {
  const kinds = generatedFiles(config);

  const regenerated = paths.filter(({ path }) =>
    kinds.some((kind) => kind.covers(path) && (kind.sections !== true || sameSections(trees, path))),
  );

  const review = paths
    .filter((changed) => !regenerated.includes(changed))
    .map(({ path, change }) => ({ path, part: readingPart(config, path), change }))
    .sort((left, right) => READING_ORDER.indexOf(left.part) - READING_ORDER.indexOf(right.part));

  return { review, regenerated: regenerated.map(({ path }) => path) };
}

/** Whether the file differs only in the regions the kit writes. */
function sameSections([before, after]: readonly [ProjectTree, ProjectTree], path: string): boolean {
  const was = before.ws.read(path);
  const is = after.ws.read(path);

  return was !== undefined && is !== undefined && withoutGeneratedSections(was) === withoutGeneratedSections(is);
}
