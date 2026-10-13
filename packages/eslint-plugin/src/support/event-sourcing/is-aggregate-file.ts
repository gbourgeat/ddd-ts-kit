import type { LintedFile } from '../../project/linted-file.js';

/** A production file of `domain/aggregates/` of a context. */
export function isAggregateFile(file: LintedFile): boolean {
  const { location } = file;

  return (
    location.area === 'context' && !file.isTest && location.layer === 'domain' && location.inside[0] === 'aggregates'
  );
}
