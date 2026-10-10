import type { Location } from '../model/location.js';

/** A job file: `application/scheduling/*.job.ts` of a context, specs aside. */
export function isJobFile(file: string, location: Location): boolean {
  if (location.area !== 'context' || location.layer !== 'application' || /\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  return location.inside[0] === 'scheduling' && file.endsWith('.job.ts');
}
