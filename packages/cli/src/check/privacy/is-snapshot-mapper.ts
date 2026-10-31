import type { SourceFile } from '../model/source-file';

const NAME = /-snapshots?\.mapper\.ts$/;

/** The mapper of the snapshots of an aggregate, `infrastructure/persistence/<aggregate>-snapshots.mapper.ts`. */
export function isSnapshotMapper(file: SourceFile): boolean {
  const { location } = file;

  return (
    !file.isTest &&
    location.area === 'context' &&
    location.layer === 'infrastructure' &&
    location.inside[0] === 'persistence' &&
    NAME.test(file.path)
  );
}
