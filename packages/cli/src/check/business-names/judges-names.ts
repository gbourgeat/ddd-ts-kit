import type { SourceFile } from '../model/source-file';

/**
 * Where the language of the model lives: `domain/` and `application/` of a context, and the
 * shared kernel outside its `presentation/`. Specs are not judged. Same table as the ESLint plugin.
 */
export function judgesNames(file: SourceFile, sharedKernelDir: string): boolean {
  if (file.isTest) {
    return false;
  }

  if (file.location.area === 'context') {
    return file.location.layer === 'domain' || file.location.layer === 'application';
  }

  return file.location.area === 'shared-kernel' && !file.path.startsWith(`${sharedKernelDir}/presentation/`);
}
