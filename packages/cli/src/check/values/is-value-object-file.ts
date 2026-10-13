import type { Location } from '../model/location.js';

/**
 * Where a value object is declared: `domain/value-objects/` of a context, or a `*.vo.ts` of the
 * shared kernel outside its `presentation/`. Specs are never one.
 */
export function isValueObjectFile(file: string, location: Location, sharedKernelDir: string): boolean {
  if (/\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  if (location.area === 'context') {
    return location.layer === 'domain' && location.inside[0] === 'value-objects';
  }

  return (
    location.area === 'shared-kernel' && file.endsWith('.vo.ts') && !file.startsWith(`${sharedKernelDir}/presentation/`)
  );
}
