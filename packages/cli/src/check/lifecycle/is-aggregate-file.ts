import type { SourceFile } from '../model/source-file';

/** A production file of `domain/aggregates/` of a context. */
export function isAggregateFile(file: SourceFile): boolean {
  const { location } = file;

  return (
    !file.isTest && location.area === 'context' && location.layer === 'domain' && location.inside[0] === 'aggregates'
  );
}
