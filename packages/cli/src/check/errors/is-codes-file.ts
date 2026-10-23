import type { SourceFile } from '../model/source-file';

/** True for the code list of a context, `<context>.codes.ts` at its root (read as `domain/errors/codes.ts`, where 0.86 kept it). */
export function isCodesFile(file: SourceFile): boolean {
  const { location } = file;

  return (
    !file.isTest &&
    location.area === 'context' &&
    location.layer === 'domain' &&
    location.inside.length === 2 &&
    location.inside[0] === 'errors' &&
    location.inside[1] === 'codes.ts'
  );
}
