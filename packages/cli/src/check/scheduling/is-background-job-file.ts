import type { Location } from '../model/location';

/** `application/background/*.background-job.ts` of a context, specs aside. */
export function isBackgroundJobFile(file: string, location: Location): boolean {
  if (location.area !== 'context' || location.layer !== 'application' || /\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  return location.inside[0] === 'background' && file.endsWith('.background-job.ts');
}
