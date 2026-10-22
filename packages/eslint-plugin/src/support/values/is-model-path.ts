import { isTestFile } from '../../project/is-test-file';
import type { Location } from '../../project/location';

/**
 * Where a value of the model may be written as a function and is looked for: `domain/` of a
 * context, and the shared kernel outside its `presentation/`. Specs are never judged. Same table
 * as the checker of the CLI.
 */
export function isModelPath(file: string, location: Location, sharedKernelDir: string): boolean {
  if (isTestFile(file, location)) {
    return false;
  }

  if (location.area === 'context') {
    return location.layer === 'domain';
  }

  return location.area === 'shared-kernel' && !file.startsWith(`${sharedKernelDir}/presentation/`);
}
