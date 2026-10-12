import type { LintedFile } from '../../project/linted-file.js';

/** A production file of `domain/errors/` of a context, in a project that builds its refusals through factories. */
export function isErrorFile(file: LintedFile): boolean {
  const { location } = file;

  return (
    file.config.stack.refusals === 'factories' &&
    location.area === 'context' &&
    location.layer === 'domain' &&
    location.inside[0] === 'errors' &&
    !file.isTest
  );
}
