import type { LintedFile } from '../../project/linted-file';

/**
 * A production file of `domain/errors/` of a context, in a project that builds its refusals through
 * factories: on one class per concept (`factories`) or on one class per refusal (`named`).
 */
export function isErrorFile(file: LintedFile): boolean {
  const { location } = file;

  return (
    file.config.stack.refusals !== 'classes' &&
    location.area === 'context' &&
    location.layer === 'domain' &&
    location.inside[0] === 'errors' &&
    !file.isTest
  );
}
