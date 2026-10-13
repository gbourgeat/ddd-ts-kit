import { isTestFile } from '../../project/is-test-file.js';
import type { Location } from '../../project/location.js';

/**
 * Where a value object is declared: `domain/value-objects/` of a context, or a `*.vo.ts` of the
 * shared kernel outside its `presentation/`. Same table as the checker of the CLI.
 */
export function isValueObjectPath(file: string, location: Location, sharedKernelDir: string): boolean {
  if (isTestFile(file, location)) {
    return false;
  }

  if (location.area === 'context') {
    return location.layer === 'domain' && location.inside[0] === 'value-objects';
  }

  return (
    location.area === 'shared-kernel' && file.endsWith('.vo.ts') && !file.startsWith(`${sharedKernelDir}/presentation/`)
  );
}
