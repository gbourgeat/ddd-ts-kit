import type { LintedFile } from '../../project/linted-file';

/**
 * Where the language of the model lives: `domain/` and `application/` of a context, and the
 * shared kernel outside its `presentation/`. Specs are not judged. Same table as the checker.
 */
export function judgesNames(file: LintedFile): boolean {
  if (file.isTest) {
    return false;
  }

  if (file.location.area === 'context') {
    return file.location.layer === 'domain' || file.location.layer === 'application';
  }

  return (
    file.location.area === 'shared-kernel' && !file.path.startsWith(`${file.config.sharedKernelDir}/presentation/`)
  );
}
