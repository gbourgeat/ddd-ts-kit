import type { SourceFile } from '../model/source-file.js';

/** True for the `domain/errors/codes.ts` of a context, the closed list of its codes. */
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
