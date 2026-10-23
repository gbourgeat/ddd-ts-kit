import type { SourceFile } from '../model/source-file';

/** True for a source of the `domain/errors/` of a context, the code list included. */
export function isErrorFile(file: SourceFile): boolean {
  const { location } = file;

  return !file.isTest && location.area === 'context' && location.layer === 'domain' && location.inside[0] === 'errors';
}
