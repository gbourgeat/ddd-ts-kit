import type { Location } from '../model/location';

/**
 * Where a value of the model may be written as a function and is looked for: `domain/` of a
 * context, and the shared kernel outside its `presentation/`. Specs are never judged. Same table
 * as the ESLint plugin.
 */
export function isModelFile(file: string, location: Location, sharedKernelDir: string): boolean {
  if (/\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  if (location.area === 'context') {
    return location.layer === 'domain';
  }

  return location.area === 'shared-kernel' && !file.startsWith(`${sharedKernelDir}/presentation/`);
}
